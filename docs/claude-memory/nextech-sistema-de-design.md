---
name: nextech-sistema-de-design
description: "Decisões de design e tema da landing page Nextech, tomadas com o usuário em set/2026."
metadata: 
  node_type: memory
  type: project
  originSessionId: d85dfc7f-9653-4ddd-bfe4-6f7ef21b6142
  modified: 2026-09-27T03:10:36.946Z
---

A landing page da Nextech (assistentes de IA no WhatsApp para clínicas) passou por um refino visual em 08/09/2026, com estas decisões do usuário:

- **Escopo visual:** refinar a identidade dark/glass/emerald existente, sem redesenho de identidade nova.
- **Seção "Soluções":** mantida clara (pausa proposital no meio da página escura), mas usando a paleta do sistema e o acento único, em vez do branco puro com azul/indigo.
- **Rodapé:** links sem destino (Documentação, Blog, Carreiras, Privacidade…) ficam como rótulos inertes com `title="Em breve"` — nunca `href="#"`.
- **Tema claro + escuro** com botão sol/lua, via `next-themes` (`attribute="class"`, `defaultTheme="dark"`).

O sistema vive em `app/globals.css`: tokens semânticos (`--surface-0..2`, `--text-1..3`, `--hairline`, `--glass-bg`, `--accent`, `--aurora-opacity`) e raios `pill`/`card`/`panel`. Os componentes usam `bg-surface-1`, `text-ink-2`, `border-hairline` — não cores fixas, que quebrariam no tema claro.

O acento verde muda por tema: claro `oklch(0.52 0.11 165)`, escuro `oklch(0.75 0.14 165)` — o verde claro rende só 2:1 sobre fundo claro. `node scripts/check-contrast.js` valida os 14 pares em WCAG AA.

**Redesign do painel (2026-09-26).** A v0 foi usada para explorar e entregou pouco e com problemas: tokens renomeados sem atualizar a landing (verde sumiu) e telas com dado inventado em rotas reais do painel. O redesign de verdade foi feito pelo Claude na branch `design/app-redesign`, pelo plano `docs/superpowers/plans/2026-09-26-redesign-do-painel.md`.
Regras que ficaram:
- `accent` = hover neutro do shadcn; verde da marca = `brand`; a landing recupera `accent` verde pelo `.landing-scope` (`app/(marketing)/layout.tsx`), travado por `tests/architecture/landing-scope.test.ts`.
- Dado fictício: telas de protótipo do admin (com `AvisoDePrototipo`) e páginas do painel que leem `isDemo` (conta de demonstração, sem o aviso, com selo no cabeçalho). Item "em breve" só tem página de demonstração, com `if (!isDemo) notFound()` (`tests/architecture/rotas.test.ts`). Fixtures em `app/_fixtures/`, deslocadas para hoje por `lib/demo/relogio.ts`; sem data por extenso nem identificador real (trava em `tests/demo/fixtures.test.ts`).
- Painel sem `[var(--x)]` (`tests/architecture/tokens.test.ts`); kit em `components/patterns` com controles nativos (server actions leem FormData).
- Revisão visual com Edge + playwright-core via script no scratchpad (`shot.mjs`); criar dado de teste pela UI e apagar no fim.
**Parte 2 (2026-09-26, na staging):**
- Menu: terceiro grupo virou "Gestão", com Integrações (só owner). "Métricas" não é item; "Conta" fica no menu do usuário.
- Padrão de protótipo: tela = componente de domínio em `components/<domínio>/` com props tipadas; dado fictício em `app/(admin)/admin/design-system/_fixtures/`, com "agora" fixo (`AGORA`). Guardas em `tests/architecture/prototipos.test.ts`. Regras puras que o backend reaproveita ficam em `lib/<domínio>/`.
- Datas só por `lib/formatters` (fuso de São Paulo, nomes de mês de tabela própria), para não quebrar a hidratação.
**Parte 3 (2026-09-26, na staging, 686 testes):**
- Acesso por papel com regra única: `lib/navigation/acesso.ts`, derivada do `DASHBOARD_NAV`. Menu e guarda da página leem o mesmo `roles`; "Agentes" é só do owner.
- Estados nas rotas reais: `loading.tsx` por rota, `error.tsx` por painel (sem console, suporte usa `digest`), `not-found.tsx` no shell da clínica. Nada em `app/` raiz, para não afetar a landing.
- Protótipos de Visão geral, Agentes com operação, Integrações e Minha conta. Integrações e Minha conta seguem "em breve" no menu (decisão do Jhones).
- Parte 4 = painel interno (Consumo, Conexões, Saúde, Conversas de suporte, Auditoria).
**Parte 4 (2026-09-26, na staging, 753 testes):** os cinco protótipos do painel interno, regras em `lib/admin/`. Com ela, todo o produto existe como protótipo; as telas reais chegam por fase.
- Auditoria já é real (`/admin/audit`, spec `admin-audit-v1`, 2026-09-27): era a única das cinco com dado. As outras quatro seguem "em breve" até o backend das fases 3b a 7 existir, porque rota real não mostra dado inventado.
- Decisão do Jhones sobre suporte: justificativa por clínica, acesso de 30 min, lista e cada conversa aberta viram registros separados. A justificativa é motivo de lista fechada mais número do chamado só com dígitos: **nunca texto livre**, porque levaria nome de paciente para `admin_audit_log`.
- `next dev` dá 500 "Jest worker" em rota dinâmica; conferir num `next start -p 3100` (script de captura aceita `BASE`).

**How to apply:** entrega da v0 nunca vai direto para staging: passa por aqui, suíte inteira e checagem da landing (`--accent` na landing = `lab(72.8575% -47.9172 13.5998)`).

Ver [[padrao-de-qualidade]].
