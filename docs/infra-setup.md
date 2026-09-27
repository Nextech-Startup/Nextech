# Checklist de infraestrutura — Nextech

Contas e configuração fora do código. Nada disso o Claude Code resolve sozinho — é setup manual em cada plataforma, antes ou durante a implementação das specs correspondentes.

## Domínios e ambientes (definido em 2026-09-16)

| Ambiente | Domínio | O que serve |
|---|---|---|
| Landing (produção) | `https://www.nextech.ia.br` | Site público, route group `(marketing)` |
| Painel (produção) | `https://app.nextech.ia.br` | `(dashboard)` e `(admin)` |
| Painel (staging) | `https://staging.nextech.ia.br` | Mesma build, branch `staging` |

Os três saem do **mesmo projeto Vercel e do mesmo repositório** — são domínios apontando para a mesma aplicação, não deploys separados. O route group decide o que responde em cada caminho.

Pendências que decorrem disso:
- [ ] Apontar `app` e `staging` como domínios do projeto na Vercel (`staging` fixado na branch `staging`).
- [ ] `NEXT_PUBLIC_SITE_URL` por ambiente: `www` em Production, `staging` em Preview. Sem isso, link absoluto e metadata de OG do painel apontam para o domínio errado.
- [ ] **Staging precisa de banco próprio.** Hoje existe um único projeto Supabase, compartilhado com a landing em produção. Enquanto for assim, `staging.nextech.ia.br` escreve no banco de produção — aceitável só enquanto não houver clínica real cadastrada.
- [ ] Decidir a redirect URL de OAuth do Supabase Auth por ambiente (o login precisa voltar para o domínio de origem, não sempre para produção).
- [ ] DNS: `app` e `staging` como CNAME para a Vercel, sem colidir com o MX do Zoho nem com o subdomínio de envio do Resend.

## Variáveis de ambiente
O template versionado é o `.env.example` na raiz — lista toda chave que o produto usa, sem nenhum valor real. Fluxo: copiar para `.env` e preencher localmente; na Vercel, configurar as mesmas chaves por ambiente (Production / Preview / Development).

Duas classes de segredo, que não se misturam:
- **Infraestrutura** (env): credencial do *app* Nextech — `WHATSAPP_APP_SECRET`, `GOOGLE_CLIENT_SECRET`, `OPENROUTER_API_KEY`, `ASAAS_API_KEY`.
- **Por tenant** (banco, cifrado): credencial que pertence a *uma clínica* — token do WhatsApp dela, refresh token do Google Calendar dela, futura chave de CRM. Nunca em env, porque é um valor por clínica. Cifrado com `TENANT_SECRETS_ENCRYPTION_KEY` (regra 8 do CLAUDE.md).

## Supabase (banco + auth)
**Correção de 2026-09-16:** o projeto Supabase **já existe e está em produção** — `app/api/chatbot/route.ts` grava leads da landing na tabela `chatbot_leads`. O registro anterior de "criar o projeto Supabase" estava errado; o que faltava era a chave no `.env` local, não o projeto. Isso deixa de bloquear a fase 3.

- [x] Projeto Supabase criado e em uso pela landing.
- [x] Preencher `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` local (feito em 2026-09-16).
- [ ] Gerar o `SUPABASE_ACCESS_TOKEN` em Account > Access Tokens e preencher no `.env`. É o que autentica `supabase link` e `supabase db push` sem login interativo, inclusive no CI. Token de **conta**, não de projeto: vale para todo projeto que a conta acessa — tratar com o mesmo cuidado da `service_role`.
- [ ] Configurar as mesmas chaves na Vercel, por ambiente (Production / Preview / Development).
- [ ] Confirmar a região do projeto existente. Se não for São Paulo, decidir conscientemente: migrar de região é trocar de projeto, e fica mais caro depois que houver dado de paciente.
- [ ] Auditar a tabela `chatbot_leads` que já existe: tem RLS? Ela guarda nome, e-mail e WhatsApp de lead — é PII, mesmo sem ser dado de saúde.
- [ ] Instalar a Supabase CLI e rodar `supabase init` para versionar migrations em `supabase/migrations/`.
- [ ] **Importar o schema que já existe** para a primeira migration (`supabase db pull`), antes de criar tabela nova. Sem isso as migrations partem de um banco que não corresponde ao real.
- [ ] Decidir se o teste de RLS roda contra um projeto Supabase separado de staging ou contra instância local da CLI — a segunda opção evita custo e deixa o CI offline. **Recomendação:** CLI local, pelo `supabase db reset` entre suítes e por não arriscar dado real.

## OpenRouter (IA)
- [ ] Criar conta, gerar API key.
- [ ] Confirmar acesso ao modelo Gemini 2.5 Flash pela API.
- [ ] Confirmar o percentual de margem que o OpenRouter cobra sobre o preço do provedor — entra na conta de custo por atendimento, junto com o custo do WhatsApp (ver skill `lgpd-security` e `integrations`).
- [ ] Verificar sintaxe atual de cache de prompt pro Gemini via OpenRouter, se for usar (mecanismo diferente do `cache_control` da Anthropic).
- [ ] Na Vercel, nos três ambientes: `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` (hoje `google/gemini-2.5-flash`). O client (`lib/ai/client.ts`, motor de conversa, parte 2) não tem valor padrão: sem as duas, toda resposta da IA falha e a conversa passa para a equipe.
- [ ] Na conta do OpenRouter, em Privacy, ligar a retenção zero (ZDR) do grupo de modelos Google, como segunda camada. O código já exige `data_collection: "deny"` e `zdr: true` em toda chamada. Pela documentação conferida em 2026-09-27, o Gemini tem endpoint ZDR pelo Vertex (o AI Studio não tem).
- [ ] Na conta do OpenRouter, conferir que o registro de prompts e respostas (logging de input/output) está desligado. O conteúdo é dado de saúde.
- [ ] Na primeira chamada real, conferir que o modelo configurado responde com `zdr: true`. Se nenhum endpoint do modelo tiver ZDR, a chamada falha, e é preciso escolher outro modelo, e não tirar o `zdr`.

## Resend (e-mail transacional)
- [ ] Criar conta.
- [ ] Verificar um **subdomínio dedicado** (ex: `mail.nextech.ia.br`) para envio transacional — não usar o domínio raiz que também recebe e-mail humano via Zoho.
- [ ] Configurar DKIM/SPF do subdomínio conforme instruções do Resend.

## Zoho Mail (e-mail profissional/humano)
- [ ] Criar e-mail profissional (ex: contato@nextech.ia.br ou substituto do `nextech.reunioes@gmail.com` atual do site).
- [ ] Configurar MX/SPF/DKIM no registrador do domínio `nextech.ia.br`.
- [ ] **Coordenar SPF com o Resend**: se os dois usarem o domínio raiz, o registro SPF precisa incluir os dois `include:`. Recomendado usar subdomínio dedicado pro Resend (item acima) pra evitar esse problema e isolar reputação de envio.

## Google Calendar API
- [ ] Criar projeto no Google Cloud, ativar a Calendar API.
- [ ] Configurar tela de consentimento OAuth (OAuth consent screen).
- [ ] Confirmar escopo de permissão mínimo necessário (leitura de disponibilidade + criação de evento).
- [ ] Cada clínica autoriza o próprio calendário — não existe uma conta Google única do Nextech (ver skill `integrations`).

## Meta / WhatsApp (referência — já coberto em detalhe na skill `integrations`)
- [ ] App do Nextech registrado na Meta com permissão de Embedded Signup (fluxo com coexistência).
- [ ] Permissões `whatsapp_business_messaging` e `whatsapp_business_management` com advanced access.

### Quando as credenciais chegarem (webhook já construído contra mock)
O webhook está em `app/api/whatsapp/webhook` desde a parte 1 do motor de conversa (2026-09-27), testado com payloads no formato documentado da Meta.
- [ ] No app da Meta, apontar o webhook para `https://<domínio>/api/whatsapp/webhook`.
- [ ] Assinar os campos `messages`, `smb_message_echoes` (eco da coexistência) e `account_update` (desconexão e reconexão).
- [ ] Na Vercel, nos três ambientes:
  - `WHATSAPP_APP_SECRET`: o app secret, que confere o `X-Hub-Signature-256`;
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: um valor aleatório, o mesmo que vai no campo "Verify token" da Meta;
  - `MESSAGE_CONTENT_ENCRYPTION_KEY`: cifra o conteúdo das mensagens em repouso. Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Uma chave por ambiente, e nunca trocar sem re-cifrar**: a mensagem cifrada com a chave antiga deixa de abrir.
  - `WHATSAPP_API_VERSION` (hoje `v21.0`): versão da Graph API, usada no envio e na prova de posse do número. Sem ela, a IA não envia, e conectar um número falha com "A conexão com a Meta ainda não está configurada".
- [ ] O campo `messages` também traz os status de entrega (`statuses`), que a parte 2 grava na resposta da IA. Não há campo extra para assinar.
- [ ] **Conectar um número agora exige credencial real:** desde a parte 2, `connectWhatsapp` confere na Graph API, com o token informado, que o número pertence ao WABA (prova de posse, achado S1). IDs inventados deixam de conectar, também em staging.
- [ ] Mandar uma mensagem real para o número de teste e conferir, no Supabase, a linha em `messages` com `content_encrypted` preenchido e, uns 10 s depois, a resposta da IA com `delivery_status = sent`.

## Automação: tudo em código, sem ferramenta externa
Não existe n8n no projeto. A conta foi encerrada em 2026-09-16 e a última referência em código (o webhook do chatbot da landing) foi removida na mesma data — junto com a dependência `axios`, que só existia para ele.

Toda automação — webhook, orquestração de IA, agendamento, billing, e-mail — é código Next.js neste repositório, conforme a regra 5 do `CLAUDE.md`. Job agendado é Vercel Cron em `app/api/cron/*`. Não reintroduzir ferramenta de automação externa sem revisar essa regra.

## Gerenciador de pacotes: npm
Decidido em 2026-09-16. O repositório tinha `package-lock.json` e `pnpm-lock.yaml` ao mesmo tempo; o do pnpm tinha 4 linhas, nenhuma dependência, e não era tocado desde o primeiro commit — vestígio do scaffold inicial. Foi removido.

O lockfile válido é o `package-lock.json`. Usar sempre `npm` — misturar gerenciador reintroduz o conflito e faz a Vercel instalar a árvore errada.

