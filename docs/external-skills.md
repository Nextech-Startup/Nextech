# Skills externas recomendadas — Nextech

Descobertas via `find-skills` / skills.sh. Nenhuma substitui as 7 skills próprias em `.claude/skills/` — elas cobrem conhecimento genérico e batido de mercado; as nossas cobrem a regra de negócio do Nextech (multi-agente, LGPD, plano por especialidade). Instale as duas camadas juntas.

## Fonte oficial — instale sem medo

| Skill | Fonte | O que cobre | Onde entra no nosso setup |
|---|---|---|---|
| `supabase` + `supabase-postgres-best-practices` | Supabase (oficial) | Database, Auth, Edge Functions, RLS, migrations, otimização Postgres. `npx skills add supabase/agent-skills` | Complementa `architecture` — é a skill que sabe *como* fazer RLS certo; a nossa diz *que* toda tabela precisa de RLS por `clinic_id` |
| Next.js best practices | Vercel Labs (oficial) | Convenções Next.js 16 — App Router, RSC boundaries, async params, `middleware` → `proxy` | Base de todo o código em `app/` |
| React best practices | Vercel Labs (oficial) | Hooks, composição, performance, eliminação de waterfalls (57 regras) | Telas do painel, especialmente `agents/[agentId]` com preview ao vivo |
| Deploy to Vercel | Vercel Labs (oficial) | Deploy/preview direto do agente, autenticação por token | Complementa a skill `ci-cd` nossa |
| Web App Testing | Anthropic (oficial) | Testar/depurar UI local via Playwright interativamente — **não é** suíte de E2E de produção | Debug do dia a dia, não substitui os testes exigidos pela skill `qa-testing` |

> Os nomes de pacote exatos (`npx skills add owner/repo --skill nome`) mudam de tempos em tempos — o próprio Next.js já migrou de repositório uma vez. Confirme o comando atual na página de cada skill em agenticskills.io antes de instalar.

## Comunidade estabelecida — ler o SKILL.md inteiro antes de instalar

| Skill | Fonte | O que cobre |
|---|---|---|
| Tailwind CSS design system | wshobson (39K+ instalações, A-rank) | Padrões de design system Tailwind/shadcn — complementa a skill `ui-ux` nossa com convenção genérica de componente |
| Playwright Best Practices | currents.dev | Autoria de teste E2E de produção: Page Object Model, fixtures, trace viewer, testes flaky — é o que falta pra montar a suíte real que a skill `qa-testing` exige |

## Fica pra depois
- **Better Auth** — tem plugin de SSO pronto (`sso`, `oidcProvider`). Só relevante quando formos implementar o plano HealthTech, que promete SSO no site. Hoje o Auth do próprio Supabase cobre Starter/Pro.

## Regra
Skill externa só entra no repo depois de abrir o `SKILL.md` e ler o que ele realmente instrui — principalmente as de fonte comunitária, num projeto que mexe com dado de saúde. Ver `CLAUDE.md`.
