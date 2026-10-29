# Spec: MFA no painel interno (v1)

## Objetivo

Exigir segundo fator (TOTP, `aal2` do Supabase Auth) em todo o painel interno (`/admin`).

Hoje basta a senha de um membro da equipe Nextech para entrar em `/admin`. O painel opera com `service_role` sobre todas as clínicas: lê as conversas dos pacientes pelo acesso de suporte, cria clínicas e convida responsáveis. Uma senha roubada dá acesso a dado de saúde de toda a plataforma. É **bloqueio de go-live** (achado da revisão de segurança da parte 4 da 3b).

## Quem acessa

Só membros de `platform_admins`. Não depende de plano: o painel interno não é produto vendido. O painel da clínica fica fora do escopo e continua só com senha. MFA para clínicas é outra spec.

## Decisões (Jhones, 2026-10-29)

| Tema | Decisão |
|---|---|
| Fator | **TOTP** (aplicativo autenticador), já ligado no projeto (`mfa_totp_enroll_enabled` e `mfa_totp_verify_enabled`, conferidos pela API de gestão em 2026-10-29). A chave de acesso (WebAuthn/passkey) resiste a phishing e foi considerada, mas ficou para depois: o suporte do Supabase ainda está em beta. SMS foi descartado (clonagem de chip e custo por mensagem) |
| Escopo | **O painel inteiro.** `requireAdminContext()` exige `aal2`. Toda página, server action e query do `(admin)` já passa por ela, então nenhuma rota fica de fora por esquecimento |
| Cadastro | **Obrigatório no primeiro acesso**, sem carência. Admin sem fator verificado cai na tela do QR code e não vê nada do painel até confirmar o primeiro código |
| Recuperação | **Segundo fator de reserva + reset manual.** O admin pode cadastrar um segundo dispositivo TOTP. Se perder todos, o fator é removido pelo Supabase Dashboard, seguindo o passo a passo em `docs/infra-setup.md`. Não há códigos de recuperação próprios |
| Validade | **A sessão inteira.** Depois do desafio, o `aal2` vale até o logout ou o fim da sessão (padrão do Supabase). Na v1, nenhuma ação pede o código de novo |

## Comportamento

1. **Porta única.** `requireAdminContext()` confere, nesta ordem: sessão viva (`getUser`), vínculo em `platform_admins` e `aal2`. A conferência do `aal` lê o claim do token já validado, nunca um valor vindo do client. Sem `aal2`, ela lança um erro próprio (`AdminMfaRequiredError`), distinto do `AdminContextError`, com o motivo: `sem_fator` (nenhum TOTP verificado) ou `desafio_pendente` (tem fator, sessão em `aal1`). O client `service_role` só é criado depois das três checagens.
2. **Layout do `(admin)`.** Trata `sem_fator` com redirect para a tela de cadastro e `desafio_pendente` com redirect para a tela de desafio. As duas telas ficam **fora** do layout protegido, senão o redirect entra em laço. Elas só abrem para quem é de `platform_admins`, com sessão viva. Para quem não é da equipe, o redirect continua sendo para `/dashboard`, como hoje.
3. **Server actions do `(admin)`** passam pela mesma porta: uma action chamada direto, sem passar pela página, também recebe a recusa em `aal1`.
4. **Cadastro.** `mfa.enroll({ factorType: "totp" })` gera o QR code e o segredo em texto (para quem não consegue ler o QR). A pessoa digita o primeiro código e só então o fator vira `verified` e a sessão sobe para `aal2`. Um fator `unverified` abandonado é descartado na próxima tentativa, para não acumular fator pela metade.
5. **Desafio.** Depois do login com senha, quem vai para `/admin` em `aal1` digita o código de 6 dígitos. Com dois fatores, a pessoa escolhe qual usar pelo nome dado no cadastro.
6. **Gestão dos fatores** (dentro do painel, já em `aal2`): listar os fatores pelo nome e pela data, cadastrar o segundo e remover um. Remover o último é recusado pela aplicação, porque a pessoa ficaria trancada fora do próprio painel. Para isso existe o reset manual.
7. **Trilha.** Cadastro e remoção de fator entram em `admin_audit_log` (ações novas, por exemplo `mfa_factor_enrolled` e `mfa_factor_removed`), com o id do fator e sem segredo. O desafio bem-sucedido não entra, porque o login já é rastreado pelo Auth.
8. **Login.** O formulário de login não muda. A diferença vem só depois dele: quem entra em `/admin` em `aal1` cai no desafio. Um admin que também é responsável por uma clínica usa o `/dashboard` em `aal1` normalmente. Já o atalho "Painel interno" leva ao desafio.

## Dado e LGPD

- O segredo do TOTP, o URI `otpauth://`, o QR code e os códigos digitados **nunca** são logados nem gravados pela aplicação. Quem guarda o fator é o Supabase Auth.
- O erro do `mfa.*` não é logado cru: no log vão só o tipo e o código (`lib/security/erro-para-log.ts`).
- A feature não lê nem grava dado de paciente. Ela protege o acesso de suporte, que é por onde a equipe lê esse dado.

## Edge cases

- **Código errado:** mensagem genérica ("Código inválido ou expirado"), sem dizer se o fator existe. O limite de tentativas é o do Supabase Auth. A tela trata o erro de limite com uma mensagem própria, sem repetir o texto do Supabase.
- **Relógio do celular dessincronizado:** se o código for recusado, a tela sugere conferir a hora automática do aparelho.
- **Sessão expira no meio do cadastro:** o fator fica `unverified` e é descartado na próxima tentativa (comportamento 4).
- **Admin removido de `platform_admins` com sessão `aal2` aberta:** a próxima chamada a `requireAdminContext()` recusa, porque o vínculo é conferido antes do `aal`.
- **Logout global ou ban:** a sessão viva cai e o `aal2` cai junto.
- **TOTP desligado no projeto Supabase:** o `enroll` falha e a tela mostra "MFA indisponível, fale com o suporte técnico", sem abrir o painel. Ligar o TOTP é item do `docs/infra-setup.md`.
- **Admin perdeu todos os dispositivos:** reset manual pelo Supabase Dashboard (Authentication → Users → fator), registrado à mão na trilha pelo script ou pelo SQL do passo a passo. No acesso seguinte, a pessoa cadastra o fator de novo.
- **Testes e scripts que usam `requireAdminContext`:** os testes passam a montar sessão `aal2` (fator TOTP de teste verificado no setup) ou mockam a porta. Nenhum teste é afrouxado para aceitar `aal1`.

## Fora do escopo (v1)

- MFA para usuários das clínicas.
- Códigos de recuperação próprios.
- Pedir o código de novo em ação sensível (step-up).
- WebAuthn/passkey e SMS.

## Como medir

- 100% dos membros de `platform_admins` com ao menos um fator `verified`. Conferir pela API de gestão em `auth.mfa_factors`.
- Nenhuma entrada em `admin_audit_log` gerada por sessão `aal1`. O teste garante isso, e não uma métrica.

## Critério de aceite

1. Admin com sessão `aal1` e sem fator, ao abrir qualquer página de `/admin`, cai na tela de cadastro, e o HTML devolvido não traz dado do painel.
2. Admin com fator verificado e sessão `aal1`, ao abrir `/admin`, cai no desafio. Com o código certo, a sessão sobe para `aal2` e o painel abre.
3. Cada server action do `(admin)`, chamada diretamente em `aal1`, é recusada sem efeito no banco e sem entrada na trilha. A cobertura vem de um teste por action, ou de um teste de arquitetura que prova que todas passam por `requireAdminContext()`.
4. `requireAdminContext()` em `aal1` lança `AdminMfaRequiredError` com o motivo correto (`sem_fator` × `desafio_pendente`) e não cria client `service_role`.
5. Usuário que não é da equipe, em `aal1` ou `aal2`, continua indo para `/dashboard` e não alcança as telas de cadastro e de desafio.
6. Código errado devolve a mensagem genérica, e a sessão continua `aal1`.
7. O segundo fator é cadastrado e usado no desafio. Remover o último fator é recusado. Remover um dos dois funciona e entra na trilha.
8. Cadastro e remoção de fator geram entrada em `admin_audit_log` sem segredo, URI ou código. Um teste varre o conteúdo gravado.
9. Nenhum `console.*` do fluxo recebe segredo, URI, código ou o erro cru do `mfa.*`. A guarda de arquitetura cobre isso.
10. Um admin que também é responsável por uma clínica usa `/dashboard` em `aal1` sem desafio.
11. `docs/infra-setup.md` traz como ligar o TOTP no projeto Supabase e o passo a passo do reset manual.
