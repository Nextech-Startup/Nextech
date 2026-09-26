# Redesign do painel: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendada) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** tudo o que uma clínica e a equipe Nextech veem no painel passa a ter a identidade da landing, sobre shadcn/ui. Nenhum número, paciente ou agente inventado aparece em rota real.

**Arquitetura:** a cor vem só de tokens (`app/globals.css`). Os primitivos vêm do shadcn (`components/ui`). As composições reaproveitáveis ficam em `components/patterns` e as peças de domínio em `components/<domínio>`. As páginas em `app/` continuam buscando dado pelas funções que já existem em `lib/` e só trocam a apresentação. Telas sem backend viram protótipo com dado fictício em `/admin/design-system/telas/*`, e o item do menu continua "em breve". Um teste garante isso.

**Tecnologias:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (tema em `@theme inline`), shadcn/ui (primitivos via pacote `radix-ui`), lucide-react, next-themes, Vitest 5.

**Specs:**
- `docs/design/prompt-v0-design-system.md`: o brief do design system.
- `docs/design/prompt-mestre-v0.md`: o prompt mestre gerado pela v0. Vale como direção, com os limites da seção "Fora deste plano".
- `docs/specs/dashboard-overview-v1.md`: a Visão geral, sem zero disfarçado.
- `.claude/skills/ui-ux/SKILL.md`: as regras de UX.

## Ponto de partida

Branch `design/app-redesign`, com três commits sobre `staging`:
- `9d15780`: fundação de tokens da v0 (renomeou `accent` → `brand` e criou os tons de estado).
- `e00d4d7` (WIP do Claude): shell shadcn, conserto da landing por escopo, 27 primitivos, `cn` com raios próprios e testes.

Faltam os três commits novos da v0: `302d572`, `886a12c` e `2fcb7b3`. Eles trazem as telas com dado falso.

O servidor de dev roda em `http://localhost:3000` (`npm run dev`) e recarrega sozinho a cada edição.

Contas de teste: `clinica@nextech.ia.br` / `NextechClinica2026` (owner) e `admin@nextech.ia.br` / `NextechAdmin2026`.

**Verificação visual.** O script `shot.mjs` fica no scratchpad da sessão, fora do repositório. Ele usa o Edge instalado e o `playwright-core`. Defina o caminho antes dos comandos:

```bash
SHOT="C:/Users/Jhone/AppData/Local/Temp/claude/c--Projetos-pessoais-Nextech/e8956685-ad53-4ebf-a9c7-37fe81977283/scratchpad/shot"
```
- `MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs <pasta> <papel>:<rota>:<tema>:<largura> ...` gera screenshots.
- `MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs --cores /` lista as cores calculadas das classes `accent` da landing.
- Os papéis aceitos são `anon`, `clinica` e `admin`.

## Restrições globais

- Texto de interface em português do Brasil. Nada de rótulo em caixa alta, de `·` separando metadados e de `→` colado em texto de botão.
- **Não alterar:** `supabase/**`, `middleware.ts` e arquivos `actions.ts`. Em `lib/`, só `lib/utils.ts` (já alterado) e o módulo novo `lib/onboarding/`.
- **Formulários:** nenhum `name` ou formato de valor muda. Os controles continuam nativos (`input`, `select`, `textarea`, `checkbox`), porque as server actions leem `FormData`.
- **Dado inventado:** nunca em rota do painel da clínica. Protótipo só em `/admin/design-system/telas/*`, sempre com `AvisoDePrototipo`.
- **Landing:** zero mudança visual. `node $SHOT/shot.mjs --cores /` precisa mostrar `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`.
- **Cor:** só por token (`ink-1/2/3`, `surface-0/1/2`, `sheet`, `hairline`, `brand*`, `success|warning|danger|info|neutral-{bg,fg,border}`). Nenhum `[var(--` em `app/(dashboard)`, `app/(admin)`, `app/(auth)`, `components/shell` e `components/patterns`.
- **Verde (`brand`):** só no item ativo do menu, no foco, na ação que liga algo (no máximo uma por tela, variante `marca`/`brand`) e em estado positivo.
- **Raio:** `rounded-control` (0.625rem) em campo, `rounded-xl` em linha e aviso, `rounded-card` (1.25rem) em seção, `rounded-sheet` (1.5rem) na folha do shell e `rounded-pill` em botão e status.
- **Tipografia:** Cal Sans (`font-display`) só em título de página, título de seção de destaque e número de KPI. Manrope em todo o resto.
- **Git:** commits pequenos em `design/app-redesign`. Nada em `main`. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Testes:** ao fim, `npx vitest run` passa inteiro. A suíte toca o Supabase real, e `npx tsc --noEmit` e `npm run build` também passam.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `components/patterns/formulario.tsx` | `Campo`, `Input`, `Textarea`, `Select`, `Botao`, `Aviso`, `estadoInicial`, `EstadoDeFormulario` |
| `components/patterns/cartao.tsx` | `Cartao`: seção com título, descrição e ação |
| `components/patterns/vazio.tsx` | `Vazio`: estado vazio com próximo passo |
| `components/patterns/status-badge.tsx` | `StatusBadge` + `StatusTone`, sobre o `Badge` do shadcn |
| `components/patterns/page-header.tsx` | `PageHeader`: título, descrição, status e ações |
| `components/patterns/kpi-card.tsx` | `KpiCard`, com estado `pendente` honesto |
| `components/patterns/chat-bubble.tsx` | `ChatBubble`: bolha estilo WhatsApp |
| `components/patterns/aviso-de-prototipo.tsx` | Faixa "Protótipo com dados fictícios" |
| `components/patterns/workspace-page.tsx` | Casca dos protótipos (vem da v0, ajustada) |
| `components/agents/status-do-agente.tsx` | Status do agente → tom + rótulo |
| `components/agents/preview-de-conversa.tsx` | Prévia da saudação no WhatsApp |
| `lib/onboarding/passos.ts` | Primeiros passos da clínica, derivados de dado real |
| `app/(dashboard)/dashboard/settings/escolha-de-convenios.tsx` | Sai de `settings/ui.tsx` |
| `app/(admin)/admin/design-system/**` | Galeria de protótipos e as 7 telas futuras |
| `tests/architecture/landing-scope.test.ts` | Guarda do escopo de tokens da landing |
| `tests/architecture/tokens.test.ts` | Guarda contra `[var(--` no painel |
| `tests/architecture/rotas.test.ts` | Guarda: item "em breve" não tem página; item pronto tem |

Somem: `app/(dashboard)/dashboard/settings/ui.tsx`, `app/(dashboard)/dashboard/agents/ui.tsx` e as 7 rotas falsas de `app/(dashboard)`.

---

### Tarefa 1: Integrar a entrega da v0 e arquivar o prompt mestre

**Arquivos:**
- Traz: os commits `302d572`, `886a12c` e `2fcb7b3` (da branch `origin/v0/design-system-foundation`).
- Move: `Prompt v0.md` → `docs/design/prompt-mestre-v0.md`.

**Interfaces:**
- Produz: as páginas da v0 em `app/(dashboard)/dashboard/{conversations,schedule,patients,sequences,templates,billing}/page.tsx` e `settings/team/page.tsx`; `components/patterns/workspace-page.tsx`; `PageHeader` e `StatusBadge` na versão da v0; `images.qualities` no `next.config.mjs`.

- [ ] **Passo 1: garantir árvore limpa.** O `next dev` reescreve o `CLAUDE.md`. Descarte isso antes de trazer commits.

```bash
git checkout -- CLAUDE.md
git status --short
```
Esperado: só `?? "Prompt v0.md"`.

- [ ] **Passo 2: trazer os commits.**

```bash
git cherry-pick 302d572 886a12c 2fcb7b3
```
Esperado: três commits aplicados sem conflito. O WIP não toca nenhum arquivo que eles alteram. Se aparecer conflito em `CLAUDE.md`, resolva com a versão atual (`git checkout --ours CLAUDE.md && git add CLAUDE.md && git cherry-pick --continue`).

- [ ] **Passo 3: arquivar o prompt mestre.**

```bash
mkdir -p docs/design && git mv -f "Prompt v0.md" docs/design/prompt-mestre-v0.md 2>/dev/null || mv "Prompt v0.md" docs/design/prompt-mestre-v0.md
```

- [ ] **Passo 4: conferir tipos e testes.**

```bash
npx tsc --noEmit
npx vitest run lib/utils.test.ts components/shell tests/architecture lib/navigation
```
Esperado: `tsc` sem saída e todos os testes passando.

- [ ] **Passo 5: commit.**

```bash
git add docs/design/prompt-mestre-v0.md
git commit -m "docs: arquiva o prompt mestre gerado pela v0" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Guarda da landing e polimento do shell

**Arquivos:**
- Criar: `tests/architecture/landing-scope.test.ts`
- Modificar: `components/shell/app-sidebar.tsx` (função `ItemEmBreve`)
- Modificar: `components/shell/panel-shell.tsx` (classe do `SidebarProvider`)

**Interfaces:**
- Consome: `.landing-scope` em `app/globals.css` e `app/(marketing)/layout.tsx` (do WIP).

- [ ] **Passo 1: escrever o teste da guarda.**

```ts
// tests/architecture/landing-scope.test.ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("app/globals.css", "utf8")

/** Corpo do primeiro bloco `<seletor> { ... }` do CSS (sem chaves aninhadas). */
function bloco(seletor: string): string {
  const inicio = css.indexOf(`${seletor} {`)
  expect(inicio, `bloco ${seletor} não encontrado`).toBeGreaterThanOrEqual(0)
  return css.slice(inicio, css.indexOf("}", inicio))
}

describe("tokens da landing", () => {
  it("dentro da landing, accent continua sendo o verde da marca", () => {
    const b = bloco(".landing-scope")
    expect(b).toContain("--accent: var(--brand)")
    expect(b).toContain("--accent-strong: var(--brand-strong)")
    expect(b).toContain("--accent-dim: var(--brand-dim)")
    expect(b).toContain("--accent-on-light: var(--brand-on-light)")
  })

  it("fora da landing, accent é a superfície neutra de hover do shadcn", () => {
    expect(bloco(":root")).toContain("--accent: var(--surface-2)")
  })

  it("o layout da landing aplica o escopo sem criar caixa no layout", () => {
    const layout = readFileSync("app/(marketing)/layout.tsx", "utf8")
    expect(layout).toContain('className="landing-scope contents"')
  })
})
```

- [ ] **Passo 2: rodar.** O teste passa, porque o WIP já tem o escopo. Para provar que ele pega a regressão, apague temporariamente a linha `--accent: var(--brand);` do `.landing-scope`, rode, veja falhar e restaure.

```bash
npx vitest run tests/architecture/landing-scope.test.ts
```
Esperado: 3 passando (e 1 falhando durante a prova).

- [ ] **Passo 3: "em breve" discreto no menu.** Em `components/shell/app-sidebar.tsx`, dentro de `ItemEmBreve`, troque o selo em pílula:

```tsx
        <span className="ml-auto rounded-pill border border-hairline px-1.5 py-px text-[0.625rem] text-ink-3 group-data-[collapsible=icon]:hidden">
          em breve
        </span>
```
por texto simples. Sete dos dez itens estão em breve, e pílula em todos vira ruído.

```tsx
        <span className="ml-auto text-[0.6875rem] text-ink-3/80 group-data-[collapsible=icon]:hidden">
          em breve
        </span>
```

- [ ] **Passo 4: brilho visível atrás do menu.** Em `components/shell/panel-shell.tsx`, troque `<SidebarProvider defaultOpen={aberto} className="painel-glow">` por:

```tsx
    // No desktop o menu fica transparente para o brilho aparecer atrás
    // dele; no celular a gaveta é um portal fora deste wrapper e mantém
    // o fundo opaco.
    <SidebarProvider
      defaultOpen={aberto}
      className="painel-glow md:[&_[data-sidebar=sidebar]]:bg-transparent"
    >
```

- [ ] **Passo 5: conferir no navegador.**

```bash
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t2 clinica:/dashboard/agents:dark:1440 clinica:/dashboard/agents:light:1440 clinica:/dashboard/agents:dark:390
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs --cores /
```
Esperado:
- menu com "em breve" em texto e brilho slate visível no topo esquerdo;
- em 390px, o menu escondido atrás do botão do cabeçalho;
- `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`.

- [ ] **Passo 6: commit.**

```bash
git add tests/architecture/landing-scope.test.ts components/shell/app-sidebar.tsx components/shell/panel-shell.tsx
git commit -m "feat(shell): guarda o escopo da landing e deixa o menu mais quieto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Tokens no lugar de classes arbitrárias

**Arquivos:**
- Criar: `tests/architecture/tokens.test.ts`
- Modificar (por script): todo `.ts`/`.tsx` em `app/(dashboard)`, `app/(admin)`, `app/(auth)`, `components/shell` e `components/patterns`.

- [ ] **Passo 1: escrever o teste que falha.**

```ts
// tests/architecture/tokens.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const PAINEL = [
  "app/(dashboard)",
  "app/(admin)",
  "app/(auth)",
  "components/shell",
  "components/patterns",
]

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe("tokens do painel", () => {
  // `bg-[var(--surface-1)]` e `bg-surface-1` pintam igual, mas só o segundo
  // passa pelo tema: o primeiro some da busca por token e deixa cada tela
  // com o próprio dialeto de cor.
  it("nenhuma tela do painel usa cor por classe arbitrária var(--x)", () => {
    const infratores = PAINEL.flatMap(arquivos).filter((f) =>
      /\[var\(--/.test(readFileSync(f, "utf8")),
    )
    expect(infratores).toEqual([])
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.**

```bash
npx vitest run tests/architecture/tokens.test.ts
```
Esperado: FAIL, listando os arquivos do painel (settings, agents, admin, login).

- [ ] **Passo 3: converter.** Rode este script a partir da raiz do repositório. Ele fica fora do repo, no scratchpad, e não é commitado.

```js
// $SHOT/../codemod-tokens.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const RAIZES = ["app/(dashboard)", "app/(admin)", "app/(auth)", "components/shell", "components/patterns"]
const TROCAS = [
  [/\[var\(--text-([123])\)\]/g, "ink-$1"],
  [/\[var\(--(surface-[012]|hairline|sheet|warn|brand(?:-strong|-dim|-on-light)?)\)\]/g, "$1"],
]

function* arquivos(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho)
    else if (/\.tsx?$/.test(nome)) yield caminho
  }
}

let total = 0
for (const raiz of RAIZES) {
  for (const f of arquivos(raiz)) {
    const antes = readFileSync(f, "utf8")
    let depois = antes
    for (const [re, sub] of TROCAS) depois = depois.replace(re, sub)
    if (depois !== antes) {
      writeFileSync(f, depois)
      total++
      console.log("alterado:", f)
    }
  }
}
console.log(total, "arquivos")
```

```bash
node "$SHOT/../codemod-tokens.mjs"
```
O que muda: `bg-[var(--surface-1)]` → `bg-surface-1`, `text-[var(--text-2)]` → `text-ink-2`, `accent-[var(--brand)]` → `accent-brand`, `bg-[var(--brand)]/12` → `bg-brand/12` e assim por diante. Os valores são os mesmos, então nada muda visualmente.

- [ ] **Passo 4: rodar de novo.**

```bash
npx vitest run tests/architecture/tokens.test.ts && npx tsc --noEmit
```
Esperado: PASS. Se sobrar um `[var(--x)]` com variável fora do mapa, `grep -rn "\[var(--" "app/(dashboard)" "app/(admin)" "app/(auth)" components/shell components/patterns` mostra onde. Converta à mão para o token equivalente.

- [ ] **Passo 5: conferir que nada mudou de cor.**

```bash
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t3 clinica:/dashboard/settings:dark:1440 anon:/login:dark:1440
```
Esperado: mesmas cores de antes da conversão.

- [ ] **Passo 6: commit.**

```bash
git add -A "app/(dashboard)" "app/(admin)" "app/(auth)" components/shell components/patterns tests/architecture/tokens.test.ts
git commit -m "refactor: troca classes var(--x) por tokens do tema e trava por teste" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Tirar o dado falso do painel da clínica

**Arquivos:**
- Criar: `tests/architecture/rotas.test.ts`
- Criar: `components/patterns/aviso-de-prototipo.tsx`
- Criar: `app/(admin)/admin/design-system/page.tsx`
- Mover: as 7 páginas falsas para `app/(admin)/admin/design-system/telas/<slug>/page.tsx`
- Modificar: `components/patterns/workspace-page.tsx` (prop `prototipo`)
- Restaurar: `app/(dashboard)/dashboard/page.tsx` a partir da `staging` (versão honesta; a Tarefa 9 a redesenha)

**Interfaces:**
- Consome: `DASHBOARD_NAV` e `ADMIN_NAV` de `lib/navigation`.
- Produz: `AvisoDePrototipo({ entrega: string })` e `WorkspacePage({ ..., prototipo?: string })`.

- [ ] **Passo 1: escrever o teste que falha.**

```ts
// tests/architecture/rotas.test.ts
import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav"
import { ADMIN_NAV } from "@/lib/navigation/admin-nav"

/** `/dashboard/x` → `app/(dashboard)/dashboard/x/page.tsx`; idem para `/admin`. */
function arquivoDaRota(href: string): string {
  const grupo = href.startsWith("/admin") ? "(admin)" : "(dashboard)"
  return `app/${grupo}${href}/page.tsx`
}

const itens = [...DASHBOARD_NAV, ...ADMIN_NAV].flatMap((g) => g.items)

describe("rotas do menu", () => {
  // O menu mostra "em breve" sem link. Se a rota existir mesmo assim,
  // qualquer um chega nela pela URL — e uma tela sem backend só tem dado
  // inventado para mostrar.
  it("item 'em breve' não tem página", () => {
    const comPagina = itens.filter(
      (i) => i.status === "em-breve" && existsSync(arquivoDaRota(i.href)),
    )
    expect(comPagina.map((i) => i.href)).toEqual([])
  })

  it("item pronto tem página", () => {
    const semPagina = itens.filter(
      (i) => i.status === "pronto" && !existsSync(arquivoDaRota(i.href)),
    )
    expect(semPagina.map((i) => i.href)).toEqual([])
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.**

```bash
npx vitest run tests/architecture/rotas.test.ts
```
Esperado: FAIL. O primeiro caso lista `/dashboard/conversations`, `/dashboard/schedule`, `/dashboard/patients`, `/dashboard/sequences`, `/dashboard/templates`, `/dashboard/settings/team` e `/dashboard/billing`.

- [ ] **Passo 3: criar o aviso de protótipo.**

```tsx
// components/patterns/aviso-de-prototipo.tsx
import { FlaskConical } from "lucide-react"

/**
 * Faixa obrigatória em toda tela de protótipo: deixa impossível confundir
 * dado fictício com dado de clínica.
 */
export function AvisoDePrototipo({ entrega }: { entrega: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-card border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg"
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">Protótipo com dados fictícios.</span>{" "}
        Esta tela ainda não existe para as clínicas. Entra no ar com: {entrega}.
      </p>
    </div>
  )
}
```

- [ ] **Passo 4: `WorkspacePage` aceita `prototipo`.** Em `components/patterns/workspace-page.tsx`, adicione o import e a prop, e renderize o aviso antes do `PageHeader`.

```tsx
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
```
A assinatura de `WorkspacePage` passa a ser:
```tsx
export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  prototipo,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  action?: { label: string; href?: string }
  /** Quando entra no ar — obrigatório enquanto a tela for protótipo. */
  prototipo?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      {prototipo && <AvisoDePrototipo entrega={prototipo} />}
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children}
    </div>
  )
}
```

- [ ] **Passo 5: mover as 7 telas e marcá-las como protótipo.**

```bash
D="app/(dashboard)/dashboard"; P="app/(admin)/admin/design-system/telas"
for par in "conversations:conversas" "schedule:agenda" "patients:pacientes" "sequences:sequencias" "templates:templates" "settings/team:equipe" "billing:cobranca"; do
  de="${par%%:*}"; para="${par##*:}"
  mkdir -p "$P/$para" && git mv "$D/$de/page.tsx" "$P/$para/page.tsx"
done
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="motor de conversa (fase 3b)" /' "$P/conversas/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="agendamento (fase 5)" /' "$P/agenda/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="tela de pacientes (os dados já existem)" /' "$P/pacientes/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="sequências (fase 4)" /' "$P/sequencias/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="templates do WhatsApp (fase 4)" /' "$P/templates/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="convite de equipe por e-mail" /' "$P/equipe/page.tsx"
sed -i 's/<WorkspacePage /<WorkspacePage prototipo="cobrança (fase 7)" /' "$P/cobranca/page.tsx"
```
Paciente não tem e-mail em `patient-v1`. Em `$P/pacientes/page.tsx`, troque os quatro e-mails fictícios por telefone fictício:

```bash
sed -i 's/mariana\.alves@email\.com/(81) 90000-0001/; s/rafael\.mendes@email\.com/(81) 90000-0002/; s/camila\.duarte@email\.com/(81) 90000-0003/; s/lucas\.ferreira@email\.com/(81) 90000-0004/; s/Buscar por nome, telefone ou e-mail/Buscar por nome ou telefone/' "$P/pacientes/page.tsx"
```

- [ ] **Passo 6: galeria de protótipos.**

```tsx
// app/(admin)/admin/design-system/page.tsx
import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/patterns/page-header"

export const metadata: Metadata = {
  title: "Protótipos",
  robots: { index: false, follow: false },
}

const TELAS = [
  { slug: "conversas", nome: "Conversas", entrega: "motor de conversa (fase 3b)" },
  { slug: "pacientes", nome: "Pacientes", entrega: "tela de pacientes" },
  { slug: "agenda", nome: "Agenda", entrega: "agendamento (fase 5)" },
  { slug: "sequencias", nome: "Sequências", entrega: "sequências (fase 4)" },
  { slug: "templates", nome: "Templates", entrega: "templates do WhatsApp (fase 4)" },
  { slug: "equipe", nome: "Equipe e acessos", entrega: "convite de equipe por e-mail" },
  { slug: "cobranca", nome: "Plano e cobrança", entrega: "cobrança (fase 7)" },
] as const

/**
 * Telas desenhadas que ainda não existem para as clínicas. Vivem aqui, e
 * não em app/(dashboard), para que dado fictício nunca apareça numa rota
 * que uma clínica alcance — nem digitando a URL.
 */
export default function PrototiposPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Protótipos"
        description="Telas desenhadas que ainda não existem para as clínicas. Todas usam dados fictícios e só a equipe Nextech as vê."
      />
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
        {TELAS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/admin/design-system/telas/${t.slug}`}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent"
            >
              <div className="grid gap-0.5">
                <p className="text-sm font-medium text-ink-1">{t.nome}</p>
                <p className="text-xs text-ink-3">Entra no ar com: {t.entrega}</p>
              </div>
              <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Passo 7: Visão geral volta a ser honesta.** A versão da v0 inventa KPIs, agentes e atividade. Volte à versão da `staging` (a Tarefa 9 a redesenha com dado real) e converta as duas classes antigas.

```bash
git checkout staging -- "app/(dashboard)/dashboard/page.tsx"
sed -i 's/text-\[var(--text-2)\]/text-ink-2/g' "app/(dashboard)/dashboard/page.tsx"
```

- [ ] **Passo 8: rodar tudo.**

```bash
npx vitest run tests/architecture && npx tsc --noEmit
```
Esperado: PASS. Em `http://localhost:3000/dashboard/patients` (logado como clínica), agora vem 404. Em `/admin/design-system/telas/pacientes` (logado como admin), o protótipo aparece com a faixa azul.

- [ ] **Passo 9: commit.**

```bash
git add -A "app/(dashboard)" "app/(admin)" components/patterns tests/architecture/rotas.test.ts
git commit -m "fix: tira dado inventado do painel da clínica e move as telas da v0 para protótipo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Kit de formulário, cartão, vazio e status

**Arquivos:**
- Criar: `components/patterns/formulario.tsx`, `components/patterns/cartao.tsx`, `components/patterns/vazio.tsx`
- Reescrever: `components/patterns/status-badge.tsx`
- Criar: `components/agents/status-do-agente.tsx`
- Criar: `app/(dashboard)/dashboard/settings/escolha-de-convenios.tsx`
- Apagar: `app/(dashboard)/dashboard/settings/ui.tsx`, `app/(dashboard)/dashboard/agents/ui.tsx`
- Modificar (imports e `Selo`): `settings/abas-cadastro.tsx`, `settings/abas-sensiveis.tsx`, `settings/page.tsx`, `agents/formulario.tsx`, `agents/lista.tsx`, `components/patterns/workspace-page.tsx`
- Testes: `components/patterns/formulario.test.tsx`, `components/agents/status-do-agente.test.tsx`

**Interfaces:**
- Produz:
  - `EstadoDeFormulario = { error: string | null; success: string | null }` e `estadoInicial`;
  - `Campo({ label, hint?, children })`;
  - `Input`, `Textarea` e `Select` (mesmas props dos nativos);
  - `Botao({ variante?: "primario" | "marca" | "secundario" | "perigo", ...button })`;
  - `Aviso({ state })`, `Cartao({ titulo?, descricao?, acao?, className?, children })` e `Vazio({ children, acao? })`;
  - `StatusBadge({ tone?: StatusTone, children, className? })` e `StatusTone`;
  - `StatusDoAgente({ status })` e `TOM_DO_STATUS`.

- [ ] **Passo 1: escrever os testes que falham.**

```tsx
// components/patterns/formulario.test.tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "./formulario"

describe("Aviso", () => {
  it("erro é anunciado como alerta", () => {
    const html = renderToStaticMarkup(<Aviso state={{ error: "CNPJ inválido", success: null }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("CNPJ inválido")
  })

  it("sucesso é anunciado como status, sem a urgência de um alerta", () => {
    const html = renderToStaticMarkup(<Aviso state={{ error: null, success: "Salvo." }} />)
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it("sem mensagem não ocupa espaço", () => {
    expect(renderToStaticMarkup(<Aviso state={estadoInicial} />)).toBe("")
  })
})

describe("Campo", () => {
  it("o rótulo envolve o controle, associando os dois sem id", () => {
    const html = renderToStaticMarkup(
      <Campo label="Nome">
        <Input name="name" />
      </Campo>,
    )
    expect(html.startsWith("<label")).toBe(true)
    expect(html.endsWith("</label>")).toBe(true)
    expect(html).toContain('name="name"')
  })
})

describe("controles nativos", () => {
  // As server actions leem FormData: o controle precisa continuar sendo
  // o elemento nativo, com o mesmo name.
  it("Select continua um <select> nativo com name", () => {
    const html = renderToStaticMarkup(
      <Select name="specialty" defaultValue="odonto">
        <option value="odonto">Odontologia</option>
      </Select>,
    )
    expect(html).toMatch(/<select[^>]*name="specialty"/)
  })

  it("Botao preserva type e name", () => {
    const html = renderToStaticMarkup(
      <Botao type="submit" name="intent" value="salvar">
        Salvar
      </Botao>,
    )
    expect(html).toMatch(/<button[^>]*type="submit"/)
    expect(html).toContain('name="intent"')
  })
})
```

```tsx
// components/agents/status-do-agente.test.tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ROTULO_DO_STATUS } from "@/lib/agent-config/schema"
import { StatusDoAgente, TOM_DO_STATUS } from "./status-do-agente"

describe("StatusDoAgente", () => {
  it("pausado é o único estado em alerta", () => {
    expect(TOM_DO_STATUS).toEqual({ active: "success", paused: "warning", draft: "neutral" })
  })

  it("o texto sempre diz o estado — cor nunca é a única pista", () => {
    for (const status of ["draft", "active", "paused"] as const) {
      const html = renderToStaticMarkup(<StatusDoAgente status={status} />)
      expect(html).toContain(ROTULO_DO_STATUS[status])
    }
  })

  it("usa o tom do status", () => {
    expect(renderToStaticMarkup(<StatusDoAgente status="paused" />)).toContain("text-warning-fg")
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.**

```bash
npx vitest run components/patterns/formulario.test.tsx components/agents
```
Esperado: FAIL, "Failed to resolve import ./formulario". Se a falha for `React is not defined`, adicione `oxc: { jsx: { runtime: "automatic" } }` na raiz do objeto de `vitest.config.mts` e rode de novo.

- [ ] **Passo 3: implementar o kit de formulário.**

```tsx
// components/patterns/formulario.tsx
import type { ComponentProps, ReactNode } from "react"
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Kit de formulário do painel.
 *
 * Os formulários são server actions que leem FormData: estes são controles
 * NATIVOS estilizados, então `name`, `value` e `defaultValue` chegam à
 * action exatamente como antes. Select e Checkbox do Radix ficam de fora
 * por isso — o valor deles não viaja no FormData do mesmo jeito.
 */

/** Estado que toda server action de formulário do painel devolve. */
export type EstadoDeFormulario = { error: string | null; success: string | null }

export const estadoInicial: EstadoDeFormulario = { error: null, success: null }

const CONTROLE =
  "w-full min-w-0 rounded-control border border-hairline bg-surface-0/60 px-3 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"

/**
 * Rótulo e controle. O `<label>` envolve o controle, o que associa os dois
 * sem precisar de `id`: clicar no rótulo foca o campo e o leitor de tela
 * anuncia o nome. Um Campo envolve um controle só.
 */
export function Campo({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-ink-2">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(CONTROLE, "h-10", className)} />
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(CONTROLE, "min-h-20 resize-y py-2.5 leading-relaxed", className)}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={cn(CONTROLE, "h-10 appearance-none pr-9", className)} />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
      />
    </span>
  )
}

type Variante = "primario" | "marca" | "secundario" | "perigo"

const VARIANTES: Record<
  Variante,
  { variant: "default" | "brand" | "outline"; className?: string }
> = {
  primario: { variant: "default" },
  marca: { variant: "brand" },
  secundario: { variant: "outline" },
  perigo: {
    variant: "outline",
    className:
      "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
  },
}

/**
 * Botão dos formulários do painel.
 *
 * - `primario`: salvar, criar — a ação principal do bloco.
 * - `marca`: ligar algo (publicar). No máximo uma por tela.
 * - `secundario`: cancelar, trocar.
 * - `perigo`: primeiro passo de algo destrutivo, sempre seguido de confirmação.
 */
export function Botao({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  const v = VARIANTES[variante]
  return <Button variant={v.variant} className={cn(v.className, className)} {...props} />
}

/**
 * Resultado da última submissão. `role="alert"` no erro e `role="status"`
 * no sucesso: o leitor de tela anuncia os dois, com a urgência certa.
 */
export function Aviso({ state }: { state: EstadoDeFormulario }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{state.error}</span>
      </p>
    )
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-fg"
      >
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{state.success}</span>
      </p>
    )
  }
  return null
}
```

- [ ] **Passo 4: `Cartao`, `Vazio` e `StatusBadge`.**

```tsx
// components/patterns/cartao.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Um bloco de uma tela: título, descrição do que ele controla, e o conteúdo. */
export function Cartao({
  titulo,
  descricao,
  acao,
  className,
  children,
}: {
  titulo?: string
  descricao?: string
  acao?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn("rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6", className)}
    >
      {(titulo || acao) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {titulo && <h2 className="text-[0.9375rem] font-semibold text-ink-1">{titulo}</h2>}
            {descricao && <p className="max-w-prose text-sm text-ink-2">{descricao}</p>}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
```

```tsx
// components/patterns/vazio.tsx
import type { ReactNode } from "react"

/** Estado vazio: diz o que falta e, quando houver, o próximo passo. */
export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-hairline px-6 py-10 text-center">
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{children}</p>
      {acao}
    </div>
  )
}
```

```tsx
// components/patterns/status-badge.tsx
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TOM: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-neutral-border bg-neutral-bg text-neutral-fg",
}

/**
 * Estado de qualquer coisa do produto: agente, conversa, template, clínica.
 * O domínio escolhe o tom; o texto sempre diz o estado — cor nunca é a
 * única pista. O ponto é o badge em pílula do hero da landing.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2.5", TOM[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
      {children}
    </Badge>
  )
}
```

```tsx
// components/agents/status-do-agente.tsx
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { ROTULO_DO_STATUS, type AgentStatus } from "@/lib/agent-config/schema"

/**
 * `active` acende, `paused` alerta, `draft` fica neutro: pausado é o único
 * estado em que a clínica pode achar que está atendendo sem estar.
 */
export const TOM_DO_STATUS: Record<AgentStatus, StatusTone> = {
  active: "success",
  paused: "warning",
  draft: "neutral",
}

export function StatusDoAgente({ status }: { status: AgentStatus }) {
  return <StatusBadge tone={TOM_DO_STATUS[status]}>{ROTULO_DO_STATUS[status]}</StatusBadge>
}
```

- [ ] **Passo 5: `EscolhaDeConvenios` ganha arquivo próprio.**

```tsx
// app/(dashboard)/dashboard/settings/escolha-de-convenios.tsx
/**
 * Lista de convênios como checkboxes.
 *
 * Um profissional pode aceitar convênio que outro da mesma equipe não
 * aceita, e um procedimento pode ser coberto por uns e não por outros —
 * por isso a escolha é por linha, e não uma configuração única da clínica.
 */
export function EscolhaDeConvenios({
  convenios,
  marcados,
}: {
  convenios: readonly { id: string; name: string; active: boolean }[]
  marcados: readonly string[]
}) {
  if (convenios.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        Nenhum convênio cadastrado ainda. Use a seção Convênios primeiro.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {convenios.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            name="insurance_ids"
            value={c.id}
            defaultChecked={marcados.includes(c.id)}
            className="size-4 accent-brand"
          />
          {c.name}
          {!c.active && <span className="text-ink-3">(inativo)</span>}
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Passo 6: apontar as telas para o kit.** Troque o bloco `import { ... } from "./ui"` de cada arquivo pelo bloco abaixo.

`settings/abas-cadastro.tsx`:
```ts
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { Vazio } from "@/components/patterns/vazio"
import { StatusBadge } from "@/components/patterns/status-badge"
import { EscolhaDeConvenios } from "./escolha-de-convenios"
```
`settings/abas-sensiveis.tsx`:
```ts
import { Aviso, Botao, Campo, Input, Textarea, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { Vazio } from "@/components/patterns/vazio"
import { StatusBadge } from "@/components/patterns/status-badge"
```
`settings/page.tsx` (a linha `import { Selo } from "./ui"`):
```ts
import { StatusBadge } from "@/components/patterns/status-badge"
```
`agents/formulario.tsx`:
```ts
import { Aviso, Botao, Campo, Input, Select, Textarea, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
```
`agents/lista.tsx`:
```ts
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
```
Depois, os selos:
```bash
S="app/(dashboard)/dashboard/settings"; A="app/(dashboard)/dashboard/agents"
sed -i 's/<Selo tom="ativo">/<StatusBadge tone="success">/g; s/<Selo tom="alerta">/<StatusBadge tone="warning">/g; s/<Selo tom="neutro">/<StatusBadge tone="neutral">/g; s/<Selo>/<StatusBadge>/g; s/<\/Selo>/<\/StatusBadge>/g' "$S/abas-cadastro.tsx" "$S/abas-sensiveis.tsx" "$S/page.tsx"
sed -i 's/SeloDeStatus/StatusDoAgente/g' "$A/formulario.tsx" "$A/lista.tsx"
git rm -q "$S/ui.tsx" "$A/ui.tsx"
grep -rn "Selo\b\|from \"./ui\"" "app/(dashboard)" || echo "sem resíduos"
```
Esperado: `sem resíduos`.

Em `components/patterns/workspace-page.tsx`, a `DataRow` passa o tom explicitamente. Troque `<StatusBadge status={status}>` por `<StatusBadge tone={status}>`.

- [ ] **Passo 7: rodar.**

```bash
npx vitest run components tests/architecture && npx tsc --noEmit
```
Esperado: PASS. No navegador, `/dashboard/settings` e `/dashboard/agents` já mostram campos com cantos de controle, botões em pílula e status com ponto.

- [ ] **Passo 8: commit.**

```bash
git add -A components "app/(dashboard)"
git commit -m "feat: kit de formulário e status do painel em components/patterns" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: `PageHeader` e o cabeçalho de todas as telas

**Arquivos:**
- Reescrever: `components/patterns/page-header.tsx`
- Reescrever: `app/(dashboard)/dashboard/agents/lista.tsx`
- Modificar: `agents/page.tsx` e `agents/[id]/page.tsx` (`SemPermissao`), `settings/page.tsx` (cabeçalho e `SemPermissao`), `components/patterns/workspace-page.tsx` e as 7 páginas de protótipo (tirar `eyebrow`)

**Interfaces:**
- Produz: `PageHeader({ title: string; description?: ReactNode; status?: ReactNode; actions?: ReactNode })`. As props `eyebrow`, `action` e `breadcrumb` da versão da v0 deixam de existir: a trilha do shell já diz onde se está.

- [ ] **Passo 1: reescrever o `PageHeader`.**

```tsx
// components/patterns/page-header.tsx
import type { ReactNode } from "react"

/**
 * Cabeçalho de toda tela do painel: título, descrição, estado e ações.
 *
 * Onde se está (grupo › tela) já aparece na trilha do cabeçalho do shell;
 * repetir isso num rótulo acima do título só empilharia a mesma informação.
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
}: {
  title: string
  description?: ReactNode
  status?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight text-ink-1 sm:text-3xl">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
```

- [ ] **Passo 2: `WorkspacePage` sem `eyebrow`.** Em `components/patterns/workspace-page.tsx`, substitua a função `WorkspacePage` inteira. A ação de protótipo vira botão desabilitado, porque não pode fingir que faz algo.

```tsx
export function WorkspacePage({
  title,
  description,
  action,
  prototipo,
  children,
}: {
  title: string
  description: string
  action?: { label: string }
  /** Quando entra no ar — obrigatório enquanto a tela for protótipo. */
  prototipo?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      {prototipo && <AvisoDePrototipo entrega={prototipo} />}
      <PageHeader
        title={title}
        description={description}
        actions={
          action ? (
            <Button type="button" disabled title="Protótipo: a ação ainda não existe">
              {action.label}
            </Button>
          ) : undefined
        }
      />
      {children}
    </div>
  )
}
```
Com o import `import { Button } from "@/components/ui/button"`. Depois:
```bash
sed -i 's/ eyebrow="[^"]*"//' app/\(admin\)/admin/design-system/telas/*/page.tsx
```

- [ ] **Passo 3: reescrever a lista de agentes.**

```tsx
// app/(dashboard)/dashboard/agents/lista.tsx
"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { ChevronRight, Plus } from "lucide-react"
import { criarAgenteAction } from "./actions"
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
import {
  ESPECIALIDADES,
  LIMITE_DE_AGENTES,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_PLANO,
  estaConectado,
  podeCriarAgente,
  type Agent,
  type ClinicPlan,
} from "@/lib/agent-config/schema"

export function ListaDeAgentes({
  agentes,
  plano,
}: {
  agentes: readonly Agent[]
  plano: ClinicPlan
}) {
  const [criando, setCriando] = useState(false)
  const [state, action, pending] = useActionState(criarAgenteAction, estadoInicial)

  const limite = LIMITE_DE_AGENTES[plano]
  const cabeMais = podeCriarAgente(plano, agentes.length)

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Agentes"
        description="Um agente por especialidade ou unidade, cada um com o próprio número de WhatsApp."
        actions={
          <>
            <span className="text-sm text-ink-3">
              {agentes.length}
              {limite !== null ? ` de ${limite}` : ""} no plano {ROTULO_DO_PLANO[plano]}
            </span>
            {!criando && (
              <Botao
                type="button"
                onClick={() => setCriando(true)}
                disabled={!cabeMais}
                // Sem o title, um botão desabilitado não diz por quê.
                title={
                  cabeMais
                    ? undefined
                    : `O plano ${ROTULO_DO_PLANO[plano]} permite ${limite} agente(s).`
                }
              >
                <Plus data-icon aria-hidden="true" />
                Novo agente
              </Botao>
            )}
          </>
        }
      />

      {!cabeMais && (
        <p className="rounded-xl border border-hairline bg-surface-1/50 px-4 py-3 text-sm text-ink-2">
          O plano {ROTULO_DO_PLANO[plano]} permite {limite}{" "}
          {limite === 1 ? "agente" : "agentes"}. Para criar mais, fale com a equipe
          Nextech sobre um upgrade.
        </p>
      )}

      {criando && (
        <Cartao
          titulo="Novo agente"
          descricao="Nome e especialidade agora; persona, horário e WhatsApp na tela seguinte."
        >
          <form action={action} className="grid gap-5">
            <Aviso state={state} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome" hint="(como sua equipe o identifica)">
                <Input name="name" required autoFocus placeholder="Recepção Odontologia" />
              </Campo>

              <Campo label="Especialidade">
                <Select name="specialty" required defaultValue="">
                  <option value="" disabled>
                    Escolha uma
                  </option>
                  {ESPECIALIDADES.map((e) => (
                    <option key={e} value={e}>
                      {ROTULO_DA_ESPECIALIDADE[e]}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>

            <div className="flex gap-2">
              <Botao type="submit" disabled={pending}>
                {pending ? "Criando…" : "Criar agente"}
              </Botao>
              <Botao type="button" variante="secundario" onClick={() => setCriando(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      {agentes.length === 0 && !criando ? (
        <Vazio
          acao={
            cabeMais ? (
              <Botao type="button" onClick={() => setCriando(true)}>
                <Plus data-icon aria-hidden="true" />
                Criar o primeiro agente
              </Botao>
            ) : undefined
          }
        >
          Nenhum agente ainda. O agente é quem responde o paciente no WhatsApp,
          com a persona e as regras da clínica.
        </Vazio>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
          {agentes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate text-sm font-medium text-ink-1">{a.name}</p>
                  <p className="text-xs text-ink-3">{ROTULO_DA_ESPECIALIDADE[a.specialty]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">
                    {estaConectado(a) ? "WhatsApp conectado" : "Sem WhatsApp"}
                  </span>
                  <StatusDoAgente status={a.status} />
                  <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Passo 4: `SemPermissao` com o padrão.** Em `agents/page.tsx` e `agents/[id]/page.tsx`, adicione os imports de `PageHeader` e `Vazio` e troque a função:

```tsx
function SemPermissao() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Agentes" />
      <Vazio>
        Só o responsável pela clínica configura os agentes. Fale com quem
        administra a conta se precisar alterar algo aqui.
      </Vazio>
    </div>
  )
}
```
Em `settings/page.tsx`, faça o mesmo com o título "Perfil da clínica" e o texto "Só o responsável pela clínica edita o perfil. Fale com quem administra a conta se precisar alterar algum dado aqui." Troque também o cabeçalho da tela:

```tsx
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Perfil da clínica"
        description={clinic.legal_name}
        status={
          <>
            {clinic.status === "active" ? (
              <StatusBadge tone="success">ativa</StatusBadge>
            ) : (
              <StatusBadge>rascunho</StatusBadge>
            )}
            {pendencias.length > 0 && (
              <StatusBadge tone="warning">
                {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
              </StatusBadge>
            )}
          </>
        }
      />

      {/* useSearchParams exige limite de Suspense para não forçar a página
          inteira a renderizar no cliente. */}
      <Suspense fallback={<div className="h-10" />}>
        <Abas secoes={secoes} />
      </Suspense>
    </div>
  )
```

- [ ] **Passo 5: rodar e olhar.**

```bash
npx tsc --noEmit && npx vitest run components tests/architecture
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t6 clinica:/dashboard/agents:dark:1440 clinica:/dashboard/settings:dark:1440 admin:/admin/design-system/telas/conversas:dark:1440
```
Esperado: títulos em Cal Sans, sem rótulo em caixa alta acima e com ações alinhadas à direita.

- [ ] **Passo 6: commit.**

```bash
git add -A components "app/(dashboard)" "app/(admin)"
git commit -m "feat: PageHeader do painel e lista de agentes redesenhada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 7: Perfil da clínica com subnavegação vertical

**Arquivos:**
- Reescrever: `app/(dashboard)/dashboard/settings/abas.tsx`
- Modificar: `app/(dashboard)/dashboard/settings/page.tsx` (lista `secoes`)

**Interfaces:**
- Produz: `Abas({ secoes: readonly Secao[] })`, com `Secao = { id: string; label: string; alertas?: number; conteudo: ReactNode }`. O contrato da query string (`?aba=<id>`) não muda.

- [ ] **Passo 1: reescrever as abas.**

```tsx
// app/(dashboard)/dashboard/settings/abas.tsx
"use client"

import * as Tabs from "@radix-ui/react-tabs"
import { useRouter, useSearchParams } from "next/navigation"

export type Secao = {
  id: string
  label: string
  /** Pendências da seção: aparece como contador ao lado do nome. */
  alertas?: number
  conteudo: React.ReactNode
}

/**
 * As sete seções do perfil numa subnavegação vertical — coluna à esquerda
 * no desktop, faixa rolável no celular.
 *
 * Seções, e não sete itens de menu: são o cadastro de uma coisa só.
 *
 * A seção escolhida vai para a query string (`?aba=equipe`): o link é
 * compartilhável, o voltar do navegador funciona e salvar não joga a
 * clínica de volta para a primeira. `scroll: false` porque trocar de seção
 * não é navegar.
 */
export function Abas({ secoes }: { secoes: readonly Secao[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const pedida = params.get("aba")
  const atual = secoes.some((s) => s.id === pedida) ? pedida! : secoes[0].id

  return (
    <Tabs.Root
      value={atual}
      orientation="vertical"
      onValueChange={(valor) => {
        const novo = new URLSearchParams(params)
        novo.set("aba", valor)
        router.replace(`?${novo}`, { scroll: false })
      }}
      className="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10"
    >
      <Tabs.List
        aria-label="Seções do perfil da clínica"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:sticky lg:top-20 lg:flex-col lg:self-start lg:overflow-visible"
      >
        {secoes.map((s) => (
          <Tabs.Trigger
            key={s.id}
            value={s.id}
            className="flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 outline-none transition-colors hover:bg-accent hover:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-ink-1"
          >
            <span>{s.label}</span>
            {s.alertas ? (
              <>
                <span
                  aria-hidden="true"
                  className="rounded-pill bg-warning-bg px-1.5 text-[0.6875rem] font-medium tabular-nums text-warning-fg"
                >
                  {s.alertas}
                </span>
                <span className="sr-only">
                  , {s.alertas} {s.alertas === 1 ? "pendência" : "pendências"}
                </span>
              </>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {secoes.map((s) => (
        <Tabs.Content key={s.id} value={s.id} className="min-w-0 outline-none">
          {s.conteudo}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
```

- [ ] **Passo 2: contadores nas seções.** Em `settings/page.tsx`:
- na entrada `id: "identidade"` da lista `secoes`, adicione `alertas: pendencias.length,`;
- na entrada `id: "urgencia"`, adicione `alertas: regras.filter((r) => r.confirmed_at === null).length,`. Regra sem confirmação não está no ar.

- [ ] **Passo 3: rodar e olhar.**

```bash
npx tsc --noEmit
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t7 clinica:/dashboard/settings:dark:1440 "clinica:/dashboard/settings?aba=equipe:dark:1440" clinica:/dashboard/settings:dark:390 clinica:/dashboard/settings:light:1440
```
Esperado:
- coluna de seções à esquerda no desktop e faixa rolável em 390px;
- `?aba=equipe` abre direto em Equipe;
- contador de pendências em Identidade, quando houver.

- [ ] **Passo 4: commit.**

```bash
git add "app/(dashboard)/dashboard/settings"
git commit -m "feat(settings): subnavegação vertical com pendências por seção" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Editor de agente com a prévia ao lado

**Arquivos:**
- Criar: `components/patterns/chat-bubble.tsx`
- Criar: `components/agents/preview-de-conversa.tsx`
- Modificar: `app/(dashboard)/dashboard/agents/formulario.tsx`

**Interfaces:**
- Produz: `ChatBubble({ lado: "paciente" | "clinica"; autor?: string; hora?: string; children })` e `PreviewDeConversa({ nome: string; saudacao: string | null })`.

- [ ] **Passo 1: a bolha de conversa.**

```tsx
// components/patterns/chat-bubble.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Mensagem no estilo do WhatsApp: paciente à esquerda, clínica à direita.
 * A cor da clínica é a marca em transparência — reconhecível como
 * WhatsApp pela forma, sem copiar o verde do app.
 */
export function ChatBubble({
  lado,
  autor,
  hora,
  children,
}: {
  lado: "paciente" | "clinica"
  /** Quem falou pela clínica: a IA ou alguém da equipe. */
  autor?: string
  hora?: string
  children: ReactNode
}) {
  const daClinica = lado === "clinica"
  return (
    <div className={cn("flex", daClinica ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          daClinica
            ? "rounded-br-md bg-brand/15 text-ink-1"
            : "rounded-bl-md border border-hairline bg-surface-1 text-ink-1",
        )}
      >
        {autor && (
          <p className="mb-0.5 text-[0.6875rem] font-medium text-brand-on-light dark:text-brand">
            {autor}
          </p>
        )}
        <p className="whitespace-pre-wrap">{children}</p>
        {hora && <p className="mt-1 text-right text-[0.6875rem] text-ink-3">{hora}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: a prévia.**

```tsx
// components/agents/preview-de-conversa.tsx
import { Bot } from "lucide-react"
import { ChatBubble } from "@/components/patterns/chat-bubble"

/**
 * Como a saudação salva chega ao paciente. Não é o teste de conversa da
 * spec (que precisa do motor de IA, fase 3b): mostra só o que já existe —
 * a primeira mensagem — e diz com todas as letras o que ainda não existe.
 */
export function PreviewDeConversa({
  nome,
  saudacao,
}: {
  nome: string
  saudacao: string | null
}) {
  return (
    <section
      aria-labelledby="previa-titulo"
      className="overflow-hidden rounded-card border border-hairline bg-surface-1/50"
    >
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand/12 text-brand-on-light dark:text-brand">
          <Bot aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="previa-titulo" className="truncate text-sm font-semibold text-ink-1">
            {nome}
          </h2>
          <p className="text-xs text-ink-3">Prévia no WhatsApp</p>
        </div>
      </header>

      <div className="grid gap-2.5 bg-surface-0/40 px-4 py-5">
        <ChatBubble lado="paciente" hora="09:41">
          Oi! Queria marcar uma consulta.
        </ChatBubble>
        {saudacao ? (
          <ChatBubble lado="clinica" autor="Assistente" hora="09:41">
            {saudacao}
          </ChatBubble>
        ) : (
          <p className="py-3 text-center text-xs text-ink-3">
            Escreva a saudação na configuração para ver como ela chega ao paciente.
          </p>
        )}
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs leading-relaxed text-ink-3">
        A mensagem do paciente é um exemplo. Testar o atendimento completo, com a
        IA respondendo, fica disponível quando o motor de conversa entrar no ar.
      </p>
    </section>
  )
}
```

- [ ] **Passo 3: montar o editor.** Em `agents/formulario.tsx`:

1. Troque os imports. Remova `import Link from "next/link"` (a trilha do shell já leva de volta a Agentes) e adicione:
```ts
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { PreviewDeConversa } from "@/components/agents/preview-de-conversa"
```
2. Substitua a função `FormularioDeAgente` inteira:
```tsx
export function FormularioDeAgente({ agente }: { agente: Agent }) {
  const pendencias = pendenciasParaPublicar(agente)
  const recomendacoes = recomendacoesAntesDePublicar(agente)
  const conectado = estaConectado(agente)

  return (
    <div className="grid gap-8">
      <PageHeader
        title={agente.name}
        description={ROTULO_DA_ESPECIALIDADE[agente.specialty]}
        status={<StatusDoAgente status={agente.status} />}
      />

      {/* Formulário e prévia lado a lado (skill ui-ux): a clínica vê o
          efeito da saudação antes de publicar. No celular a prévia desce. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <Publicacao agente={agente} pendencias={pendencias} recomendacoes={recomendacoes} />
          <Configuracao agente={agente} />
          <ConexaoWhatsapp agente={agente} conectado={conectado} />
          <ZonaDeRisco agente={agente} />
        </div>
        <aside className="lg:sticky lg:top-20">
          <PreviewDeConversa nome={agente.name} saudacao={agente.greeting_message} />
        </aside>
      </div>
    </div>
  )
}
```
3. Apague a função `PreviewPendente` e o bloco de comentário acima dela ("Preview — fase 3b").
4. Em `Publicacao`, o botão de publicar é a ação que liga o agente. Troque `<Botao type="submit" disabled={publicando || bloqueado}>` por `<Botao type="submit" variante="marca" disabled={publicando || bloqueado}>`.
5. No bloco "Falta para publicar", troque a classe da `div` por `rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-fg` e a da `ul` por `mt-1.5 list-inside list-disc`.
6. Em `ConexaoWhatsapp`, troque o `span` de `acao` ("conectado") por `<StatusBadge tone="success">conectado</StatusBadge>`.
7. Nos dois `<input type="time">` de `Configuracao`, troque a classe por `h-9 rounded-control border border-hairline bg-surface-0/60 px-2.5 text-sm text-ink-1 [color-scheme:light] dark:[color-scheme:dark]`.

- [ ] **Passo 4: rodar e olhar.**

```bash
npx tsc --noEmit && npx vitest run components tests/architecture
```
Crie um agente pela tela (logado como clínica), preencha a saudação, salve e confira:
```bash
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t8 clinica:/dashboard/agents:dark:1440
```
Esperado: a prévia à direita, fixa ao rolar, com a saudação salva numa bolha à direita, e o botão "Publicar agente" verde.

- [ ] **Passo 5: commit.**

```bash
git add -A components "app/(dashboard)/dashboard/agents"
git commit -m "feat(agents): editor com prévia da saudação ao lado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 9: Visão geral com dado real

**Arquivos:**
- Criar: `lib/onboarding/passos.ts`, `lib/onboarding/passos.test.ts`
- Reescrever: `components/patterns/kpi-card.tsx`
- Reescrever: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consome: `getCurrentClinic`, `getRegulatoryIdentity`, `listProfessionals`, `listProcedures`, `listAgents`, `pendenciasRegulatorias`, `estaConectado` e `ROTULO_DA_ESPECIALIDADE` (todos já existem em `lib/`).
- Produz: `passosDoOnboarding(d: DadosDoOnboarding): Passo[]`, `proximoPasso(p: readonly Passo[]): Passo | null` e `KpiCard({ label, value?, detail?, icon?, pendente? })`.

- [ ] **Passo 1: escrever o teste que falha.**

```ts
// lib/onboarding/passos.test.ts
import { describe, expect, it } from "vitest"
import { passosDoOnboarding, proximoPasso, type DadosDoOnboarding } from "./passos"

const NOVA: DadosDoOnboarding = {
  pendenciasRegulatorias: 4,
  profissionaisAtivos: 0,
  procedimentosAtivos: 0,
  agentes: [],
}

const PRONTA: DadosDoOnboarding = {
  pendenciasRegulatorias: 0,
  profissionaisAtivos: 2,
  procedimentosAtivos: 5,
  agentes: [{ status: "active", conectado: true }],
}

describe("passosDoOnboarding", () => {
  it("segue a ordem de dependência: cada passo usa o que o anterior deixou pronto", () => {
    expect(passosDoOnboarding(NOVA).map((p) => p.id)).toEqual([
      "perfil",
      "equipe",
      "procedimentos",
      "agente",
      "whatsapp",
      "publicado",
    ])
  })

  it("clínica nova não tem nenhum passo feito e começa pelo perfil", () => {
    const passos = passosDoOnboarding(NOVA)
    expect(passos.every((p) => !p.feito)).toBe(true)
    expect(proximoPasso(passos)?.id).toBe("perfil")
  })

  it("perfil só conta sem nenhuma pendência regulatória", () => {
    const passos = passosDoOnboarding({ ...PRONTA, pendenciasRegulatorias: 1 })
    expect(passos.find((p) => p.id === "perfil")?.feito).toBe(false)
    expect(proximoPasso(passos)?.id).toBe("perfil")
  })

  it("equipe e procedimentos contam só o que está ativo", () => {
    const passos = passosDoOnboarding({ ...PRONTA, profissionaisAtivos: 0, procedimentosAtivos: 0 })
    expect(passos.find((p) => p.id === "equipe")?.feito).toBe(false)
    expect(passos.find((p) => p.id === "procedimentos")?.feito).toBe(false)
  })

  it("WhatsApp conta com qualquer agente conectado", () => {
    const passos = passosDoOnboarding({
      ...PRONTA,
      agentes: [
        { status: "draft", conectado: false },
        { status: "draft", conectado: true },
      ],
    })
    expect(passos.find((p) => p.id === "whatsapp")?.feito).toBe(true)
  })

  it("agente pausado não conta como no ar", () => {
    const passos = passosDoOnboarding({ ...PRONTA, agentes: [{ status: "paused", conectado: true }] })
    expect(passos.find((p) => p.id === "publicado")?.feito).toBe(false)
    expect(proximoPasso(passos)?.id).toBe("publicado")
  })

  it("clínica pronta não tem próximo passo", () => {
    expect(proximoPasso(passosDoOnboarding(PRONTA))).toBeNull()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.**

```bash
npx vitest run lib/onboarding
```
Esperado: FAIL, "Failed to resolve import ./passos".

- [ ] **Passo 3: implementar.**

```ts
// lib/onboarding/passos.ts

/**
 * Primeiros passos de uma clínica no Nextech, derivados só de dado que já
 * existe — nenhum passo é marcado à mão.
 *
 * A ordem é a de dependência: o agente usa equipe e procedimentos na
 * conversa, e só atende depois de ter número conectado e ser publicado.
 */

export type EstadoDoAgente = {
  status: "draft" | "active" | "paused"
  conectado: boolean
}

export type DadosDoOnboarding = {
  pendenciasRegulatorias: number
  profissionaisAtivos: number
  procedimentosAtivos: number
  agentes: readonly EstadoDoAgente[]
}

export type Passo = {
  id: "perfil" | "equipe" | "procedimentos" | "agente" | "whatsapp" | "publicado"
  titulo: string
  descricao: string
  /** Texto do botão que leva ao passo. */
  acao: string
  href: string
  feito: boolean
}

export function passosDoOnboarding(d: DadosDoOnboarding): Passo[] {
  return [
    {
      id: "perfil",
      titulo: "Identidade regulatória",
      descricao: "CNPJ e responsável técnico, exigidos pelo conselho.",
      acao: "Completar o perfil",
      href: "/dashboard/settings?aba=identidade",
      feito: d.pendenciasRegulatorias === 0,
    },
    {
      id: "equipe",
      titulo: "Equipe",
      descricao: "Os profissionais que atendem, com conselho e registro.",
      acao: "Cadastrar a equipe",
      href: "/dashboard/settings?aba=equipe",
      feito: d.profissionaisAtivos > 0,
    },
    {
      id: "procedimentos",
      titulo: "Procedimentos",
      descricao: "O que a clínica oferece e quanto tempo cada um leva.",
      acao: "Cadastrar procedimentos",
      href: "/dashboard/settings?aba=procedimentos",
      feito: d.procedimentosAtivos > 0,
    },
    {
      id: "agente",
      titulo: "Agente",
      descricao: "Quem responde o paciente no WhatsApp, com a persona da clínica.",
      acao: "Criar o agente",
      href: "/dashboard/agents",
      feito: d.agentes.length > 0,
    },
    {
      id: "whatsapp",
      titulo: "WhatsApp",
      descricao: "O número em que o agente atende.",
      acao: "Conectar o WhatsApp",
      href: "/dashboard/agents",
      feito: d.agentes.some((a) => a.conectado),
    },
    {
      id: "publicado",
      titulo: "Agente no ar",
      descricao: "Publicado, o agente passa a responder pacientes de verdade.",
      acao: "Publicar o agente",
      href: "/dashboard/agents",
      feito: d.agentes.some((a) => a.status === "active"),
    },
  ]
}

/** O primeiro passo pendente, ou `null` quando a clínica está pronta. */
export function proximoPasso(passos: readonly Passo[]): Passo | null {
  return passos.find((p) => !p.feito) ?? null
}
```

- [ ] **Passo 4: rodar.**

```bash
npx vitest run lib/onboarding
```
Esperado: 7 passando.

- [ ] **Passo 5: `KpiCard` com estado pendente.**

```tsx
// components/patterns/kpi-card.tsx
import type { ReactNode } from "react"

/**
 * Um indicador. Sem fonte de dado ainda, `pendente` diz de onde o número
 * vai vir — nunca um zero, que seria lido como resultado (regra de
 * dashboard-overview-v1).
 */
export function KpiCard({
  label,
  value,
  detail,
  icon,
  pendente,
}: {
  label: string
  value?: string
  detail?: ReactNode
  icon?: ReactNode
  pendente?: string
}) {
  return (
    <section className="flex min-h-32 flex-col justify-between gap-4 rounded-card border border-hairline bg-surface-1/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm text-ink-2">{label}</h3>
        {icon && (
          <span aria-hidden="true" className="text-ink-3 [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      {pendente ? (
        <div className="grid gap-1">
          <p aria-hidden="true" className="font-display text-3xl text-ink-3">
            —
          </p>
          <p className="text-xs leading-relaxed text-ink-3">{pendente}</p>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-3xl text-ink-1">{value}</p>
          {detail && <div className="text-xs text-ink-2">{detail}</div>}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Passo 6: a Visão geral.**

```tsx
// app/(dashboard)/dashboard/page.tsx
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarCheck, Check, MessagesSquare, Repeat2, UserX } from "lucide-react"
import { requireClinicContext } from "@/lib/auth/context"
import { getCurrentClinic } from "@/lib/clinics/queries"
import {
  getRegulatoryIdentity,
  listProcedures,
  listProfessionals,
} from "@/lib/clinic-profile/queries"
import { pendenciasRegulatorias } from "@/lib/clinic-profile/schema"
import { listAgents } from "@/lib/agent-config/queries"
import { ROTULO_DA_ESPECIALIDADE, estaConectado, type Agent } from "@/lib/agent-config/schema"
import { passosDoOnboarding, proximoPasso, type Passo } from "@/lib/onboarding/passos"
import { PageHeader } from "@/components/patterns/page-header"
import { KpiCard } from "@/components/patterns/kpi-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
}

// Reflete cada passo que a clínica acabou de concluir — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { role } = await requireClinicContext()

  // Profissional não tem visão geral no menu (seção 2 do desenho de
  // navegação), mas `/dashboard` é a raiz e ele cai aqui ao entrar.
  if (role === "professional") return <AguardandoMinhasTelas />

  const clinic = await getCurrentClinic()
  const ativa = clinic.status === "active"
  const cabecalho = (
    <PageHeader
      title="Visão geral"
      description={clinic.legal_name}
      status={
        <StatusBadge tone={ativa ? "success" : "neutral"}>
          {ativa ? "Clínica ativa" : "Em configuração"}
        </StatusBadge>
      }
    />
  )

  // Primeiros passos e agentes são configuração: só o owner age sobre eles.
  if (role !== "owner") {
    return (
      <div className="grid gap-10">
        {cabecalho}
        <Indicadores />
      </div>
    )
  }

  const [identidade, profissionais, procedimentos, agentes] = await Promise.all([
    getRegulatoryIdentity(),
    listProfessionals(),
    listProcedures(),
    listAgents(),
  ])

  const passos = passosDoOnboarding({
    pendenciasRegulatorias: pendenciasRegulatorias(identidade).length,
    profissionaisAtivos: profissionais.filter((p) => p.active).length,
    procedimentosAtivos: procedimentos.filter((p) => p.active).length,
    agentes: agentes.map((a) => ({ status: a.status, conectado: estaConectado(a) })),
  })
  const proximo = proximoPasso(passos)

  return (
    <div className="grid gap-10">
      {cabecalho}
      {proximo && <PrimeirosPassos passos={passos} proximo={proximo} />}
      <Indicadores />
      <SeusAgentes agentes={agentes} />
    </div>
  )
}

/**
 * O elemento memorável da tela: o caminho do cadastro ao primeiro paciente
 * atendido, com o brilho da aurora da landing. Some quando tudo está feito.
 */
function PrimeirosPassos({ passos, proximo }: { passos: Passo[]; proximo: Passo }) {
  const feitos = passos.filter((p) => p.feito).length

  return (
    <section
      aria-labelledby="passos-titulo"
      className="painel-glow rounded-card border border-hairline p-6 sm:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="grid content-start gap-4">
          <h2 id="passos-titulo" className="font-display text-2xl tracking-tight text-ink-1">
            Primeiros passos
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">
            Do cadastro ao primeiro paciente atendido. Cada passo usa o que o
            anterior deixou pronto.
          </p>
          <div className="grid gap-2">
            <p className="text-xs text-ink-3">
              {feitos} de {passos.length} concluídos
            </p>
            <Progress
              value={(feitos / passos.length) * 100}
              aria-label="Progresso da configuração"
              className="h-1.5 bg-surface-2 [&_[data-slot=progress-indicator]]:bg-brand"
            />
          </div>
          <Button asChild variant="brand" className="w-fit">
            <Link href={proximo.href}>
              {proximo.acao}
              <ArrowRight data-icon aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <ol className="grid gap-1">
          {passos.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex gap-3 rounded-xl px-3 py-2.5",
                p.id === proximo.id && "bg-accent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border",
                  p.feito ? "border-transparent bg-brand text-surface-0" : "border-hairline",
                )}
              >
                {p.feito && <Check className="size-3" />}
              </span>
              <div className="grid gap-0.5">
                <p className={cn("text-sm font-medium", p.feito ? "text-ink-3" : "text-ink-1")}>
                  {p.titulo}
                  <span className="sr-only">{p.feito ? ", concluído" : ", pendente"}</span>
                </p>
                <p className="text-xs text-ink-3">{p.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Os quatro KPIs da spec. Nenhum tem fonte ainda: cada um diz de onde vem. */
function Indicadores() {
  return (
    <section aria-labelledby="indicadores-titulo" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="indicadores-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Indicadores do mês
        </h2>
        <p className="text-xs text-ink-3">Chegam quando o atendimento estiver no ar</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Atendimentos"
          icon={<MessagesSquare />}
          pendente="Contados quando o agente começar a conversar com pacientes."
        />
        <KpiCard
          label="Conversão em agendamento"
          icon={<CalendarCheck />}
          pendente="Depende do motor de conversa identificar quem quer agendar."
        />
        <KpiCard label="Faltas" icon={<UserX />} pendente="Depende da agenda integrada." />
        <KpiCard
          label="Pacientes reativados"
          icon={<Repeat2 />}
          pendente="Depende das sequências de reativação."
        />
      </div>
    </section>
  )
}

function SeusAgentes({ agentes }: { agentes: Agent[] }) {
  return (
    <section aria-labelledby="agentes-titulo" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agentes-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Agentes
        </h2>
        <Link
          href="/dashboard/agents"
          className="text-sm text-ink-2 underline-offset-4 transition-colors hover:text-ink-1 hover:underline"
        >
          Gerenciar agentes
        </Link>
      </div>
      {agentes.length === 0 ? (
        <Vazio>Nenhum agente criado ainda. Ele aparece aqui assim que existir.</Vazio>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
          {agentes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent"
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate text-sm font-medium text-ink-1">{a.name}</p>
                  <p className="text-xs text-ink-3">{ROTULO_DA_ESPECIALIDADE[a.specialty]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">
                    {estaConectado(a) ? "WhatsApp conectado" : "Sem WhatsApp"}
                  </span>
                  <StatusDoAgente status={a.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Estado do profissional: as telas dele (Agenda e Pacientes) ainda não
 * existem. Diz o que vai aparecer aqui, em vez de deixar a tela muda.
 */
function AguardandoMinhasTelas() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Sua área está chegando" />
      <Vazio>
        Sua agenda e seus pacientes aparecem aqui assim que estiverem prontos. O
        menu à esquerda mostra o que vem primeiro.
      </Vazio>
    </div>
  )
}
```
Antes de rodar, confira o `data-slot` do indicador: `grep -n "data-slot" components/ui/progress.tsx`. Se não for `progress-indicator`, ajuste o seletor da classe do `Progress`.

- [ ] **Passo 7: rodar e olhar.**

```bash
npx tsc --noEmit && npx vitest run lib/onboarding components tests/architecture
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t9 clinica:/dashboard:dark:1440 clinica:/dashboard:light:1440 clinica:/dashboard:dark:390
```
Esperado:
- "Primeiros passos" com o progresso real da clínica de teste;
- os quatro indicadores com "—" e a explicação de cada um;
- "Agentes" com a lista real ou o estado vazio;
- nenhum número inventado.

- [ ] **Passo 8: commit.**

```bash
git add lib/onboarding components/patterns/kpi-card.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): visão geral com primeiros passos e indicadores honestos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 10: Painel interno — Clínicas

**Arquivos:**
- Reescrever: `app/(admin)/admin/page.tsx`, `app/(admin)/admin/clinica-row.tsx`, `app/(admin)/admin/nova-clinica-form.tsx`

**Interfaces:**
- Consome: `listClinics` e `getPlatformStats` (`lib/admin/queries`), as actions de `app/(admin)/admin/actions.ts` (sem mudança), `Table*` (`components/ui/table`) e o kit da Tarefa 5.

- [ ] **Passo 1: a página.**

```tsx
// app/(admin)/admin/page.tsx
import type { Metadata } from "next"
import { listClinics, getPlatformStats } from "@/lib/admin/queries"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NovaClinicaForm } from "./nova-clinica-form"
import { ClinicaRow } from "./clinica-row"

export const metadata: Metadata = {
  title: "Clínicas",
  robots: { index: false, follow: false },
}

// Painel interno lê estado que muda a cada ação — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const [clinicas, stats] = await Promise.all([listClinics(), getPlatformStats()])

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Clínicas"
        description="Onboarding consultivo: a equipe cria a clínica e convida o primeiro responsável."
        actions={<Numeros total={stats.total} ativas={stats.ativas} rascunho={stats.rascunho} />}
      />

      <NovaClinicaForm />

      {clinicas.length === 0 ? (
        <Vazio>Nenhuma clínica cadastrada ainda. Crie a primeira no botão acima.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table>
            <TableHeader className="bg-surface-2/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Razão social</TableHead>
                <TableHead className="px-4">CNPJ</TableHead>
                <TableHead className="px-4">Equipe</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicas.map((c) => (
                <ClinicaRow key={c.id} clinica={c} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Numeros({ total, ativas, rascunho }: { total: number; ativas: number; rascunho: number }) {
  const itens = [
    { rotulo: "no total", valor: total },
    { rotulo: "ativas", valor: ativas },
    { rotulo: "em rascunho", valor: rascunho },
  ]
  return (
    <dl className="flex gap-6">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-col-reverse">
          <dt className="text-xs text-ink-3">{i.rotulo}</dt>
          <dd className="font-display text-2xl text-ink-1">{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
```

- [ ] **Passo 2: a linha.**

```tsx
// app/(admin)/admin/clinica-row.tsx
"use client"

import { useActionState, useState } from "react"
import { alternarStatusAction, convidarOwnerAction, type AdminFormState } from "./actions"
import type { ClinicResumo } from "@/lib/admin/schema"
import { Aviso, Botao, Campo, Input } from "@/components/patterns/formulario"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"

const estadoInicial: AdminFormState = { error: null, success: null }

export function ClinicaRow({ clinica }: { clinica: ClinicResumo }) {
  const [convidando, setConvidando] = useState(false)
  const [conviteState, convidarAction, convitePending] = useActionState(
    convidarOwnerAction,
    estadoInicial,
  )
  const [, statusAction, statusPending] = useActionState(alternarStatusAction, estadoInicial)

  const ativa = clinica.status === "active"
  const semEquipe = clinica.member_count === 0

  return (
    <>
      <TableRow>
        <TableCell className="px-4 font-medium text-ink-1">{clinica.legal_name}</TableCell>
        <TableCell className="px-4 tabular-nums text-ink-2">{clinica.cnpj ?? "—"}</TableCell>
        <TableCell className="px-4">
          {semEquipe ? (
            <StatusBadge tone="warning">sem responsável</StatusBadge>
          ) : (
            <span className="text-ink-2">
              {clinica.member_count} {clinica.member_count === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </TableCell>
        <TableCell className="px-4">
          <StatusBadge tone={ativa ? "success" : "neutral"}>{ativa ? "ativa" : "rascunho"}</StatusBadge>
        </TableCell>
        <TableCell className="px-4">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={convidando}
              onClick={() => setConvidando((v) => !v)}
            >
              Convidar responsável
            </Button>
            <form action={statusAction}>
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <input type="hidden" name="status" value={ativa ? "draft" : "active"} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={statusPending || (semEquipe && !ativa)}
                title={semEquipe && !ativa ? "Convide o responsável antes de ativar" : undefined}
              >
                {ativa ? "Voltar para rascunho" : "Ativar"}
              </Button>
            </form>
          </div>
        </TableCell>
      </TableRow>

      {convidando && (
        <TableRow className="bg-surface-2/40 hover:bg-surface-2/40">
          <TableCell colSpan={5} className="px-4 py-4 whitespace-normal">
            <form action={convidarAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <div className="w-full max-w-sm">
                <Campo label="E-mail do responsável">
                  <Input name="email" type="email" required placeholder="responsavel@clinica.com.br" />
                </Campo>
              </div>
              <Botao type="submit" disabled={convitePending}>
                {convitePending ? "Criando…" : "Criar acesso"}
              </Botao>
            </form>

            <div className="mt-3 grid max-w-xl gap-2">
              <Aviso state={conviteState} />
              {conviteState.senhaProvisoria && (
                <div className="grid gap-1.5 rounded-xl border border-warning-border bg-warning-bg px-4 py-3">
                  <p className="text-xs font-medium text-warning-fg">
                    Senha provisória. Copie agora: ela não é mostrada de novo.
                  </p>
                  <code className="w-fit rounded-lg border border-hairline bg-surface-0 px-3 py-1.5 font-mono text-sm text-ink-1">
                    {conviteState.senhaProvisoria}
                  </code>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
```

- [ ] **Passo 3: o formulário de nova clínica.**

```tsx
// app/(admin)/admin/nova-clinica-form.tsx
"use client"

import { useActionState, useState } from "react"
import { Plus } from "lucide-react"
import { criarClinicaAction, type AdminFormState } from "./actions"
import { Aviso, Botao, Campo, Input } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"

const estadoInicial: AdminFormState = { error: null, success: null }

export function NovaClinicaForm() {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, pending] = useActionState(criarClinicaAction, estadoInicial)

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" onClick={() => setAberto(true)}>
          <Plus data-icon aria-hidden="true" />
          Nova clínica
        </Botao>
        {state.success && <Aviso state={{ error: null, success: state.success }} />}
      </div>
    )
  }

  return (
    <Cartao
      titulo="Nova clínica"
      descricao="A clínica nasce em rascunho. Ative depois de convidar o responsável."
    >
      <form action={formAction} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Razão social">
            <Input name="legal_name" required autoFocus placeholder="Clínica Exemplo Ltda" />
          </Campo>
          <Campo label="CNPJ" hint="(opcional agora)">
            <Input name="cnpj" placeholder="00.000.000/0000-00" />
          </Campo>
        </div>

        <Aviso state={{ error: state.error, success: null }} />

        <div className="flex gap-2">
          <Botao type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar clínica"}
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Cartao>
  )
}
```

- [ ] **Passo 4: rodar e olhar.**

```bash
npx tsc --noEmit && npx vitest run tests/architecture lib/admin
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t10 admin:/admin:dark:1440 admin:/admin:light:1440 admin:/admin:dark:390
```
Esperado: tabela com status em pílula e ações discretas. Em 390px a tabela rola na horizontal dentro do cartão (o `Table` do shadcn já envolve em `overflow-x-auto`), sem estourar a página.

- [ ] **Passo 5: commit.**

```bash
git add "app/(admin)/admin"
git commit -m "feat(admin): lista de clínicas no design system" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 11: Login com a identidade da landing

**Arquivos:**
- Reescrever: `app/(auth)/login/page.tsx`, `app/(auth)/login/login-form.tsx`

**Interfaces:**
- Consome: `Background` (`components/background.tsx`, a aurora da landing; só é importado, não modificado), `login` e `LoginState` (`lib/auth/actions`), e o kit.

- [ ] **Passo 1: a página.**

```tsx
// app/(auth)/login/page.tsx
import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Background } from "@/components/background"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da sua clínica no Nextech.",
  // Tela de acesso não deve aparecer em busca.
  robots: { index: false, follow: false },
}

/**
 * A única tela do painel com a aurora de verdade: é a porta de entrada, vista
 * uma vez por sessão — o custo do WebGL aqui não se repete o dia inteiro.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-0 px-4 py-12">
      <Background />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image
            src="/Logo.png"
            alt="Nextech"
            width={56}
            height={56}
            priority
            className="size-14 object-contain"
          />
          <div className="grid gap-1">
            <h1 className="font-display text-3xl tracking-tight text-ink-1">Entrar no Nextech</h1>
            <p className="text-sm text-ink-2">Acesse o painel da sua clínica</p>
          </div>
        </div>

        <div className="glass-effect rounded-card p-6 shadow-2xl sm:p-8">
          {/* useSearchParams exige Suspense: sem ele a rota inteira vira dinâmica. */}
          <Suspense fallback={<div className="h-56" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-ink-3">
          Ainda não é cliente?{" "}
          <Link
            href="https://www.nextech.ia.br"
            className="text-ink-1 underline decoration-ink-3/50 underline-offset-4 transition-colors hover:decoration-ink-1"
          >
            Conheça o Nextech
          </Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Passo 2: o formulário.** Os `name` (`email`, `password`, `redirectTo`) e a mensagem genérica de erro não mudam.

```tsx
// app/(auth)/login/login-form.tsx
"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { login, type LoginState } from "@/lib/auth/actions"
import { Botao, Campo, Input } from "@/components/patterns/formulario"

const estadoInicial: LoginState = { error: null }

export function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"
  const [state, formAction, pending] = useActionState(login, estadoInicial)

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <Campo label="E-mail">
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </Campo>

      <Campo label="Senha">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Campo>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          {state.error}
        </p>
      )}

      <Botao type="submit" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  )
}
```

- [ ] **Passo 3: rodar e olhar.**

```bash
npx tsc --noEmit && npx vitest run tests/auth tests/architecture
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/t11 anon:/login:dark:1440 anon:/login:light:1440 anon:/login:dark:390
```
Esperado: aurora ao fundo e cartão de vidro. O script de screenshot continua conseguindo logar (ele usa `input[name="email"]` e `button[type="submit"]`).

- [ ] **Passo 4: commit.**

```bash
git add "app/(auth)/login"
git commit -m "feat(login): aurora e vidro da landing na porta de entrada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 12: Verificação final, docs e memória

**Arquivos:**
- Modificar: `docs/roadmap.md` (seção "Redesign do painel"), `docs/status.md` (tabela e pendência de design)
- Modificar: `C:\Users\Jhone\.claude\projects\c--Projetos-pessoais-Nextech\memory\nextech-sistema-de-design.md`

- [ ] **Passo 1: suíte inteira, tipos e build.**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Esperado: todos os testes passando (os 371 anteriores mais os novos), `tsc` sem saída e build concluído. Se o build falhar por falta de variável de ambiente, registre isso na mensagem final em vez de contornar.

- [ ] **Passo 2: passada visual completa.**

```bash
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs /tmp/final \
  anon:/login:dark:1440 \
  clinica:/dashboard:dark:1440 clinica:/dashboard:light:1440 clinica:/dashboard:dark:390 \
  clinica:/dashboard/agents:dark:1440 clinica:/dashboard/settings:dark:1440 clinica:/dashboard/settings:dark:390 \
  admin:/admin:dark:1440 admin:/admin/design-system:dark:1440 admin:/admin/design-system/telas/conversas:dark:1440
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs --cores /
```
Critique cada imagem com o checklist da seção 12 do prompt mestre:
- a hierarquia se entende em 5 segundos?
- a ação primária é evidente?
- há excesso de borda?
- o celular parece projetado?

E confira que a landing continua com `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`. Corrija o que falhar antes de seguir.

- [ ] **Passo 3: docs.**
  - Em `docs/roadmap.md`, a seção "Redesign do painel" passa a registrar:
    - o que foi entregue: tokens, shell, kit, telas atuais e protótipos no admin;
    - o que fica para o próximo plano (seção "Fora deste plano" abaixo).
  - Em `docs/status.md`:
    - a linha "Redesign do painel" passa a "🟡 fundação e telas atuais prontas; protótipos completos pendentes";
    - o número de testes é atualizado;
    - a inconsistência 361/371 é corrigida.

- [ ] **Passo 4: memória.** Em `nextech-sistema-de-design.md`, registre três coisas:
  - o redesign foi feito na branch `design/app-redesign`, a partir da v0;
  - a regra que ficou: protótipo com dado fictício só em `/admin/design-system/telas/*`, travada por `tests/architecture/rotas.test.ts`;
  - o escopo `.landing-scope` e o motivo dele.

- [ ] **Passo 5: commit final.**

```bash
git add docs/roadmap.md docs/status.md
git commit -m "docs: registra o redesign do painel no roadmap e no status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline staging..HEAD
```

---

## Fora deste plano (próximo plano, uma decisão por vez)

Estes pontos do prompt mestre precisam de spec ou de decisão do Jhones antes de virar código:

1. **Protótipos completos das telas futuras** (seção 6): Conversas com thread, painel do paciente e notas internas; Agenda dia/semana com conflitos; editor visual de Sequências; e os demais. Os protótipos atuais são as listas simples da v0.
2. **Nova arquitetura de informação** (seção 2): grupos "Gestão" e "Conta", item "Integrações" e "Métricas e consumo". Muda o desenho da fase 3c (`lib/navigation`) e é decisão de produto.
3. **Minha conta**: nome, senha e aparência. A senha depende do Resend.
4. **Modelo de dados da seção 9**: pertence às fases 3b a 7, cada uma com a própria spec e migrations. Não é design.
5. **Mover a landing para `components/marketing/`**: puramente organizacional. Fica para quando alguém mexer na landing por outro motivo.
