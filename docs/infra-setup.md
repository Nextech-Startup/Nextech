# Checklist de infraestrutura — Nextech

Contas e configuração fora do código. Nada disso o Claude Code resolve sozinho — é setup manual em cada plataforma, antes ou durante a implementação das specs correspondentes.

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

## Automação: tudo em código, sem ferramenta externa
Não existe n8n no projeto. A conta foi encerrada em 2026-09-16 e a última referência em código (o webhook do chatbot da landing) foi removida na mesma data — junto com a dependência `axios`, que só existia para ele.

Toda automação — webhook, orquestração de IA, agendamento, billing, e-mail — é código Next.js neste repositório, conforme a regra 5 do `CLAUDE.md`. Job agendado é Vercel Cron em `app/api/cron/*`. Não reintroduzir ferramenta de automação externa sem revisar essa regra.

## Gerenciador de pacotes: npm
Decidido em 2026-09-16. O repositório tinha `package-lock.json` e `pnpm-lock.yaml` ao mesmo tempo; o do pnpm tinha 4 linhas, nenhuma dependência, e não era tocado desde o primeiro commit — vestígio do scaffold inicial. Foi removido.

O lockfile válido é o `package-lock.json`. Usar sempre `npm` — misturar gerenciador reintroduz o conflito e faz a Vercel instalar a árvore errada.

