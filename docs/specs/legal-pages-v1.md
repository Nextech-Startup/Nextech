# Spec: Páginas legais da landing (v1)

## Por que isso existe
O App Review do Tech Provider na Meta exige a URL da política de privacidade, e o app só sai do modo de desenvolvimento com ela. A Meta também pede uma URL de instruções de exclusão de dados. Hoje o site não tem nenhuma das duas: o rodapé mostra "Privacidade", "Termos", "Segurança" e "Cookies" como rótulos inertes (`components/footer.tsx`).

Além da Meta, a LGPD já obriga a política: o chatbot da landing grava nome, e-mail e WhatsApp em `chatbot_leads`, e o produto trata dado de saúde de pacientes em nome das clínicas.

## Objetivo
Publicar três páginas na landing, com texto de LGPD escrito a partir do que o produto **realmente faz hoje**:
- `/privacidade`: política de privacidade, com as seções `#cookies` e `#seguranca`;
- `/termos`: termos de uso do serviço (clínicas contratantes) e do site;
- `/exclusao-de-dados`: como pedir a exclusão, por tipo de titular.

O texto é um rascunho para a revisão do Jhones, idealmente com um advogado antes da primeira clínica. Ele não substitui essa revisão.

## Decisões (Jhones, 2026-10-12)
0. **Identidade:** nome empresarial `65.406.075 JHONES BONIFACIO DA SILVA`, CNPJ `65.406.075/0001-12` (matriz, inscrito em 02/03/2026), com o nome comercial Nextech. O encarregado é Jhones Bonifacio da Silva, grafado como no CNPJ. Sede em Recife/PE: as páginas publicam só a cidade/UF, não o endereço completo, e o foro dos termos é a comarca de Recife/PE.
1. **Encarregado (DPO):** o Jhones, dono da empresa, com o e-mail `contato@nextech.ia.br`, a caixa que já existe no Zoho. A escolha inicial era um alias `privacidade@`, mas o Jhones ficou com o `contato@`. Um alias pode entrar depois, trocando só o e-mail no texto.
2. **Leads do chatbot:** guardados por até 12 meses e apagados antes, se a pessoa pedir. A tabela só tem `created_at`, então a exclusão automática conta 12 meses a partir dele. Isso nunca guarda mais do que a política promete.
3. **Rodapé:** "Privacidade" e "Termos" viram links. "Cookies" e "Segurança" apontam para `/privacidade#cookies` e `/privacidade#seguranca`. São quatro links para três páginas; a de exclusão é linkada pela política, na seção de direitos.
4. **Termos:** um documento só, para o serviço e para o site.

## Comportamento

### 1. Regra de ouro do texto
Toda afirmação de fato (fornecedor, medida de segurança, prazo, mecanismo) precisa ter fonte no código ou numa decisão registrada. Nada de prometer o que não existe: MFA, retenção configurável de conversas, DPA assinado, certificação. A tabela abaixo é a fonte da verdade, e a sessão de implementação confere cada linha no código antes de escrever.

| Afirmação | Fonte |
|---|---|
| Conteúdo das mensagens cifrado em repouso, com chave própria e amarrado à clínica | `lib/conversations` (cifra), `MESSAGE_CONTENT_ENCRYPTION_KEY` |
| Credenciais das clínicas (token do WhatsApp) cifradas em repouso | `TENANT_SECRETS_ENCRYPTION_KEY`, regra 8 do `CLAUDE.md` |
| Isolamento por clínica no banco (RLS por `clinic_id`) e sessão viva | migrations; regra 2 do `CLAUDE.md` |
| Logs sem conteúdo de mensagem nem dado de paciente | `lib/security` (erro só com tipo e código), regra 3 do `CLAUDE.md` |
| Acesso de suporte só com justificativa e prazo, registrado na trilha de auditoria | `/admin/audit`, `docs/specs/admin-audit-v1.md` |
| IA: o conteúdo vai ao modelo só para gerar a resposta, sem retenção e sem treino | `lib/ai/client.ts` (`data_collection: "deny"`, `zdr: true`) |
| Exclusão do paciente redige o conteúdo das conversas | `feat(patients): exclusão redige o conteúdo das conversas do paciente` |
| Opt-out do paciente vale na hora e em todas as sequências | regra 8 da skill `lgpd-security`, recepção em `lib/conversations` |
| Urgência escala para um humano da clínica | `feat(conversations): urgência escala a conversa` |
| Analytics da landing agregado e sem cookie | `@vercel/analytics` em `app/layout.tsx` |

### 2. `/privacidade`
Seções, nesta ordem:
1. **Quem somos:** nome empresarial, CNPJ, Recife/PE e o nome comercial Nextech (decisão 0) e o encarregado com `contato@nextech.ia.br`.
2. **Os dois papéis da Nextech:**
   - *controladora* dos dados de visitantes, leads e usuários do painel (a equipe da clínica);
   - *operadora* dos dados dos pacientes, tratados em nome da clínica, que é a controladora. Pedidos de paciente vão primeiro para a clínica; se chegarem à Nextech, são encaminhados a ela.
3. **Que dados tratamos, por grupo:**
   - visitante: métricas agregadas de acesso, sem cookie;
   - lead do chatbot: nome, e-mail, WhatsApp, clínica, especialidade e volume de consultas;
   - usuário do painel: nome, e-mail, papel e registros de acesso;
   - paciente: telefone, nome do perfil do WhatsApp, conteúdo das mensagens, status de entrega, sinal de urgência, opt-out e consentimento.
4. **Finalidades e bases legais:**
   - lead: procedimentos preliminares de contrato (art. 7º, V);
   - usuário: execução de contrato (art. 7º, V);
   - paciente: base definida pela clínica controladora (dado sensível de saúde, art. 11). A Nextech só trata conforme as instruções da clínica.
5. **Inteligência artificial e decisões automatizadas:** o que o assistente decide (responder, qualificar o interesse em agendar, sinalizar urgência), que o conteúdo vai ao modelo sem retenção nem treino, e que o paciente pode pedir atendimento humano a qualquer momento, com a clínica assumindo a conversa (art. 20).
6. **Com quem compartilhamos:** só os fornecedores **em uso na data da publicação**, cada um com a finalidade e o país. Hoje são: Supabase (banco, EUA), Vercel (hospedagem e analytics, EUA), OpenRouter e Google (modelo de IA, EUA), Meta (WhatsApp Business Platform) e Zoho (e-mail da equipe, que recebe os pedidos de titular). Resend, Google Calendar e Asaas entram no texto quando a integração deles entrar no código.
7. **Transferência internacional (art. 33):** os dados ficam em servidores nos EUA. O texto diz isso sem citar instrumento que não exista; o fundamento jurídico exato fica para a revisão do advogado.
8. **Por quanto tempo guardamos:**
   - leads: até 12 meses;
   - conta do painel: enquanto durar o contrato, mais os prazos legais;
   - dados de pacientes: enquanto a clínica for cliente, apagados ou redigidos a pedido dela.
9. **Seus direitos (art. 18):** como exercer pelo `contato@nextech.ia.br`, prazo de resposta de até 15 dias (art. 19, II), link para `/exclusao-de-dados` e o direito de reclamar à ANPD.
10. **`#cookies`:** o painel usa só os cookies essenciais da sessão de login. A landing não usa cookie de rastreio. Preferências locais, como o tema, ficam só no navegador. A implementação confere o que de fato é gravado antes de escrever.
11. **`#seguranca`:** as medidas da tabela da seção 1, em linguagem simples.
12. **Alterações e data:** "Última atualização: dd/mm/aaaa", com a data da publicação.

### 3. `/termos`
1. Partes e objeto: assistente de IA no WhatsApp para clínicas.
2. Conta e papéis: o responsável da clínica, a equipe e a guarda da senha.
3. Planos e limites: Starter, Pro e HealthTech, com limites por plano e cobrança pelo provedor de pagamento indicado na contratação.
4. Obrigações da clínica:
   - ser a controladora dos dados dos pacientes e ter base legal para tratá-los;
   - informar os pacientes sobre o atendimento automatizado;
   - usar número próprio;
   - manter o perfil verdadeiro;
   - cumprir as políticas do WhatsApp Business.
5. Limites da IA: o assistente não substitui o profissional de saúde, não faz diagnóstico e não é canal de emergência. O protocolo de urgência encaminha, não faz triagem clínica.
6. Dependência de terceiros: a Meta pode limitar ou suspender um número por regra própria.
7. Disponibilidade: o texto não promete SLA.
8. Propriedade intelectual.
9. Limitação de responsabilidade.
10. Suspensão e encerramento, com o destino dos dados ao fim do contrato.
11. Proteção de dados: remete à política e ao papel de operadora.
12. Alterações, lei aplicável (brasileira) e foro da comarca de Recife/PE.

### 4. `/exclusao-de-dados`
Instruções por tipo de titular, sempre pelo `contato@nextech.ia.br`, com prazo de até 15 dias e confirmação por e-mail:
- **Clínica:** pedir a exclusão da conta e dos dados obtidos pela Meta (ID do WhatsApp Business, ID do número, token de acesso). Ela também pode remover o app da Nextech nas configurações do portfólio na Meta. Se existir no painel uma ação de desconectar o WhatsApp na data da implementação, a página cita esse caminho; se não existir, não cita.
- **Paciente:** pedir à clínica que o atende. Se o pedido chegar à Nextech, ele é encaminhado à clínica. Na exclusão, o conteúdo das conversas é redigido.
- **Lead:** pedir por e-mail, e a linha de `chatbot_leads` é apagada.

O pedido precisa de verificação mínima de identidade: o e-mail da conta, o telefone do contato ou outro dado que só o titular tenha.

### 5. Rodapé
Em `components/footer.tsx`, os quatro rótulos de "Legal" viram `Link` (do `next/link`):
- Privacidade → `/privacidade`;
- Termos → `/termos`;
- Segurança → `/privacidade#seguranca`;
- Cookies → `/privacidade#cookies`.

As colunas "Recursos" e "Empresa" continuam inertes; o resto do rodapé não muda.

### 6. Estrutura e visual
- Rotas em `app/(marketing)/privacidade`, `app/(marketing)/termos` e `app/(marketing)/exclusao-de-dados`, estáticas (sem dado dinâmico) e com o tema da landing (skill `ui-ux`).
- Cada página tem um cabeçalho simples (logo com link para a home) e o `Footer`. A `Navbar` da landing não entra, porque os links dela rolam até seções que só existem na home.
- Os links de seção do rodapé ("Soluções", "Planos"…) precisam funcionar fora da home, levando a `/#Solucoes` e equivalentes.
- Texto em prosa legível, com largura de leitura limitada e títulos com âncora.
- `metadata` própria (título, descrição e canonical em `https://www.nextech.ia.br/...`), indexável. Se houver `sitemap`, as três rotas entram nele.

### 7. Exclusão automática dos leads
Uma migration nova agenda pelo `pg_cron` uma função SQL diária que apaga as linhas de `chatbot_leads` com `created_at` anterior a 12 meses. É job só de banco, então fica no pg_cron sem passar pela aplicação (padrão do `CLAUDE.md`). A migration roda com `--dry-run` antes.

## Edge cases
- **Domínio sem `www`:** `nextech.ia.br` não resolve (pendência em `docs/status.md`). As URLs dadas à Meta usam `https://www.nextech.ia.br/...`.
- **Host do painel:** em `app.nextech.ia.br`, as três rotas também precisam abrir. O middleware só redireciona a raiz, e o teste confere isso.
- **Âncora:** `/privacidade#cookies` e `/privacidade#seguranca` rolam até a seção certa, também vindas de outra página.
- **Fornecedor novo:** quando Resend, Google Calendar, Asaas ou um CRM entrarem no código, a política muda no mesmo PR. Essa regra entra na skill `lgpd-security`, como item de revisão.
- **Lead sem `created_at`:** a coluna tem default, mas aceita nulo. A função trata o nulo como antigo e apaga a linha.

## Segurança e LGPD (`lgpd-security`)
- As páginas não leem nem gravam dado. O único código com dado pessoal é a exclusão de leads, e ela só apaga.
- O texto não pode expor detalhe que ajude um ataque (nome de tabela, algoritmo com parâmetro, região exata do banco). Ele diz o que é protegido, não como.
- O `security-reviewer` confere a tabela da seção 1 contra o código antes do commit final.

## Fora desta spec
- Banner de cookies: não é necessário sem cookie não essencial. Se a landing ganhar pixel ou analytics com cookie, o banner vem junto.
- DPA (acordo de tratamento) assinado com cada clínica.
- Retenção configurável de conversas por clínica (regra 5 da `lgpd-security`): ainda não existe e não entra no texto.
- Callback de exclusão de dados da Meta (`signed_request`): a URL de instruções basta para a Meta.
- Versão em inglês.

## Planos afetados
Nenhum. As páginas são públicas.

## Specs afetadas
Nenhuma. A regra de fornecedor novo muda a skill `lgpd-security`.

## Dependências (ação do Jhones)
1. ~~Razão social, CNPJ e nome do encarregado~~: recebidos (decisão 0).
2. ~~Cidade/UF da sede e foro~~: Recife/PE, só a cidade na página (decisão 0).
3. Revisão do texto, idealmente com advogado antes da primeira clínica.
4. Depois do deploy, as três URLs nos campos do app na Meta (Configurações do app > Básico).

## Critério de aceite
1. `/privacidade`, `/termos` e `/exclusao-de-dados` respondem 200 em `www.nextech.ia.br` e em `app.nextech.ia.br`, sem redirecionar para o login.
2. As quatro entradas de "Legal" no rodapé são links com os destinos da seção 5. Na home, nada mais no rodapé muda.
3. `/privacidade#cookies` e `/privacidade#seguranca` existem como `id` no HTML e rolam até a seção.
4. Cada página tem `title`, `description` e canonical próprios. Se existir `sitemap`, as três rotas estão nele.
5. Nas duas larguras (390 px e 1440 px) e nos dois temas, não há rolagem horizontal.
6. O texto não tem nenhum placeholder ("[CNPJ]", "XX"): a identidade da seção 2.1 está preenchida.
7. Cada afirmação de fato da política está na tabela da seção 1, e o `security-reviewer` conferiu a tabela contra o código.
8. A lista de fornecedores bate com o que o código usa na data da publicação. Nenhum fornecedor sem código aparece como em uso.
9. Migration da exclusão de leads, testada contra o banco: apaga a linha com `created_at` de 12 meses e 1 dia, mantém a de 11 meses e 29 dias, apaga a de `created_at` nulo, e o job aparece em `cron.job`.
10. A suíte inteira e o build passam.

## Como medir
- A Meta aceita as URLs nos campos do app, e o App Review não volta por causa da política.
- Todo pedido que chega em `contato@` é respondido em até 15 dias.
