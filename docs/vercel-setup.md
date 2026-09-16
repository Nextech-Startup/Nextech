# Configuração da Vercel e dos domínios

Passo a passo para colocar `app.nextech.ia.br` e `staging.nextech.ia.br` no ar. Tudo aqui é feito no painel da Vercel e no registrador do domínio — nada disso está no código.

**Premissa:** um único projeto Vercel serve os três domínios. O middleware decide o que cada um mostra (`middleware.ts`), então não há deploy separado nem repositório novo.

---

## 1. Domínios na Vercel

Projeto → **Settings → Domains → Add**.

| Domínio | Branch | Observação |
|---|---|---|
| `www.nextech.ia.br` | `main` | já configurado |
| `nextech.ia.br` | `main` | deve redirecionar para `www` |
| `app.nextech.ia.br` | `main` | painel em produção |
| `staging.nextech.ia.br` | `staging` | usar **Git Branch: staging** no campo do formulário |

O campo *Git Branch* em `staging.nextech.ia.br` é o que prende aquele domínio à branch `staging`. Sem preencher, ele serve `main` e o ambiente de teste vira uma cópia da produção.

## 2. DNS no registrador

A Vercel mostra o alvo exato ao adicionar cada domínio — use o que ela indicar. O padrão é:

| Tipo | Nome | Valor |
|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` |
| CNAME | `staging` | `cname.vercel-dns.com` |

**Não mexer** nos registros MX (Zoho) nem no subdomínio de envio do Resend (`mail`). Subdomínios diferentes não colidem — o risco é editar a linha errada, não a coexistência.

## 3. Variáveis de ambiente

Projeto → **Settings → Environment Variables**. São cinco, e duas mudam por ambiente.

### Iguais em todos os ambientes

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role — **só Production e Preview**, nunca com prefixo `NEXT_PUBLIC_` |

### Diferentes por ambiente

| Variável | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.nextech.ia.br` | `https://staging.nextech.ia.br` |
| `NEXT_PUBLIC_APP_URL` | `https://app.nextech.ia.br` | `https://staging.nextech.ia.br` |

Se `NEXT_PUBLIC_APP_URL` não for ajustada em Preview, o botão "Login" da landing em staging joga o usuário na produção.

`SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` **não** vão para a Vercel: servem só à CLI, na máquina de quem desenvolve.

## 4. Supabase Auth (feito em 2026-09-16)

Duas correções já aplicadas via API, registradas aqui porque não estão no código:

- **`site_url`**: era `http://localhost:3000`. Em produção, o link de recuperação de senha mandaria o usuário para a máquina dele. Passou a `https://app.nextech.ia.br`.
- **`disable_signup`**: estava **aberto**. Qualquer pessoa criava conta com a anon key, que é pública por estar no JS do site — confirmado por teste antes da correção. Contraria o onboarding consultivo (`team-access-v1.md`). Passou a `true`.
- **`uri_allow_list`**: `app`, `staging` e `localhost:3000`, para o redirect voltar ao ambiente de origem.

A conta criada pelo signup aberto não enxergava dado de clínica — a RLS impede, e os testes provam. O problema era permitir cadastro fora do fluxo e encher o Auth de contas.

Com `disable_signup: true`, usuário novo só nasce por `service_role`: o painel `(admin)` ou os scripts de seed.

## 5. Conferir depois do deploy

```
https://www.nextech.ia.br        -> landing
https://nextech.ia.br            -> redireciona para www
https://app.nextech.ia.br        -> redireciona para /dashboard e cai em /login
https://staging.nextech.ia.br    -> mesmo comportamento, servindo a branch staging
```

Entrando com um usuário da equipe, `app.nextech.ia.br/admin` abre o painel interno. Com usuário de clínica, redireciona para `/dashboard`.

---

## Pendência: staging compartilha o banco de produção

Hoje existe **um único projeto Supabase**, usado pela landing em produção, pelo painel e pelos testes. Enquanto `staging.nextech.ia.br` apontar para ele, qualquer teste em staging escreve em produção.

Aceitável enquanto não houver clínica real cadastrada. **Deixa de ser** no dia do primeiro cliente — aí staging precisa de projeto Supabase próprio, com as mesmas migrations aplicadas.

Quando isso acontecer, a separação é: um segundo projeto Supabase, `supabase link` apontando para ele, `supabase db push` para aplicar o histórico de migrations, e as três variáveis do Supabase trocadas no ambiente de Preview da Vercel.
