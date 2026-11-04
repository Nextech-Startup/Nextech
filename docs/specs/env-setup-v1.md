# Spec: Preenchimento das variáveis de ambiente (v1)

> Escrita em 2026-11-04 a partir do código (o que `process.env` realmente
> lê), do `.env.example` e do `docs/infra-setup.md`. Não muda código: é o
> roteiro para obter cada valor, preencher o `.env` local e configurar os
> três ambientes da Vercel. Os passos das plataformas foram conferidos em
> nov/2026; painel de terceiro muda, e quando um caminho não bater, vale a
> documentação oficial linkada em cada seção.

## Por que isso existe
O `.env.example` lista 30 chaves. Hoje 18 estão preenchidas no `.env` local
e 12 estão vazias, e não está escrito em lugar nenhum quais delas o produto
já usa, quais podem esperar e qual valor vai em cada ambiente. Duas
armadilhas tornam isso mais do que um checklist:

1. **Três chaves vazias não fazem falta hoje** (Resend, Google, Asaas): nenhum
   código as lê ainda. Preencher agora não liga nada.
2. **As chaves de cifra precisam ser iguais em todo lugar que fala com o
   mesmo banco.** Staging, produção e o `.env` local usam hoje o mesmo
   projeto Supabase (`docs/infra-setup.md`, "Staging precisa de banco
   próprio"). Um token cifrado por um ambiente com uma chave não abre no
   outro. Ver "Chaves de cifra", abaixo: isso corrige o "uma chave por
   ambiente" escrito no `infra-setup.md`.

## Inventário

Legenda da coluna **Hoje no `.env` local**: ✅ preenchida, ⬜ vazia.
**Quem lê**: o arquivo que lê a variável no código, ou "ninguém ainda".

| Variável | Para quê | Hoje no `.env` local | Quem lê | Quando precisa |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL canônica (OG, link absoluto) | ✅ | `lib/site-url.ts` | já |
| `NEXT_PUBLIC_APP_URL` | Botão Login da landing | ✅ | `components/navbar.tsx` | já |
| `NEXT_PUBLIC_SUPABASE_URL` | Banco e Auth | ✅ | `lib/supabase/*` | já |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Banco e Auth (navegador) | ✅ | `lib/supabase/*` | já |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook, jobs, admin (ignora RLS) | ✅ | `lib/supabase/server.ts` | já |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI e API de gestão | ✅ | só a CLI e os scripts | só local e CI |
| `SUPABASE_DB_PASSWORD` | Supabase CLI (`db push`) | ✅ | só a CLI | só local e CI |
| `OPENROUTER_API_KEY` | Modelo da IA | ✅ | `lib/ai/client.ts` | já |
| `OPENROUTER_MODEL` | Qual modelo | ✅ | `lib/ai/client.ts` | já |
| `TENANT_SECRETS_ENCRYPTION_KEY` | Cifra token de clínica | ✅ | `lib/security/tenant-secrets.ts` | já |
| `MESSAGE_CONTENT_ENCRYPTION_KEY` | Cifra conteúdo de mensagem | ✅ | `lib/conversations/conteudo.ts` | já |
| `WHATSAPP_API_VERSION` | Versão da Graph API | ✅ (`v21.0`, **trocar**) | `lib/whatsapp/client.ts`, `midia.ts` | já |
| `WHATSAPP_APP_SECRET` | Confere a assinatura do webhook | ⬜ | `app/api/whatsapp/webhook` | **para ligar a Meta** |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Handshake do webhook | ⬜ | `app/api/whatsapp/webhook` | **para ligar a Meta** |
| `WHATSAPP_APP_ID` | Embedded Signup | ⬜ | ninguém ainda | quando vier o Embedded Signup |
| `RESEND_API_KEY` | E-mail transacional | ⬜ | ninguém ainda | spec de e-mail / agendamento |
| `RESEND_FROM_EMAIL` | Remetente | ⬜ | ninguém ainda | idem |
| `GOOGLE_CLIENT_ID` | OAuth do Calendar | ⬜ | ninguém ainda | fase 5 (agendamento) |
| `GOOGLE_CLIENT_SECRET` | OAuth do Calendar | ⬜ | ninguém ainda | fase 5 |
| `GOOGLE_OAUTH_REDIRECT_URI` | Volta do OAuth | ⬜ | ninguém ainda | fase 5 |
| `ASAAS_API_KEY` | Cobrança | ⬜ | ninguém ainda | fase 7 (billing) |
| `ASAAS_ENV` | `sandbox` ou `production` | ✅ (`sandbox`) | ninguém ainda | fase 7 |
| `ASAAS_WEBHOOK_TOKEN` | Confere o webhook do Asaas | ⬜ | ninguém ainda | fase 7 |
| `EVOLUTION_*` (7 chaves) | Canal de demonstração | ✅ | `lib/whatsapp/evolution*.ts`, scripts | **só local, nunca na Vercel** |

**Ordem recomendada:** (1) trocar a versão da Graph API; (2) Meta: app secret
e verify token, que ligam o webhook; (3) conferir a Vercel; (4) Resend, que
leva dias por causa do DNS; (5) Google, que leva semanas por causa da
verificação do escopo; (6) Asaas, que é rápido e pode ficar para a fase 7.
Os itens 4 e 5 valem começar antes de serem usados justamente pela espera.

Para ver o estado do `.env` sem mostrar nenhum valor:

```bash
awk -F= '/^[A-Z0-9_]+=/{ v=substr($0, index($0,"=")+1); print $1, (length(v)>0 ? "PREENCHIDA" : "vazia") }' .env
```

---

## 1. Versão da Graph API — `WHATSAPP_API_VERSION`
A `v21.0` sai do ar em **21/01/2027**. Depois disso a Meta roda a chamada na
versão mais antiga ainda viva, sem erro, e o comportamento muda em silêncio.

1. No `.env` local: `WHATSAPP_API_VERSION=v25.0`.
2. Na Vercel, nos três ambientes, o mesmo valor.

`v25.0` porque é a versão da documentação usada no client dos templates
(mai/2026) e vale até jul/2028. A `v26.0` (jul/2026) também serve; trocar de
versão não pede mudança de código, só reconferir o changelog.

## 2. Meta / WhatsApp

### `WHATSAPP_APP_ID` e `WHATSAPP_APP_SECRET`
1. Entrar em [developers.facebook.com](https://developers.facebook.com) > **My Apps** > o app do Nextech (o do portfólio da Nextech, nunca o de outro projeto).
2. **App settings > Basic** (Configurações do app > Básico).
3. **App ID**: copiar para `WHATSAPP_APP_ID`.
4. **App secret**: clicar em **Show**, confirmar a senha do Facebook, copiar para `WHATSAPP_APP_SECRET`.
5. O app secret assina todo POST do webhook (`X-Hub-Signature-256`). Quem tem ele forja mensagem de paciente: nunca em print, chat ou log. Se vazar, **Reset** no mesmo lugar e trocar em todos os ambientes.

### `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
Valor escolhido por você, não vem da Meta. Gerar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

É diferente do app secret e do token de acesso. Pode ser o mesmo nos três ambientes (só serve para o handshake), mas um por ambiente é melhor.

### Ligar o webhook (depois de as duas acima estarem na Vercel)
1. No app: **WhatsApp > Configuration** > **Webhook** > **Edit**.
2. **Callback URL**: `https://app.nextech.ia.br/api/whatsapp/webhook` (produção). Para testar em staging antes: `https://staging.nextech.ia.br/api/whatsapp/webhook`, desde que a proteção de deployment do staging esteja desligada (`docs/status.md`, pendência da Vercel), senão a Meta recebe 302.
3. **Verify token**: o mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` daquele ambiente. **Verify and save**. Se der erro, o deploy ainda não tem a variável (redeploy depois de criar a env).
4. **Webhook fields** > **Manage**: assinar `messages`, `smb_message_echoes`, `account_update`, `message_template_status_update`, `template_category_update`.
5. O resto (permissões `whatsapp_business_messaging` e `whatsapp_business_management`, verificação do negócio, Tech Provider, App Review) continua no checklist da Meta em `docs/infra-setup.md`.

O token de acesso **de cada clínica** não é env: entra pela tela do agente e vai cifrado para o banco.

Referências: [Webhooks da Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks), [changelog de versões](https://developers.facebook.com/docs/graph-api/changelog/versions/).

## 3. Chaves de cifra — `TENANT_SECRETS_ENCRYPTION_KEY` e `MESSAGE_CONTENT_ENCRYPTION_KEY`
Já preenchidas no `.env` local. A regra que importa:

**Uma chave por banco, não por ambiente da Vercel.** Enquanto staging,
produção e o local apontarem para o mesmo projeto Supabase, os três precisam
das **mesmas duas chaves**. Com chaves diferentes:
- o token da Evolution que o script local cifrou não abre em produção;
- a mensagem que o webhook de produção gravou aparece ilegível em staging e no local;
- o token de clínica conectado em staging não envia em produção.

Passos:
1. Na Vercel, conferir se as duas já existem em Production e Preview.
2. Se existirem **e** já houver dado cifrado em produção (mensagens da demonstração, token do agente), a chave de produção é a verdadeira: copiar o valor da Vercel para o `.env` local, nunca o contrário.
3. Se não existirem em lugar nenhum além do local: copiar as do `.env` local para Production e Preview.
4. Quando staging ganhar banco próprio, staging passa a ter as suas. Gerar com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
5. **Nunca trocar** uma chave com dado cifrado sem re-cifrar antes: o que foi gravado com a antiga deixa de abrir.

## 4. Resend — `RESEND_API_KEY` e `RESEND_FROM_EMAIL`
Ninguém lê ainda. Vale começar agora pelo DNS.

1. Criar conta em [resend.com](https://resend.com) com o e-mail da equipe (Zoho), não com Gmail pessoal.
2. **Domains > Add domain**: `mail.nextech.ia.br` (subdomínio dedicado, regra 9 do CLAUDE.md; mesmo padrão do Refundly). Região: a mais próxima disponível (São Paulo, se aparecer).
3. A Resend mostra os registros na aba **Records**: um TXT de DKIM (`resend._domainkey.mail`), um MX e um TXT de SPF no subdomínio de envio. Copiar **exatamente**, sem redigitar.
4. No DNS de `nextech.ia.br`, criar só esses registros. **Não mexer** no MX nem no SPF da raiz, que são do Zoho. Se o DNS pedir só o nome relativo, usar `send.mail` / `resend._domainkey.mail` como a Resend indicar.
5. Voltar em **Domains** e clicar em **Verify**. Costuma sair em ~15 min; pode levar até 72 h.
6. **API Keys > Create API key**: nome `nextech-production`, permissão **Sending access**, restrita ao domínio `mail.nextech.ia.br`. Copiar para `RESEND_API_KEY` (aparece uma vez só). Uma chave por ambiente (`nextech-staging`, `nextech-local`) deixa revogar uma sem derrubar as outras.
7. `RESEND_FROM_EMAIL=Nextech <nao-responda@mail.nextech.ia.br>`.

Referência: [Add a domain](https://resend.com/docs/add-a-domain).

## 5. Google Calendar — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
Ninguém lê ainda (fase 5). O gargalo é a **verificação do escopo** do
Calendar, que o Google trata como sensível: prazo oficial de 3 a 5 dias
úteis, com relato de semanas. Começar cedo.

1. [console.cloud.google.com](https://console.cloud.google.com) > criar o projeto **Nextech** (organização da Nextech, se houver; senão na conta da equipe).
2. **APIs & Services > Library** > **Google Calendar API** > **Enable**.
3. **Google Auth Platform** (antes "OAuth consent screen"):
   - **Branding**: nome "Nextech", e-mail de suporte da equipe, logo, domínio `nextech.ia.br`, links de `/privacidade` e `/termos`.
   - **Audience**: **External**. Em teste, adicionar como test users só contas da equipe.
   - **Data access**: só os escopos mínimos. Recomendado `https://www.googleapis.com/auth/calendar.events` (criar e ler eventos) e `https://www.googleapis.com/auth/calendar.freebusy` (disponibilidade). Evitar `.../auth/calendar` inteiro, que é restrito e pede auditoria.
4. **Clients > Create client** > **Web application**:
   - Authorized redirect URIs: `https://app.nextech.ia.br/api/calendar/callback`, `https://staging.nextech.ia.br/api/calendar/callback` e `http://localhost:3000/api/calendar/callback`.
   - O caminho `/api/calendar/callback` é a proposta desta spec; a spec de agendamento pode mudar, e aí muda aqui também.
5. Copiar **Client ID** e **Client secret** para as envs. `GOOGLE_OAUTH_REDIRECT_URI` recebe a URL do ambiente (produção, staging ou localhost).
6. Verificação (quando a tela de conectar o Calendar existir): **Verification Center** > enviar com a justificativa de cada escopo e um vídeo mostrando a clínica autorizando e o evento sendo criado. Até aprovar, só test users conseguem autorizar, com aviso de "app não verificado".

O refresh token **de cada clínica** não é env: vai cifrado para o banco (regra 8).

Referência: [Verificação de escopo sensível](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## 6. Asaas — `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`
Ninguém lê ainda (fase 7). Rápido de obter, mesmo provedor do Refundly.

1. **Sandbox primeiro**: criar a conta em [sandbox.asaas.com](https://sandbox.asaas.com) (conta separada da de produção).
2. **Menu do usuário > Integrações > Chave de API** > gerar. Copiar para `ASAAS_API_KEY` (aparece uma vez só). Chave de sandbox começa diferente da de produção; nunca misturar.
3. `ASAAS_ENV=sandbox` no local e no Preview; `production` só em Production, com a chave da conta real.
4. **Menu do usuário > Integrações > Webhooks** > novo webhook:
   - URL: `https://<ambiente>/api/billing/webhook` (proposta desta spec; a spec de billing confirma);
   - **Token de autenticação**: gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (64 caracteres; o Asaas exige de 32 a 255, sem espaço, e não pode ser a API key) e copiar o mesmo valor para `ASAAS_WEBHOOK_TOKEN`. O Asaas manda no cabeçalho `asaas-access-token`.
5. Em produção: conta Asaas no CNPJ da Nextech, chave e webhook novos, nunca os do sandbox.

Referência: [Webhooks do Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## 7. Supabase, OpenRouter e Evolution
Já preenchidas no local. Na Vercel:
- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`): os mesmos valores nos três ambientes enquanto houver um banco só. `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` **não vão** para a Vercel: são da CLI, e o token é de conta (vale para todo projeto da conta).
- **OpenRouter**: `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` (`google/gemini-2.5-flash`) nos três. Sem elas, toda resposta da IA falha e a conversa passa para a equipe. Uma key por ambiente, com limite de crédito em cada, ajuda a ver quem gastou.
- **Evolution** (`EVOLUTION_*`): **nunca na Vercel**. Sem elas, `/api/whatsapp/evolution` responde 404, que é o certo fora do computador da apresentação.

## 8. Vercel, por ambiente
Settings > Environment Variables. Valor por ambiente:

| Variável | Production (`app` / `www`) | Preview (`staging`) | Development / local |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.nextech.ia.br` | `https://staging.nextech.ia.br` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `https://app.nextech.ia.br` | `https://staging.nextech.ia.br` | `http://localhost:3000` |
| Supabase (3) | iguais nos três (um banco só) | | |
| Chaves de cifra (2) | iguais nos três (um banco só) | | |
| `OPENROUTER_*` | key de produção | key de staging | key local |
| `WHATSAPP_API_VERSION` | `v25.0` | `v25.0` | `v25.0` |
| `WHATSAPP_APP_SECRET` | o do app | o do app | o do app |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | um | outro | outro |
| `WHATSAPP_APP_ID` | o do app | o do app | o do app |
| `RESEND_*` | key `production` | key `staging` | key `local` |
| `GOOGLE_CLIENT_ID` / `_SECRET` | iguais | iguais | iguais |
| `GOOGLE_OAUTH_REDIRECT_URI` | URL de `app` | URL de `staging` | `localhost` |
| `ASAAS_*` | conta real, `production` | sandbox | sandbox |
| `EVOLUTION_*` | — | — | só no computador da apresentação |

Depois de criar ou mudar env, **redeploy**: a Vercel só aplica no deploy seguinte. Variável `NEXT_PUBLIC_*` entra no build; mudar exige build novo, não só restart.

## Como conferir
- **Local:** o comando `awk` do inventário; depois `npm run dev` e abrir `/dashboard`.
- **Webhook da Meta:** o "Verify and save" da seção 2 passar já prova `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; a primeira mensagem real gravada em `messages` prova `WHATSAPP_APP_SECRET` (assinatura errada vira 401).
- **IA:** uma conversa no teste do agente (`/dashboard/agents/<id>`) respondendo.
- **Cifra:** abrir em staging uma conversa gravada por produção. Texto legível = chaves iguais.

## Critério de aceite
- [ ] `WHATSAPP_API_VERSION` em `v25.0` no local e nos três ambientes.
- [ ] `WHATSAPP_APP_SECRET` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` no local e na Vercel; webhook verificado na Meta com os cinco campos assinados.
- [ ] Chaves de cifra conferidas iguais entre local, staging e produção.
- [ ] Domínio `mail.nextech.ia.br` verificado na Resend, sem tocar no MX e no SPF do Zoho.
- [ ] Projeto do Google criado, Calendar API ligada, client OAuth criado com as três URIs.
- [ ] Conta sandbox do Asaas com chave e token de webhook.
- [ ] `docs/infra-setup.md` atualizado: os itens feitos marcados, e a frase "uma chave por ambiente" corrigida para "uma chave por banco".

## Fora do escopo
- Código que usa Resend, Google ou Asaas: cada um vem com a sua spec.
- Banco próprio para staging (`docs/infra-setup.md`), que muda a regra das chaves de cifra.
- Segredo das rotas `app/api/cron/*`, que fica no Supabase Vault e não em env (decisão de 2026-09-27); entra com a spec de sequências.
