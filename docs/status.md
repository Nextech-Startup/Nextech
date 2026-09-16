# Status do Projeto — Nextech SaaS

> Atualizado em 2026-09-16. Documento de acompanhamento: o que está pronto, o que falta e o que bloqueia.

## Onde estamos

| Fase | Estado |
|---|---|
| 1 — Specs do MVP | ✅ concluída — 9 specs |
| 2 — Repo, CLAUDE.md, skills | ✅ concluída |
| **3a — Fundação multi-tenant** | 🟡 ~75% |
| **3b — Motor de conversa** | ⬜ spec pronta, nada implementado |
| **3c — Shell de navegação** | ✅ concluída |
| 4 a 10 | ⬜ não iniciadas |

**140 testes passando** · 6 migrations aplicadas · em produção em `app.nextech.ia.br`

---

## Fase 3a — Fundação multi-tenant

### Concluído

- [x] **Infra**: Next 16.3.5 (`npm audit` de 6 vulnerabilidades, 1 crítica, para 0), Vitest 5, Supabase CLI, branch `staging`
- [x] **Migrations**: baseline das tabelas da landing, `clinics` + `clinic_members` com RLS, restrição de coluna, `platform_admins`, `admin_audit_log`, `patients`
- [x] **`requireClinicContext()`** — porta única de resolução de tenant, sem argumento: não há como pedir o contexto de outra clínica
- [x] **Guarda arquitetural** — teste que falha se alguém instanciar client Supabase fora da fachada, ou logar objeto de erro cru
- [x] **Route groups** — landing em `(marketing)`, painel em `(dashboard)` e `(admin)`, com roteamento por hostname
- [x] **Login** — e-mail e senha, com proteção contra open redirect e mensagem genérica (não permite enumerar clientes)
- [x] **`platform_admins`** — superusuário sem furar a RLS das clínicas
- [x] **Painel `(admin)`** — listar clínicas, criar, convidar responsável
- [x] **Trilha de auditoria** — imutável: sem policy de insert, update ou delete para usuário autenticado
- [x] **`lib/clinics/`** — primeira fatia vertical (schema Zod strict, queries, mutations)
- [x] **`patient-v1`** — `patients` com RLS por `clinic_id`, normalização E.164 (o que impede cadastro duplicado do mesmo número), identificação idempotente no primeiro contato, consentimento e opt-out. 47 testes

### Falta

- [ ] **`clinic-profile-v1`** — identidade regulatória, equipe, convênios, procedimentos, política de agendamento, triagem de urgência, consentimento. A maior spec pendente, e a que alimenta o motor de conversa e o de agendamento
- [ ] **`agent-config-v1`** — agente em `draft` com formulário (o preview de conversa é 3b)

---

## Fase 3b — Motor de conversa

Spec escrita em `docs/specs/conversation-engine-v1.md`. Nada implementado.

Decisões já tomadas: retomada da IA por inatividade de 24h; urgência responde o protocolo da própria clínica e escala; qualificação por intenção de agendar; falha de IA escala em silêncio, sem avisar o paciente.

**Bloqueio externo:** credenciais da Meta não existem. Dá para construir e testar com mock, mas WhatsApp real depende de aprovação da Meta — vale iniciar esse processo em paralelo, porque não trava código.

---

## Fase 3c — Shell de navegação

Desenho em `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`. **Implementada** — 29 testes.

- [x] **`lib/navigation/`** — o mapa das rotas como dado, separado do markup: quais itens existem, quem vê cada um e o que já foi construído. Testável sem renderizar React
- [x] **Sidebar do painel da clínica** — três grupos, filtrados pelo `role` que `requireClinicContext()` já devolve, sem consulta nova
- [x] **Itens "em breve"** — telas desenhadas e não construídas aparecem inertes: não são link, não recebem foco de teclado, nunca acendem como rota atual
- [x] **Sidebar do painel interno** — seis itens, mesmo tratamento
- [x] **Cabeçalho nos dois painéis** — identificação, papel e "Sair"
- [x] **Atalho entre os painéis** — `isPlatformAdmin()` e `hasClinic()`, checagens de interface que não lançam e não criam client de `service_role`

Duas coisas que o desenho não previa, resolvidas na implementação:

- `professional` não vê "Visão geral", que é a raiz do painel. `primeiraRotaVisivel()` responde para onde cada papel entra, e `/dashboard` mostra estado próprio ao profissional em vez de KPIs que o menu nega
- `ClinicContext` passa a expor o `email`, que vinha do mesmo `getUser()` e estava sendo descartado

Mobile ficou na faixa empilhada acima do conteúdo, não em gaveta — o desenho deixou mobile em aberto à espera de uso real.

---

## Acessos

| Conta | Credencial | Onde entra |
|---|---|---|
| Equipe Nextech | `admin@nextech.ia.br` / `NextechAdmin2026` | `app.nextech.ia.br/admin` |
| Clínica (owner) | `clinica@nextech.ia.br` / `NextechClinica2026` | `app.nextech.ia.br/dashboard` |

---

## Pendências

### Precisam de ação do Jhones

- [ ] **DNS de `nextech.ia.br` sem `www`** — não resolve. Precisa de registro `A` para `76.76.21.21` ou o ALIAS que a Vercel indicar; CNAME não funciona em domínio raiz
- [ ] **Proteção de deployment do `staging`** — hoje exige login da Vercel (302 para SSO). Desativar em Settings → Deployment Protection, se quiser acesso direto
- [ ] **Credenciais da Meta** — iniciar o processo, que leva tempo e não trava código

- [ ] **Revisar o PR #4** — fase 3c, shell de navegação. Aberto, Vercel verde, aguardando aprovação

### Dívida técnica conhecida

- [ ] **Staging escreve no banco de produção** — há um único projeto Supabase. Aceitável até o primeiro cliente real, não depois
- [ ] **`patients.insurance_id` sem FK** — aponta para `insurances`, que só nasce em `clinic-profile-v1`. Vira um `alter table ... add constraint` de uma linha quando a tabela existir
- [ ] **`professional` vê todos os pacientes da clínica** — a policy de `patients` não estreita por profissional porque o vínculo paciente ↔ profissional não existe na v1. Apertar depois é seguro; afrouxar não seria
- [ ] **Tabela `projetoAtivo`** — existe no banco, nenhum código a referencia. Resíduo ou uso externo? Mantida na baseline com nota
- [ ] **Convite mostra senha na tela** — o `(admin)` exibe a senha provisória porque o Resend não está configurado. Vira convite por e-mail quando estiver
- [ ] **`admin_audit_log` precisa de justificativa** — a fase 3c decidiu que ver conversa de paciente exige motivo registrado. Estende a tabela com `conversation.view` e campo de justificativa

---

## Decisões que valem lembrar

- **Fase 3 foi dividida** em 3a (fundação), 3b (motor de conversa) e 3c (navegação). O motor era o único subsistema sem spec e aparecia como dependência em 6 das 8 specs originais
- **Supabase Auth**: signup público estava **aberto** — qualquer pessoa criava conta com a anon key, que é pública. Fechado em 2026-09-16. Usuário novo só nasce por `service_role`
- **`chatbot_leads` já tinha RLS** — a suspeita anterior de PII exposta estava errada
- **npm é o gerenciador** — o `pnpm-lock.yaml` era vestígio vazio do scaffold, removido

---

## Intencionalmente adiado

- Contrato controlador/operador de LGPD entre Nextech e cada clínica — jurídico, corre em paralelo
- Operação do SLA do plano HealthTech — só importa com cliente pagante nesse plano
- Preço final dos planos — decisão de negócio; a definição técnica de "atendimento" já existe
- Mobile, busca global, notificações, rede com múltiplas unidades — dependem de uso real para serem decididos bem
