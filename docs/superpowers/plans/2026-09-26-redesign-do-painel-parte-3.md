# Redesign do painel, parte 3: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, nesta sessão e sem subagentes. Carregue `frontend-design` antes de desenhar cada tela, e `dataviz` antes do funil. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-26

- **Feito:** tarefas 1 a 11, na `staging` local, sem push. Commits `fb26305` até o `docs:` que fecha a parte 3, mais o `14d4fab` (correção da matriz de Equipe).
- **Testes:** 686 passando (eram 569 no fim da parte 2 e 646 depois da tarefa 6). `tsc` limpo e `npm run build` passando.
- **Visual:** as quatro telas novas foram conferidas nos dois temas, em 1440px e 390px, sem rolagem horizontal. O `not-found` real aparece dentro do shell em `/dashboard/agents/<uuid-inexistente>` (pendência da tarefa 2, passo 7). O `--accent` da landing continua `lab(72.8575% -47.9172 13.5998)`.
- **Ambiente:** o `next dev` ainda devolve 500 ("Jest worker") nas rotas dinâmicas, mesmo depois de reiniciado. As rotas dinâmicas foram conferidas num `next start -p 3100` depois do build. No `next start` local, toda página registra um 404 de `/_vercel/insights/script.js`: é o Vercel Analytics, que só existe no deploy.

Ajustes feitos durante a execução, além do que o plano descrevia:

| Tarefa | Ajuste | Por quê |
|---|---|---|
| 1 | `components/team/capacidades.ts`: "Ver sequências e templates" (tela `/dashboard/sequences`) fica com o staff; "Ver, configurar e publicar agentes" (tela `/dashboard/agents`) é só do owner | A matriz do protótipo de Equipe dizia que o staff via a lista de agentes. Já não era verdade na página, e o teste que amarra matriz e menu pegou a divergência depois da decisão |
| 2 | Vitrine com `estados/falha-de-exemplo.tsx` (`"use client"`) | A página de servidor não pode passar a função `retry` |
| 5 | `formatarPercentual` em `lib/formatters/numero.ts` (+ teste), fora da lista de módulos do plano | Visão geral e funil formatam porcentagem; espalhar `Math.round` pelos componentes seria duplicar regra |
| 5 | `KpiCard` ganhou `rodape` opcional | Seção 6: todo número diz de onde vem |
| 5 | `hrefDoPeriodo` virou `Record<Periodo, string>`, e entrou `hrefDaConversa?` | Record é mais simples que função; a fila de espera abre a conversa |
| 5 | Quem espera e a agenda do dia são derivados de `_fixtures/conversas.ts` e `agenda.ts` (2 esperando, 5 consultas restantes) | As telas contam a mesma história; os alertas linkam para os protótipos de Conversas e Templates |
| 5 | Clínica "Clínica Sorriso Recife" (odontologia e estética, domínio `clinicasorriso.com.br`, responsável Ana Paula Souza). Agentes: Recepção Odonto (no ar), Estética (atenção), Implantes (desconectado pela Meta) e Ortodontia (rascunho) | Coerência com as fixtures da parte 2. Nutrição e Fisioterapia destoariam numa clínica odontológica |
| 5 | O KPI `pendente` fica só no teste, não na fixture | Pendente num período só pareceria defeito |
| 5 | KPIs numa grade de 6 colunas (três de 2 e duas de 3) | Cinco cartões em três colunas deixavam um buraco |
| 5 | Etapas do funil como locuções ("Com consulta marcada") e linha-resumo "24% das conversas terminaram com consulta realizada"; atividade recente limitada a 6 | O cartão do funil terminava bem antes da atividade, e a frase precisa ler bem com qualquer etapa |
| 5 | Barras do funil em `bg-ink-2` sobre `bg-surface-2` | Não há tokens `chart-*`; é o mesmo par do `MedidorDeUso` |
| 6 | `f?.open` em `faixa()` | `BusinessHours` tipa cada dia como opcional; `lerBusinessHours` completa os sete em runtime |
| 7 | `OperacaoDoAgente` recebe `hrefDaLista` | O link de voltar precisa do destino; a ficha do paciente já faz assim (`caminhoDaLista`) |
| 7 | Atividade na lista como "Conversou há X" (o plano dizia "Última conversa há X") | Mais curta, faz par com "Nunca conversou" e não quebra a linha no celular |
| 7 | Todo botão desabilitado diz por quê: "Novo agente" no limite do plano, "Publicar" sem número, desconectado ou sem nada a publicar. "Pausar" só aparece no agente ativo | O aviso do protótipo não basta quando a regra real também bloquearia |
| 7 | A faixa de volume some no agente nunca publicado | Só mostraria zeros |
| 7 | Alerta da Meta com o `Alert` do shadcn e os tokens `danger` | O `Alert` só tem `default` e `destructive`; os tokens de tom são os do `StatusBadge` |
| 9 | Faixa de resumo com cada problema como link para o seu bloco. O que nunca foi conectado fica fora da conta (`resumoDasIntegracoes`, com teste) | Um CRM que a clínica não usa não é problema |
| 9 | O CRM conectado ocupa a linha inteira; os não conectados viram cartões compactos, três por linha | Na grade de duas colunas, os cartões vazios esticavam até a altura do Kommo |
| 9 | Conta do Google `agenda@clinicasorriso.com.br` (o plano dizia `clinicaexemplo`) | Mesmo domínio da clínica das outras fixtures |
| 9 | "desde há X" virou "há 2 h" ou "desde 9 set" | "desde há" não se diz |
| 10 | Largura `max-w-4xl`, com os campos em `max-w-md`. A seção de formulário é local à tela | Título à esquerda e campos à direita não cabem em `max-w-2xl`. Não existe `FormSection` no código |
| 10 | "Senha alterada em 28/06/2026" (o plano dizia "há 3 meses") | `lib/formatters` não tem duração em meses, e criar só para isso sairia da lista de módulos. A data é mais precisa |
| 10 | Só Claro e Escuro | `app/layout.tsx` usa `enableSystem={false}` |
| 10 | O texto de Acesso muda com o papel. A responsável lê "Como responsável, você define o papel de cada pessoa em Equipe." | "Seu papel é definido pelo responsável" não faz sentido para a própria responsável |
| 11 | A Visão geral também entrou na galeria | Tinha ficado de fora na tarefa 5 |

### O que a próxima sessão precisa saber

- **Parte 4:** ✅ concluída em 2026-09-26 (`docs/superpowers/plans/2026-09-26-redesign-do-painel-parte-4.md`): Consumo, Conexões, Saúde, Conversas de suporte e Auditoria.
- **Fixtures:** clínica "Clínica Sorriso Recife", responsável Ana Paula Souza. `_fixtures/agentes.ts` exporta `AGENTES` (visão geral) e `DETALHES_DOS_AGENTES` (detalhe). `_fixtures/integracoes.ts` deriva o WhatsApp desses mesmos agentes.
- **Revisão visual:** `docs/design/shot-referencia.mjs` avisa `ROLAGEM-H` e `(caiu no login)` e tem os papéis `admin` e `clinica`. Para apontar para um `next start`, rode com `BASE=http://localhost:3100`.
- **Ambiente:** o `next dev` devolve 500 ("Jest worker") nas rotas dinâmicas. O `next dev` escreve em `.next/dev`, então `next build` e `next start -p 3100` rodam ao lado dele. Antes de subir o `next start`, veja se a porta 3100 não ficou ocupada por um servidor antigo.
- Antes de commitar, leia o resultado do `vitest`. Um `grep` no fim do encadeamento devolve sucesso mesmo com teste falhando.

## Decisões do Jhones (2026-09-26)

| Tema | Decisão |
|---|---|
| Recorte e ordem | Estados transversais nas rotas reais, Visão geral, Agentes com operação, Integrações e Minha conta. O painel interno (Consumo, Conexões, Saúde, Conversas de suporte e Auditoria) fica para a parte 4 |
| Staff e Agentes | O item "Agentes" sai do menu do staff. A guarda da página e o menu passam a ler a mesma regra (`roles` do `DASHBOARD_NAV`). A seção 2 do desenho de navegação é atualizada. Uma visão de operação em leitura para o staff pode voltar com a fase 3b, se o Jhones decidir |

**Formato:** plano enxuto, como na parte 2. O código completo aparece só na lógica pura e nos testes dela, que são o contrato. Cada tela é descrita por props, estrutura, estados e critério visual. O TSX é escrito uma vez só, direto no arquivo.

**Objetivo:** dar às rotas reais os estados de carregamento, erro, página inexistente e permissão negada, e desenhar como protótipo as quatro telas do painel da clínica que ainda faltam.

**Arquitetura:**
- **Acesso por papel:** uma regra só, em `lib/navigation/acesso.ts`, derivada do `DASHBOARD_NAV`. O menu esconde e a página recusa a partir do mesmo dado.
- **Estados:** `loading.tsx` por rota, com esqueleto da forma da tela; um `error.tsx` por painel; um `not-found.tsx` no painel da clínica. Tudo composto de padrões em `components/patterns`.
- **Protótipos:** mesmo padrão da parte 2. A regra pura fica em `lib/<domínio>/`; a tela, em `components/<domínio>/` com props tipadas; o dado fictício, em `_fixtures/`; a rota, em `/admin/design-system/telas/*`.

**Tecnologias:** Next.js 16.3 (App Router; `error.tsx` recebe `retry`, estável desde a 16.3; `forbidden()` ainda é experimental e não entra), React 19, Tailwind v4, shadcn/ui, lucide-react e Vitest (ambiente `node`, testes de componente com `renderToStaticMarkup`).

**Specs:**
- `docs/design/prompt-mestre-v0.md`, seções 6 e 7. A seção 9 fica de fora.
- `docs/specs/dashboard-overview-v1.md`, `agent-config-v1.md` e `conversation-engine-v1.md` (`ACCOUNT_OFFBOARDED`).
- `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`, seção 2.
- `docs/superpowers/plans/2026-09-26-redesign-do-painel-parte-2.md`: as "Restrições globais" continuam valendo.

## Restrições globais

- **Das partes 1 e 2, todas continuam valendo:**
  - texto pt-BR sem caixa alta, sem `·` e sem `→` em botão;
  - cor só por token;
  - verde (`brand`) só no item ativo, no foco, em uma ação que liga algo por tela e em estado positivo;
  - raios: `control`, `xl`, `card`, `sheet` e `pill`;
  - Cal Sans só em título de página, título de destaque e número de KPI;
  - número de destaque em Cal Sans sem `tabular-nums`.
- **Não alterar:** `supabase/**`, `middleware.ts`, `lib/auth/**` e `actions.ts`. Em `lib/`, só:
  - `lib/navigation` (o `acesso.ts` novo e o `roles` de Agentes);
  - os novos e puros `lib/whatsapp/conexao.ts`, `lib/agent-config/saude.ts`, `lib/agent-config/alteracoes.ts`, `lib/overview/*` e `lib/integrations/estado.ts`.
- **Rotas reais:** só a guarda de acesso nos `page.tsx` de `/dashboard`, `/dashboard/agents`, `/dashboard/agents/[id]` e `/dashboard/settings`, mais os arquivos novos `loading.tsx`, `error.tsx` e `not-found.tsx`.
- **Landing intocada:** nada de `app/error.tsx`, `app/loading.tsx` ou `app/not-found.tsx`. Eles valeriam também para a landing. Consequência aceita: uma falha no próprio layout do painel (sessão ou clínica) continua caindo no erro padrão do Next.
- **Dado inventado:** nunca em `app/(dashboard)` nem em `components/`. Toda tela de protótipo mostra `AvisoDePrototipo`. Os testes de `tests/architecture/` só ganham regras.
- **Menu:** Integrações e "Minha conta" continuam "em breve". Deixar de ser "em breve" é decisão do Jhones.
- **Tempo determinístico:** componente não chama `new Date()`. Recebe `agora` (ISO) por prop. No protótipo, `AGORA` vem de `_fixtures/agora.ts` (segunda, 28/09/2026, 14:32).
- **Datas:** só por `lib/formatters`.
- **LGPD:** `error.tsx` não registra o erro no console. A mensagem pode carregar dado de paciente. O suporte usa o `digest`. Motivo de falha de integração é texto nosso, nunca a resposta crua da API.
- **Ações de escrita no protótipo:** botão desabilitado com `title="Protótipo: a ação ainda não existe"`. Única exceção: o tema em Minha conta, que é preferência do navegador, não dado de negócio.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/navigation/acesso.ts` (+ teste) | Item do menu que responde por uma rota, papéis que a abrem, texto de quem acessa |
| `components/patterns/{permissao-negada,esqueleto,falha-na-tela}.tsx` (+ teste) | Estados transversais |
| `app/(dashboard)/dashboard/{loading,error,not-found}.tsx`, `agents/loading.tsx`, `agents/[id]/loading.tsx`, `settings/loading.tsx` | Estados das rotas reais do painel |
| `app/(admin)/admin/{loading,error}.tsx`, `design-system/loading.tsx` | Estados do painel interno |
| `app/(admin)/admin/design-system/estados/page.tsx` | Vitrine dos estados, para revisão visual sem conta de staff nem erro forçado |
| `tests/architecture/estados.test.ts` | Toda rota real tem loading e regra de acesso; `error.tsx` sem console |
| `lib/whatsapp/conexao.ts`, `lib/agent-config/saude.ts` (+ testes) | Conexão do WhatsApp e saúde do agente |
| `lib/overview/{alertas,funil,comparacao}.ts` (+ teste) | Ordem dos alertas, funil e comparação entre períodos |
| `lib/agent-config/alteracoes.ts` (+ teste) | O que muda ao publicar de novo |
| `lib/integrations/estado.ts` (+ teste) | Diagnóstico de uma integração |
| `components/{overview,agents,integrations,account}/` | Telas de domínio |
| `app/(admin)/admin/design-system/_fixtures/{visao-geral,agentes,integracoes,minha-conta}.ts` | Dado fictício |
| `app/(admin)/admin/design-system/telas/{visao-geral,agentes,agentes/[id],integracoes,minha-conta}/page.tsx` | Rotas de protótipo |

## Verificação visual

Copie `docs/design/shot-referencia.mjs` para `$SCRATCH/shot/shot.mjs` e rode `npm i playwright-core@1` nessa pasta. As instruções estão no topo do script.

Para cada tela, gere as capturas de `dark:1440`, `light:1440` e `dark:390` e critique cada uma com a seção 12 do prompt mestre:
- a hierarquia se entende em 5 segundos?
- a ação primária é evidente?
- há borda de mais?
- o celular parece projetado?

Confira também que não há rolagem horizontal em 390px. Antes de trocar de branch, rode `git checkout -- CLAUDE.md`.

---

### Tarefa 1: Acesso por papel e permissão negada

**Arquivos:**
- Criar: `lib/navigation/acesso.ts`, `lib/navigation/acesso.test.ts`
- Criar: `components/patterns/permissao-negada.tsx`
- Modificar: `lib/navigation/dashboard-nav.ts`, que tira `staff` de Agentes e ajusta o comentário do topo.
- Modificar: `lib/navigation/navigation.test.ts`. "staff vê Operação e Automação inteiras" vira "staff vê Operação e Automação, menos Agentes".
- Modificar: os `page.tsx` de `/dashboard`, `/dashboard/agents`, `/dashboard/agents/[id]` e `/dashboard/settings`. Somem os três `SemPermissao` duplicados.
- Modificar: `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`, seção 2. `staff` passa a "Operação + Automação, menos Agentes (configurar agente é do owner). Sem Gestão".

**Interfaces:**
- Produz: `itemDaRota(pathname, grupos?) → NavItem | null`, `papeisDaRota(pathname, grupos?) → readonly ClinicRole[] | null`, `podeAcessar(role, pathname, grupos?) → boolean` e `quemAcessa(papeis) → string`.
- Produz: `<PermissaoNegada titulo rota role />`.

- [x] **Passo 1: teste que falha** (`lib/navigation/acesso.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { itemDaRota, papeisDaRota, podeAcessar, quemAcessa } from "./acesso"
import type { NavGroup } from "./schema"

const MAPA: readonly NavGroup[] = [
  {
    label: "Teste",
    items: [
      { label: "Início", href: "/dashboard", status: "pronto", roles: ["owner", "staff"] },
      { label: "Agentes", href: "/dashboard/agents", status: "pronto", roles: ["owner"] },
      { label: "Perfil", href: "/dashboard/settings", status: "pronto", roles: ["owner"] },
      { label: "Equipe", href: "/dashboard/settings/team", status: "em-breve", roles: ["owner", "staff"] },
      { label: "Agenda", href: "/dashboard/schedule", status: "em-breve" },
    ],
  },
]

describe("itemDaRota", () => {
  it("acha o item pela rota exata", () => {
    expect(itemDaRota("/dashboard/agents", MAPA)?.label).toBe("Agentes")
  })

  it("rota filha herda a regra do item pai", () => {
    expect(itemDaRota("/dashboard/agents/123", MAPA)?.label).toBe("Agentes")
  })

  it("o item mais específico vence", () => {
    expect(itemDaRota("/dashboard/settings/team", MAPA)?.label).toBe("Equipe")
  })

  it("prefixo só conta por segmento inteiro", () => {
    expect(itemDaRota("/dashboard/agents-antigo", MAPA)).toBeNull()
  })

  it("a raiz responde só por si mesma", () => {
    expect(itemDaRota("/dashboard", MAPA)?.label).toBe("Início")
    expect(itemDaRota("/dashboard/desconhecida", MAPA)).toBeNull()
  })
})

describe("papeisDaRota", () => {
  it("item sem roles vale para todos os papéis", () => {
    expect(papeisDaRota("/dashboard/schedule", MAPA)).toEqual(["owner", "staff", "professional"])
  })

  it("rota fora do mapa não tem papel algum", () => {
    expect(papeisDaRota("/dashboard/desconhecida", MAPA)).toBeNull()
  })
})

describe("podeAcessar", () => {
  it("owner abre a configuração dos agentes", () => {
    expect(podeAcessar("owner", "/dashboard/agents/123", MAPA)).toBe(true)
  })

  it("staff não abre a configuração dos agentes, nem pela URL do editor", () => {
    expect(podeAcessar("staff", "/dashboard/agents", MAPA)).toBe(false)
    expect(podeAcessar("staff", "/dashboard/agents/123", MAPA)).toBe(false)
  })

  it("rota fora do mapa é recusada para todos (falha fechada)", () => {
    for (const role of ["owner", "staff", "professional"] as const) {
      expect(podeAcessar(role, "/dashboard/desconhecida", MAPA)).toBe(false)
    }
  })

  it("usa o menu real por padrão", () => {
    expect(podeAcessar("owner", "/dashboard/settings")).toBe(true)
    expect(podeAcessar("staff", "/dashboard/agents")).toBe(false)
    expect(podeAcessar("professional", "/dashboard")).toBe(false)
  })
})

describe("quemAcessa", () => {
  it("um papel", () => {
    expect(quemAcessa(["owner"])).toBe("o responsável pela clínica")
  })

  it("dois papéis", () => {
    expect(quemAcessa(["owner", "staff"])).toBe("o responsável pela clínica e a equipe")
  })

  it("três papéis", () => {
    expect(quemAcessa(["owner", "staff", "professional"])).toBe(
      "o responsável pela clínica, a equipe e os profissionais",
    )
  })

  it("nenhum papel", () => {
    expect(quemAcessa([])).toBe("ninguém")
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/navigation/acesso.test.ts`. Esperado: FALHA, porque o módulo não existe.

- [x] **Passo 3: implementação** (`lib/navigation/acesso.ts`)

```ts
import type { ClinicRole } from "@/lib/auth/context"
import { DASHBOARD_NAV, isItemActive } from "./dashboard-nav"
import type { NavGroup, NavItem } from "./schema"

const TODOS_OS_PAPEIS: readonly ClinicRole[] = ["owner", "staff", "professional"]

/**
 * O item do menu que responde por um caminho: o de href mais longo entre os
 * que casam com ele (rota exata ou filha, por segmento inteiro). Assim
 * `/dashboard/settings/team` segue a regra de Equipe, não a de Perfil.
 *
 * É o mesmo casamento que acende o item ativo no menu: a regra de quem vê o
 * item e a de quem abre a rota nunca divergem.
 */
export function itemDaRota(
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): NavItem | null {
  let melhor: NavItem | null = null
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      if (!isItemActive(item.href, pathname)) continue
      if (!melhor || item.href.length > melhor.href.length) melhor = item
    }
  }
  return melhor
}

/** Quem abre a rota. `null` quando a rota não está no mapa. */
export function papeisDaRota(
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): readonly ClinicRole[] | null {
  const item = itemDaRota(pathname, grupos)
  if (!item) return null
  return item.roles ?? TODOS_OS_PAPEIS
}

/**
 * A guarda de página. Rota fora do mapa é recusada (falha fechada): uma
 * tela nova sem item no menu não pode nascer aberta a todos por omissão.
 * Como no menu, é usabilidade e não a barreira: a RLS continua sendo ela.
 */
export function podeAcessar(
  role: ClinicRole,
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): boolean {
  return papeisDaRota(pathname, grupos)?.includes(role) ?? false
}

const QUEM: Record<ClinicRole, string> = {
  owner: "o responsável pela clínica",
  staff: "a equipe",
  professional: "os profissionais",
}

/** "o responsável pela clínica e a equipe": o sujeito da frase de acesso. */
export function quemAcessa(papeis: readonly ClinicRole[]): string {
  const nomes = papeis.map((p) => QUEM[p])
  if (nomes.length === 0) return "ninguém"
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}
```

- [x] **Passo 4:** `npx vitest run lib/navigation`. Esperado: `acesso.test.ts` passa. `navigation.test.ts` falha só em "staff vê Operação e Automação inteiras".

- [x] **Passo 5: menu.** Em `dashboard-nav.ts`, Agentes passa a `roles: ["owner"]`, com o comentário: configurar agente (persona, credencial do WhatsApp) é do owner, e o staff não vê o que não pode abrir. Atualize o comentário do topo e o teste de navegação: a lista do staff fica sem "Agentes", e o nome do teste diz isso. `npx vitest run lib/navigation`. Esperado: PASSA.

- [x] **Passo 6: `PermissaoNegada`** (`components/patterns/permissao-negada.tsx`, server component).
  - **Props:** `{ titulo: string; rota: string; role: ClinicRole }`. Calcula `papeisDaRota(rota)` e `primeiraRotaVisivel(role)` por dentro, para a página só passar o que sabe.
  - **Estrutura:**
    - `PageHeader` com `titulo`;
    - cartão `max-w-xl` com ícone de cadeado `aria-hidden`;
    - título "Você não tem acesso a esta tela";
    - texto "Só {quemAcessa(papeis)} abre esta tela. Se precisar de algo aqui, fale com quem administra a conta da clínica.";
    - com papéis `null`, o texto vira "Esta tela não está disponível para a sua conta.";
    - botão secundário "Voltar para o início", com link para `primeiraRotaVisivel(role)`. Some quando é `null` ou quando é a própria `rota`.
  - **Teste** em `components/patterns/estados.test.tsx`:
    - staff em `/dashboard/agents` mostra "o responsável pela clínica" e `href="/dashboard"`;
    - professional em `/dashboard/settings` não tem link, porque `primeiraRotaVisivel` é `null`.

- [x] **Passo 7: páginas.** Cada página declara `const ROTA = "/dashboard/agents"` (ou a sua) e troca o `if (role !== "owner") return <SemPermissao />` por `if (!podeAcessar(role, ROTA)) return <PermissaoNegada titulo="Agentes" rota={ROTA} role={role} />`.
  - `/dashboard`: `if (!podeAcessar(role, "/dashboard")) return <AguardandoMinhasTelas />`. O professional continua vendo "Sua área está chegando", porque a raiz é onde ele cai ao entrar.
  - `/dashboard/agents/[id]`: guarda com `ROTA = "/dashboard/agents"`. A regra do editor é a da lista.
  - Apague os três `SemPermissao`.

- [x] **Passo 8:** `npx vitest run lib/navigation components/patterns && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 9: commit.** `feat(nav): acesso por papel com uma regra só e permissão negada padronizada`

---

### Tarefa 2: Carregamento, erro e página inexistente nas rotas reais

**Arquivos:**
- Criar: `components/patterns/esqueleto.tsx` e `components/patterns/falha-na-tela.tsx`.
- Criar: `app/(dashboard)/dashboard/{loading,error,not-found}.tsx`, `agents/loading.tsx`, `agents/[id]/loading.tsx` e `settings/loading.tsx`.
- Criar: `app/(admin)/admin/{loading,error}.tsx` e `app/(admin)/admin/design-system/loading.tsx`. Sem este último, a galeria herdaria o esqueleto "as clínicas".
- Criar: `app/(admin)/admin/design-system/estados/page.tsx` e `estados/falha-de-exemplo.tsx` (`"use client"`, passa um `retry` vazio).
- Criar: `tests/architecture/estados.test.ts`.
- Modificar: `components/patterns/estados.test.tsx`.

**Interfaces:**
- Produz:
  - `<Carregando rotulo>{children}</Carregando>`;
  - `<EsqueletoDeCabecalho acao? />`;
  - `<EsqueletoDeKpis quantidade? />`;
  - `<EsqueletoDeLista linhas? />`;
  - `<EsqueletoDeFormulario campos? />`;
  - `<FalhaNaTela retry digest? voltarPara />`.

- [x] **Passo 1: guarda de arquitetura que falha** (`tests/architecture/estados.test.ts`)

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { papeisDaRota } from "@/lib/navigation/acesso"

function paginas(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome).replace(/\\/g, "/")
    if (statSync(caminho).isDirectory()) return paginas(caminho)
    return nome === "page.tsx" ? [caminho] : []
  })
}

const PAINEL = "app/(dashboard)/dashboard"
const ADMIN = "app/(admin)/admin"
const DESIGN_SYSTEM = `${ADMIN}/design-system`

/** "app/(dashboard)/dashboard/agents/[id]/page.tsx" vira "/dashboard/agents/x". */
function rotaDoArquivo(arquivo: string): string {
  return dirname(arquivo)
    .replace(/^app/, "")
    .replace(/\/\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]/g, "x")
}

const reais = [
  ...paginas(PAINEL),
  ...paginas(ADMIN).filter((f) => !f.startsWith(`${DESIGN_SYSTEM}/`)),
]

describe("estados das rotas reais", () => {
  // Seção 7 do prompt mestre: nunca uma tela branca enquanto o dado chega.
  it("toda rota real tem loading.tsx ao lado", () => {
    expect(reais.length).toBeGreaterThanOrEqual(5)
    const sem = reais.filter((f) => !existsSync(join(dirname(f), "loading.tsx")))
    expect(sem).toEqual([])
  })

  it("os dois painéis têm error.tsx de cliente", () => {
    for (const dir of [PAINEL, ADMIN]) {
      const arquivo = join(dir, "error.tsx")
      expect(existsSync(arquivo)).toBe(true)
      expect(readFileSync(arquivo, "utf8").trimStart().startsWith('"use client"')).toBe(true)
    }
  })

  // A mensagem de um erro pode carregar dado de paciente (regra 3 do
  // CLAUDE.md). O suporte usa o digest, que casa com o log do servidor.
  it("error.tsx não registra o erro no console", () => {
    for (const dir of [PAINEL, ADMIN]) {
      expect(readFileSync(join(dir, "error.tsx"), "utf8")).not.toMatch(/console\./)
    }
  })
})

describe("acesso por papel nas rotas reais", () => {
  const doPainel = paginas(PAINEL)

  it("toda rota do painel tem regra de acesso no menu", () => {
    const sem = doPainel.filter((f) => papeisDaRota(rotaDoArquivo(f)) === null)
    expect(sem).toEqual([])
  })

  it("rota que nem todo papel abre confere o papel na própria página", () => {
    const semGuarda = doPainel.filter((f) => {
      const papeis = papeisDaRota(rotaDoArquivo(f)) ?? []
      return papeis.length < 3 && !readFileSync(f, "utf8").includes("podeAcessar(")
    })
    expect(semGuarda).toEqual([])
  })
})
```

- [x] **Passo 2:** `npx vitest run tests/architecture/estados.test.ts`. Esperado: FALHA em loading e error. O bloco de acesso já passa, por causa da tarefa 1.

- [x] **Passo 3: padrões.**
  - **`esqueleto.tsx`** (server):
    - `Carregando` envolve os filhos num `div` com `role="status"`, `aria-live="polite"` e `aria-busy="true"`, mais `<span className="sr-only">Carregando {rotulo}</span>`. Seção 7: nada de spinner sem contexto.
    - Os esqueletos usam `components/ui/skeleton` com `aria-hidden` e reproduzem a forma da tela:
      - cabeçalho: título em `h-8 w-48`, descrição e, com `acao`, um botão à direita;
      - KPIs: grade `sm:grid-cols-2 xl:grid-cols-4`;
      - lista: cartão com linhas divididas por `divide-hairline`;
      - formulário: pares de rótulo e campo.
  - **`falha-na-tela.tsx`** (`"use client"`):
    - `retry` roda dentro de `useTransition`, e o botão diz "Tentando de novo" enquanto isso;
    - título "Esta tela não carregou";
    - texto "Pode ser uma falha temporária. Tente de novo; se continuar, fale com o suporte da Nextech e informe o código abaixo.";
    - o `digest`, quando existe, aparece em `<code>` como "Código do erro";
    - ações: "Tentar de novo" (primário) e o link "Ir para o início" (`voltarPara`).
  - **Teste** em `estados.test.tsx`:
    - `Carregando` tem `role="status"` e "Carregando os agentes";
    - `FalhaNaTela` mostra o digest quando existe e omite "Código do erro" quando não existe;
    - `FalhaNaTela` tem o link para `voltarPara`.

- [x] **Passo 4: rotas.**

  | Arquivo | Conteúdo |
  |---|---|
  | `dashboard/loading.tsx` | `rotulo="a visão geral"`: cabeçalho, KPIs e lista |
  | `agents/loading.tsx` | `rotulo="os agentes"`: cabeçalho com ação e lista |
  | `agents/[id]/loading.tsx` | `rotulo="o agente"`: cabeçalho e grade formulário + prévia (`lg:grid-cols-[1fr_22rem]`) |
  | `settings/loading.tsx` | `rotulo="o perfil da clínica"`: cabeçalho, faixa de abas e formulário |
  | `admin/loading.tsx` | `rotulo="as clínicas"`: cabeçalho com ação e lista |
  | `design-system/loading.tsx` | `rotulo="o protótipo"`: cabeçalho e lista |
  | `dashboard/error.tsx` e `admin/error.tsx` | `"use client"`, `({ error, retry })` e `<FalhaNaTela retry={retry} digest={error.digest} voltarPara="/dashboard" />` (ou `/admin`) |
  | `dashboard/not-found.tsx` | `PageHeader` "Página não encontrada" e `Vazio`: "O endereço pode estar errado, ou o item foi removido." Ação: link "Ir para o início". Pega o `notFound()` do editor de agente dentro do shell |

- [x] **Passo 5: vitrine** (`/admin/design-system/estados`, sem dado fictício e, por isso, sem `AvisoDePrototipo`).
  - Mostra, em seções: dois esqueletos compostos (lista e formulário), `FalhaNaTela` com digest de exemplo e `PermissaoNegada` (staff em `/dashboard/agents`).
  - Na galeria, um link "Estados das rotas reais" leva a ela.

- [x] **Passo 6:** `npx vitest run tests/architecture components/patterns && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 7: visual.** Capture `/admin/design-system/estados` em `dark:1440`, `light:1440` e `dark:390`. Confira no `next dev`:
  - `/dashboard/agents/00000000-0000-0000-0000-000000000000` mostra o `not-found` dentro do shell;
  - o carregamento de `/dashboard` pisca o esqueleto sem salto de layout.

- [x] **Passo 8: commit.** `feat(estados): loading, erro e página inexistente nas rotas reais`

---

### Tarefa 3: Conexão do WhatsApp e saúde do agente

**Arquivos:**
- Criar: `lib/whatsapp/conexao.ts`, `lib/agent-config/saude.ts` e `lib/agent-config/saude.test.ts`. O teste da conexão também fica aqui: ela só existe para a saúde e para as integrações.
- Criar: `components/agents/saude-do-agente.tsx`

**Interfaces:**
- Produz: `ConexaoDoWhatsapp`, `ROTULO_DA_CONEXAO`, `EventoDaConta`, `conexaoDoWhatsapp()`, `SinaisDoAgente`, `NivelDeSaude`, `Saude`, `saudeDoAgente()` e `<SaudeDoAgente saude />`.

- [x] **Passo 1: teste que falha** (`lib/agent-config/saude.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { conexaoDoWhatsapp } from "@/lib/whatsapp/conexao"
import { saudeDoAgente, type SinaisDoAgente } from "./saude"

describe("conexaoDoWhatsapp", () => {
  it("sem número é sem número, qualquer que seja o evento", () => {
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: null })).toBe("sem-numero")
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe("sem-numero")
  })

  it("com número e sem evento, está conectado", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: null })).toBe("conectado")
  })

  it("ACCOUNT_OFFBOARDED desconecta", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe(
      "desconectado-pela-meta",
    )
  })

  it("ACCOUNT_RECONNECTED reverte", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_RECONNECTED" })).toBe("conectado")
  })
})

const AGORA = "2026-09-28T14:32:00-03:00"
const BASE: SinaisDoAgente = {
  status: "active",
  conexao: "conectado",
  ultimaAtividade: "2026-09-28T14:00:00-03:00",
  envios24h: 40,
  falhas24h: 0,
}
const com = (p: Partial<SinaisDoAgente>) => saudeDoAgente({ ...BASE, ...p }, AGORA)

describe("saudeDoAgente", () => {
  it("publicado, conectado e conversando está no ar", () => {
    expect(com({})).toEqual({ nivel: "ok", motivo: "Atendendo normalmente." })
  })

  it("desconectado pela Meta é falha, mesmo já pausado", () => {
    const s = com({ conexao: "desconectado-pela-meta", status: "paused" })
    expect(s.nivel).toBe("falha")
    expect(s.motivo).toContain("Reconecte")
  })

  it("rascunho e pausado ficam fora do ar", () => {
    expect(com({ status: "draft" }).nivel).toBe("fora-do-ar")
    expect(com({ status: "paused" }).nivel).toBe("fora-do-ar")
  })

  it("publicado sem número é falha", () => {
    expect(com({ conexao: "sem-numero" }).nivel).toBe("falha")
  })

  it("falha abaixo do limiar é atenção, com a conta no motivo", () => {
    expect(com({ falhas24h: 3 })).toEqual({
      nivel: "atencao",
      motivo: "3 de 40 envios falharam nas últimas 24 h.",
    })
  })

  it("20% ou mais de falha é falha", () => {
    expect(com({ falhas24h: 8 }).nivel).toBe("falha")
    expect(com({ falhas24h: 7 }).nivel).toBe("atencao")
  })

  it("com poucos envios, a taxa não decide", () => {
    expect(com({ envios24h: 2, falhas24h: 2 }).nivel).toBe("atencao")
  })

  it("singular no motivo", () => {
    expect(com({ envios24h: 1, falhas24h: 1 }).motivo).toBe("1 de 1 envio falhou nas últimas 24 h.")
  })

  it("publicado e ainda sem conversa pede atenção", () => {
    expect(com({ ultimaAtividade: null }).nivel).toBe("atencao")
  })

  it("72 h de silêncio pedem atenção", () => {
    const s = com({ ultimaAtividade: "2026-09-25T14:32:00-03:00" })
    expect(s.nivel).toBe("atencao")
    expect(s.motivo).toContain("3 dias")
  })

  it("menos de 72 h de silêncio segue no ar", () => {
    expect(com({ ultimaAtividade: "2026-09-25T14:33:00-03:00" }).nivel).toBe("ok")
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/agent-config/saude.test.ts`. Esperado: FALHA, porque os módulos não existem.

- [x] **Passo 3: implementação**

`lib/whatsapp/conexao.ts`:

```ts
/**
 * Eventos de conta do webhook da coexistência (conversation-engine-v1):
 * a clínica reinstalou o app ou trocou de celular (OFFBOARDED), e refez a
 * conexão depois (RECONNECTED).
 */
export type EventoDaConta = "ACCOUNT_OFFBOARDED" | "ACCOUNT_RECONNECTED"

export type ConexaoDoWhatsapp = "conectado" | "desconectado-pela-meta" | "sem-numero"

export const ROTULO_DA_CONEXAO: Record<ConexaoDoWhatsapp, string> = {
  conectado: "Conectado",
  "desconectado-pela-meta": "Desconectado pela Meta",
  "sem-numero": "Sem número",
}

/** O último evento de conta decide; sem número, não há o que conectar. */
export function conexaoDoWhatsapp(p: {
  temNumero: boolean
  ultimoEvento: EventoDaConta | null
}): ConexaoDoWhatsapp {
  if (!p.temNumero) return "sem-numero"
  return p.ultimoEvento === "ACCOUNT_OFFBOARDED" ? "desconectado-pela-meta" : "conectado"
}
```

`lib/agent-config/saude.ts`:

```ts
import { formatarDuracao } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"
import type { AgentStatus } from "./schema"

export type NivelDeSaude = "ok" | "atencao" | "falha" | "fora-do-ar"

/** O que o motor de conversa (fase 3b) sabe de um agente nas últimas 24 h. */
export type SinaisDoAgente = {
  status: AgentStatus
  conexao: ConexaoDoWhatsapp
  /** Última mensagem processada, em ISO. `null` se nunca conversou. */
  ultimaAtividade: string | null
  /** Mensagens que o agente tentou enviar nas últimas 24 h. */
  envios24h: number
  /** Dessas, quantas a Meta recusou. */
  falhas24h: number
}

export type Saude = { nivel: NivelDeSaude; motivo: string }

/** A partir desta fração de envios recusados, o agente está falhando. */
export const TAXA_DE_FALHA_CRITICA = 0.2
/** Abaixo disto, uma taxa não diz nada: 1 de 2 é 50% por acaso. */
export const MINIMO_DE_ENVIOS_PARA_TAXA = 5
/** Um fim de semana sem conversa é normal; três dias, não. */
export const SILENCIO_SUSPEITO_MS = 72 * 60 * 60 * 1000

/**
 * Saúde de um agente para quem opera a clínica: um nível e o motivo em
 * uma frase, com a ação quando há uma. A ordem das regras é a ordem de
 * gravidade: a desconexão pela Meta vem antes do status, porque a Meta
 * pausa o agente ao desconectar (conversation-engine-v1), e "pausado"
 * esconderia a causa.
 */
export function saudeDoAgente(s: SinaisDoAgente, agora: string): Saude {
  if (s.conexao === "desconectado-pela-meta") {
    return {
      nivel: "falha",
      motivo: "A Meta desconectou o número. Reconecte o WhatsApp para voltar a atender.",
    }
  }
  if (s.status === "draft") {
    return { nivel: "fora-do-ar", motivo: "Rascunho: ainda não atende pacientes." }
  }
  if (s.status === "paused") {
    return { nivel: "fora-do-ar", motivo: "Pausado: não responde até ser publicado de novo." }
  }
  // O trigger de publicação exige número; se faltar, algo passou por fora.
  if (s.conexao === "sem-numero") {
    return { nivel: "falha", motivo: "Publicado sem número de WhatsApp conectado." }
  }

  if (s.falhas24h > 0) {
    const critica =
      s.envios24h >= MINIMO_DE_ENVIOS_PARA_TAXA &&
      s.falhas24h / s.envios24h >= TAXA_DE_FALHA_CRITICA
    const verbo = s.falhas24h === 1 ? "falhou" : "falharam"
    return {
      nivel: critica ? "falha" : "atencao",
      motivo: `${formatarNumero(s.falhas24h)} de ${plural(s.envios24h, "envio", "envios")} ${verbo} nas últimas 24 h.`,
    }
  }

  if (s.ultimaAtividade === null) {
    return { nivel: "atencao", motivo: "Publicado, mas ainda não recebeu nenhuma conversa." }
  }
  const silencio = new Date(agora).getTime() - new Date(s.ultimaAtividade).getTime()
  if (silencio >= SILENCIO_SUSPEITO_MS) {
    return {
      nivel: "atencao",
      motivo: `Sem conversas há ${formatarDuracao(silencio)}. Confira se o número está recebendo mensagens.`,
    }
  }

  return { nivel: "ok", motivo: "Atendendo normalmente." }
}
```

- [x] **Passo 4:** `npx vitest run lib/agent-config/saude.test.ts`. Esperado: PASSA.

- [x] **Passo 5: `SaudeDoAgente`** (`components/agents/saude-do-agente.tsx`).
  - **Props:** `{ saude: Saude; compacto?: boolean }`.
  - **Tons e rótulos:**

    | Nível | Tom | Rótulo |
    |---|---|---|
    | `ok` | `success` | "No ar" |
    | `atencao` | `warning` | "Atenção" |
    | `falha` | `danger` | "Com falha" |
    | `fora-do-ar` | `neutral` | "Fora do ar" |

  - **Estrutura:** `StatusBadge` mais o motivo em `text-xs text-ink-3`. Com `compacto`, só o selo, com o motivo em `title` e `sr-only`.

- [x] **Passo 6: commit.** `feat(agents): saúde do agente e conexão do WhatsApp como regra pura`

---

### Tarefa 4: Alertas, funil e comparação de período

**Arquivos:**
- Criar: `lib/overview/alertas.ts`, `lib/overview/funil.ts`, `lib/overview/comparacao.ts` e `lib/overview/overview.test.ts`.

**Interfaces:**
- Produz:
  - `TipoDeAlerta`, `Alerta`, `PRIORIDADE_DO_ALERTA` e `ordenarAlertas()`;
  - `EtapaDoFunil`, `EtapaCalculada`, `taxa()` e `calcularFunil()`;
  - `Comparacao` e `compararPeriodos()`.

- [x] **Passo 1: teste que falha** (`lib/overview/overview.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { ordenarAlertas, type Alerta } from "./alertas"
import { calcularFunil, taxa } from "./funil"
import { compararPeriodos } from "./comparacao"

const alerta = (id: string, tipo: Alerta["tipo"], desde: string): Alerta => ({
  id,
  tipo,
  desde,
  titulo: id,
  detalhe: "",
})

describe("ordenarAlertas", () => {
  it("urgência > template rejeitado > janela fechando > aguardando > limite do plano", () => {
    const ordem = ordenarAlertas([
      alerta("limite", "limite-do-plano", "2026-09-28T08:00:00-03:00"),
      alerta("aguardando", "aguardando-resposta", "2026-09-28T09:00:00-03:00"),
      alerta("janela", "janela-fechando", "2026-09-28T10:00:00-03:00"),
      alerta("template", "template-rejeitado", "2026-09-28T11:00:00-03:00"),
      alerta("urgencia", "urgencia", "2026-09-28T12:00:00-03:00"),
    ]).map((a) => a.id)
    expect(ordem).toEqual(["urgencia", "template", "janela", "aguardando", "limite"])
  })

  it("no mesmo tipo, quem espera há mais tempo vem primeiro", () => {
    const ordem = ordenarAlertas([
      alerta("recente", "aguardando-resposta", "2026-09-28T14:00:00-03:00"),
      alerta("antigo", "aguardando-resposta", "2026-09-28T13:00:00-03:00"),
    ]).map((a) => a.id)
    expect(ordem).toEqual(["antigo", "recente"])
  })

  it("não altera a lista recebida", () => {
    const lista = [
      alerta("b", "limite-do-plano", "2026-09-28T08:00:00-03:00"),
      alerta("a", "urgencia", "2026-09-28T08:00:00-03:00"),
    ]
    ordenarAlertas(lista)
    expect(lista.map((a) => a.id)).toEqual(["b", "a"])
  })
})

describe("funil", () => {
  it("taxa sem base é null, não zero nem infinito", () => {
    expect(taxa(3, 0)).toBeNull()
    expect(taxa(3, 12)).toBe(0.25)
  })

  it("calcula a passagem de cada etapa e a fração do topo", () => {
    const funil = calcularFunil([
      { id: "conversas", rotulo: "Conversas", total: 200 },
      { id: "qualificados", rotulo: "Qualificados", total: 120 },
      { id: "agendados", rotulo: "Agendados", total: 60 },
    ])
    expect(funil.map((e) => e.daAnterior)).toEqual([null, 0.6, 0.5])
    expect(funil.map((e) => e.doTopo)).toEqual([1, 0.6, 0.3])
  })

  it("etapa depois de uma etapa zerada não tem passagem", () => {
    const funil = calcularFunil([
      { id: "a", rotulo: "A", total: 0 },
      { id: "b", rotulo: "B", total: 0 },
    ])
    expect(funil[1].daAnterior).toBeNull()
    expect(funil[1].doTopo).toBeNull()
  })

  it("funil vazio é lista vazia", () => {
    expect(calcularFunil([])).toEqual([])
  })
})

describe("compararPeriodos", () => {
  it("contagem em alta, quando mais é melhor", () => {
    expect(
      compararPeriodos({ atual: 112, anterior: 100, unidade: "contagem", melhorQuando: "maior" }),
    ).toEqual({ direcao: "alta", sentido: "melhor", rotulo: "+12%" })
  })

  it("contagem em alta, quando menos é melhor (faltas)", () => {
    expect(
      compararPeriodos({ atual: 12, anterior: 10, unidade: "contagem", melhorQuando: "menor" }),
    ).toEqual({ direcao: "alta", sentido: "pior", rotulo: "+20%" })
  })

  it("taxa compara em pontos percentuais, com sinal de menos tipográfico", () => {
    expect(
      compararPeriodos({ atual: 0.28, anterior: 0.31, unidade: "taxa", melhorQuando: "maior" }),
    ).toEqual({ direcao: "queda", sentido: "pior", rotulo: "−3 p.p." })
  })

  it("variação que arredonda para zero é estável", () => {
    expect(
      compararPeriodos({ atual: 1001, anterior: 1000, unidade: "contagem", melhorQuando: "maior" }),
    ).toEqual({ direcao: "estavel", sentido: "neutro", rotulo: "estável" })
  })

  it("arredonda meio ponto para longe do zero, nos dois sentidos", () => {
    const base = { unidade: "contagem" as const, melhorQuando: "maior" as const }
    expect(compararPeriodos({ ...base, atual: 1025, anterior: 1000 })?.rotulo).toBe("+3%")
    expect(compararPeriodos({ ...base, atual: 975, anterior: 1000 })?.rotulo).toBe("−3%")
  })

  it("sem período anterior, ou com contagem anterior zero, não há comparação", () => {
    expect(
      compararPeriodos({ atual: 5, anterior: null, unidade: "contagem", melhorQuando: "maior" }),
    ).toBeNull()
    expect(
      compararPeriodos({ atual: 5, anterior: 0, unidade: "contagem", melhorQuando: "maior" }),
    ).toBeNull()
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/overview`. Esperado: FALHA, porque os módulos não existem.

- [x] **Passo 3: implementação**

`lib/overview/alertas.ts`:

```ts
export type TipoDeAlerta =
  | "urgencia"
  | "template-rejeitado"
  | "janela-fechando"
  | "aguardando-resposta"
  | "limite-do-plano"

export type Alerta = {
  id: string
  tipo: TipoDeAlerta
  /** Desde quando: a mensagem sem resposta, a rejeição, o pico de uso. */
  desde: string
  titulo: string
  detalhe: string
  acao?: { rotulo: string; href: string }
}

/**
 * Ordem da spec (dashboard-overview-v1): template rejeitado > paciente
 * esperando resposta > demais. A urgência da triagem vem à frente de tudo:
 * é segurança de paciente, e a spec é anterior ao desenho da triagem
 * (clinic-profile-v1). "Janela fechando" é um paciente esperando com prazo:
 * depois que a janela fecha, só template aprovado chega a ele.
 */
export const PRIORIDADE_DO_ALERTA: Record<TipoDeAlerta, number> = {
  urgencia: 0,
  "template-rejeitado": 1,
  "janela-fechando": 2,
  "aguardando-resposta": 3,
  "limite-do-plano": 4,
}

/** Por gravidade; no mesmo tipo, quem espera há mais tempo primeiro. */
export function ordenarAlertas(alertas: readonly Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      PRIORIDADE_DO_ALERTA[a.tipo] - PRIORIDADE_DO_ALERTA[b.tipo] ||
      Date.parse(a.desde) - Date.parse(b.desde) ||
      a.id.localeCompare(b.id),
  )
}
```

`lib/overview/funil.ts`:

```ts
export type EtapaDoFunil = { id: string; rotulo: string; total: number }

export type EtapaCalculada = EtapaDoFunil & {
  /** Fração da etapa anterior que chegou aqui. `null` na primeira ou sem base. */
  daAnterior: number | null
  /** Fração do topo do funil. `null` se o topo é zero. */
  doTopo: number | null
}

/** Parte sobre todo. Sem base não há taxa: nem 0%, nem infinito. */
export function taxa(parte: number, todo: number): number | null {
  return todo > 0 ? parte / todo : null
}

export function calcularFunil(etapas: readonly EtapaDoFunil[]): EtapaCalculada[] {
  const topo = etapas[0]?.total ?? 0
  return etapas.map((etapa, i) => ({
    ...etapa,
    daAnterior: i === 0 ? null : taxa(etapa.total, etapas[i - 1].total),
    doTopo: taxa(etapa.total, topo),
  }))
}
```

`lib/overview/comparacao.ts`:

```ts
export type Comparacao = {
  direcao: "alta" | "queda" | "estavel"
  /** Se a mudança é boa para a clínica: faltas em alta são piores. */
  sentido: "melhor" | "pior" | "neutro"
  /** "+12%", "−3 p.p." ou "estável". */
  rotulo: string
}

/** Meio ponto sai do zero nos dois sentidos: -2,5 vira -3, como 2,5 vira 3. */
const arredondar = (x: number) => Math.sign(x) * Math.round(Math.abs(x))

/**
 * Compara o período com o anterior (seção 6 do prompt mestre: nunca uma
 * métrica sem comparação). Contagem compara em %, taxa em pontos
 * percentuais: de 28% para 31% são 3 p.p., não "+10,7%".
 *
 * Sem anterior, ou com contagem anterior zero, devolve `null`: de 0 para 12
 * não é "+∞%", e a tela diz "sem base de comparação".
 */
export function compararPeriodos(p: {
  atual: number
  anterior: number | null
  unidade: "contagem" | "taxa"
  melhorQuando: "maior" | "menor"
}): Comparacao | null {
  if (p.anterior === null) return null
  if (p.unidade === "contagem" && p.anterior === 0) return null

  const delta =
    p.unidade === "contagem"
      ? arredondar(((p.atual - p.anterior) * 100) / p.anterior)
      : arredondar((p.atual - p.anterior) * 100)
  if (delta === 0) return { direcao: "estavel", sentido: "neutro", rotulo: "estável" }

  const alta = delta > 0
  const sufixo = p.unidade === "contagem" ? "%" : " p.p."
  return {
    direcao: alta ? "alta" : "queda",
    sentido: alta === (p.melhorQuando === "maior") ? "melhor" : "pior",
    rotulo: `${alta ? "+" : "−"}${Math.abs(delta)}${sufixo}`,
  }
}
```

- [x] **Passo 4:** `npx vitest run lib/overview`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(overview): ordem dos alertas, funil e comparação de período`

---

### Tarefa 5: Visão geral completa (protótipo)

> Carregue `frontend-design` e `dataviz` antes de desenhar.

**Arquivos:**
- Criar: `components/overview/{tipos.ts,tela-de-visao-geral.tsx,alertas-da-operacao.tsx,funil.tsx}` e `components/overview/visao-geral.test.tsx`.
- Criar: `app/(admin)/admin/design-system/_fixtures/visao-geral.ts` e `telas/visao-geral/page.tsx`.

**Interfaces:**
- Consome: `ordenarAlertas`, `calcularFunil`, `compararPeriodos`, `saudeDoAgente`, `SaudeDoAgente`, `KpiCard`, `LinhaDoTempo`, `FiltroSegmentado`, `tempoRelativo`, `formatarHora` e `formatarDuracao`.
- **Tipos** (`tipos.ts`):
  - `Periodo = "7d" | "mes"`.
  - `Indicador`, com os campos:
    - `id: "atendimentos" | "conversao" | "automatizado" | "faltas" | "reativados"`;
    - `rotulo`, `atual: number`, `anterior: number | null`;
    - `unidade: "contagem" | "taxa"`, `melhorQuando: "maior" | "menor"`;
    - `fonte: string` (de onde vem o número);
    - `pendente?: string`. Faltas depende da fase 5; a spec manda "em breve" em vez de número.
  - `ResumoDoPeriodo`: `{ rotulo; comparadoA; indicadores: Indicador[]; funil: EtapaDoFunil[] }`.
  - `ConversaAguardando`: `{ id; paciente; agente; desde }`.
  - `AgendamentoDoDia`: `{ id; paciente; profissional; procedimento; inicio; confirmado: boolean }`.
  - `AgenteResumido`: `{ id; nome; sinais: SinaisDoAgente }`.
  - `Atividade`: `{ id; instante; titulo; detalhe?; tipo: "agendamento" | "handoff" | "template" | "paciente" | "agente" }`.
  - `VisaoGeral`: `{ clinica; alertas: Alerta[]; aguardando; agendaDoDia; novosPacientes: { hoje: number; semana: number }; resumos: Record<Periodo, ResumoDoPeriodo>; agentes; atividade }`.
- **Tela:** `TelaDeVisaoGeral({ dados, periodo, agora, hrefDoPeriodo: (p: Periodo) => string })`.

- [x] **Passo 1: fixture.** Clínica Pro na segunda às 14:32. Deve ter:
  - 4 alertas, um de cada tipo exceto limite do plano, fora de ordem na fixture para o teste provar a ordenação. A urgência é "Paciente relatou dor no peito" e leva a `/dashboard/conversations?c=...`;
  - 5 conversas aguardando, com esperas de 4 min a 1 h 40;
  - 7 agendamentos no dia, 3 já passados;
  - novos pacientes: 6 hoje e 23 na semana;
  - os dois resumos, com anterior em todos os indicadores menos "reativados" no `7d` (para mostrar "sem base de comparação");
  - funil Conversas 412 → Qualificados 236 → Agendados 118 → Compareceram 97. A fixture mostra o futuro completo;
  - no resumo `7d`, o KPI de faltas leva `pendente`, para exibir o estado "em breve" da spec;
  - esta tarefa cria `_fixtures/agentes.ts` com os quatro agentes (nome, status e sinais), e a visão geral importa de lá. A tarefa 7 acrescenta volume, histórico e teste;
  - 8 atividades.

- [x] **Passo 2: teste de componente que falha** (`visao-geral.test.tsx`, com `renderToStaticMarkup`):
  - os títulos dos alertas aparecem na ordem da prioridade (índice no HTML crescente);
  - o KPI de atendimentos (112 contra 100) mostra "+12%" e o texto "comparado a";
  - o indicador sem anterior mostra "Sem base de comparação";
  - o indicador com `pendente` mostra o texto dele e nenhum número;
  - com `aguardando: []`, aparece "Ninguém esperando resposta agora";
  - com `alertas: []`, a faixa de alertas não é renderizada.

  O teste usa uma fixture própria, pequena, dentro do arquivo. Componente não importa `_fixtures`.

- [x] **Passo 3: tela.** Hierarquia de cima para baixo, pela ordem "o que precisa de mim agora" → "como vai o mês":
  1. **`PageHeader`:** "Visão geral", com descrição = nome da clínica e ação = `FiltroSegmentado` do período ("Últimos 7 dias" e "Este mês"), via `?periodo=`.
  2. **Alertas** (`AlertasDaOperacao`):
     - lista ordenada, sem cartão em volta; cada linha tem ícone por tipo, título, detalhe, "há X" e a ação como link;
     - tom por tipo: urgência `danger`; template rejeitado `danger`; janela fechando `warning`; aguardando `warning`; limite `info`;
     - a borda esquerda colorida marca só a urgência. As outras usam só o ícone, para a urgência nunca competir com o resto.
  3. **"Agora"**, grade `lg:grid-cols-3`:
     - "Esperando resposta": número em Cal Sans, a espera mais longa ("a mais antiga há 1 h 40") e as 3 mais antigas;
     - "Agenda de hoje": total, quantos faltam e os 3 próximos, com hora e profissional. Confirmação pendente em `warning`;
     - "Saúde dos agentes": uma linha por agente, com `SaudeDoAgente compacto` e o motivo quando não é `ok`.
  4. **Indicadores do período:** título "{rotulo}", com "comparado a {comparadoA}" em `text-ink-3`. Cinco `KpiCard`, cada um com o valor formatado (taxa em %, contagem com `formatarNumero`). O `detail` traz a comparação em `StatusBadge` (melhor = `success`, pior = `danger`, estável = `neutral`) e a fonte em `text-xs`.
  5. **Funil + atividade**, grade `lg:grid-cols-[3fr_2fr]`:
     - `Funil`: barras horizontais, largura = `doTopo`, e a passagem "60% seguem" entre as etapas. A barra usa `bg-ink-2`/`bg-surface-2`, sem verde (não é estado positivo);
     - `LinhaDoTempo` com a atividade recente.

  **Mobile:**
  - o filtro de período desce abaixo do título;
  - a grade "Agora" empilha;
  - a porcentagem do funil fica ao lado do rótulo, não sob a barra.

  **Critério visual:**
  - em 5 segundos se vê a urgência e quantos esperam;
  - Cal Sans só no título e nos números de destaque;
  - verde só no KPI "melhor".

- [x] **Passo 4: rota.** `telas/visao-geral/page.tsx`:
  - lê `searchParams` (Promise) e valida o `periodo`, com `mes` por padrão;
  - `<AvisoDePrototipo entrega="motor de conversa (fase 3b) e agenda (fase 5)" />`;
  - `hrefDoPeriodo` monta `?periodo=`.

- [x] **Passo 5:** `npx vitest run components/overview lib/overview && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture `telas/visao-geral` e `telas/visao-geral?periodo=7d` nos 3 tamanhos, critique com a seção 12, ajuste e registre os ajustes na tabela do status.

- [x] **Passo 7: commit.** `feat(overview): protótipo da visão geral com alertas, agora, período e funil`

---

### Tarefa 6: Alterações não publicadas

**Arquivos:**
- Criar: `lib/agent-config/alteracoes.ts` e `lib/agent-config/alteracoes.test.ts`.

**Interfaces:**
- Produz: `ConfiguracaoPublicavel`, `Alteracao` e `alteracoesNaoPublicadas(publicada, atual) → Alteracao[]`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { alteracoesNaoPublicadas, type ConfiguracaoPublicavel } from "./alteracoes"
import { HORARIO_PADRAO } from "./schema"

const PUBLICADA: ConfiguracaoPublicavel = {
  name: "Recepção",
  specialty: "odontologia",
  persona_instructions: "Cordial e direta.",
  greeting_message: "Olá! Sou a assistente da clínica.",
  business_hours: HORARIO_PADRAO,
  handoff_enabled: true,
  handoff_message: "Vou chamar alguém da equipe.",
}
const com = (p: Partial<ConfiguracaoPublicavel>) => alteracoesNaoPublicadas(PUBLICADA, { ...PUBLICADA, ...p })

describe("alteracoesNaoPublicadas", () => {
  it("sem mudança, lista vazia", () => {
    expect(com({})).toEqual([])
  })

  it("mudança de texto traz antes e depois", () => {
    expect(com({ greeting_message: "Oi! Como posso ajudar?" })).toEqual([
      {
        campo: "greeting_message",
        rotulo: "Saudação",
        antes: "Olá! Sou a assistente da clínica.",
        depois: "Oi! Como posso ajudar?",
      },
    ])
  })

  it("vazio e null são o mesmo; espaço nas pontas não conta", () => {
    expect(com({ persona_instructions: "  Cordial e direta.  " })).toEqual([])
    const semPersona = { ...PUBLICADA, persona_instructions: null }
    expect(alteracoesNaoPublicadas(semPersona, { ...semPersona, persona_instructions: "" })).toEqual([])
  })

  it("texto apagado aparece como vazio", () => {
    expect(com({ handoff_message: null })[0]).toMatchObject({ antes: "Vou chamar alguém da equipe.", depois: "Vazio" })
  })

  it("especialidade e transferência usam o rótulo da tela", () => {
    expect(com({ specialty: "nutricao", handoff_enabled: false })).toEqual([
      { campo: "specialty", rotulo: "Especialidade", antes: "Odontologia", depois: "Nutrição" },
      { campo: "handoff_enabled", rotulo: "Passar para humano", antes: "Ligado", depois: "Desligado" },
    ])
  })

  it("horário muda por dia, só nos dias que mudaram", () => {
    const horario = { ...HORARIO_PADRAO, sab: { open: true, start: "08:00", end: "12:00" } }
    expect(com({ business_hours: horario })).toEqual([
      { campo: "business_hours.sab", rotulo: "Horário de sábado", antes: "Fechado", depois: "08:00 às 12:00" },
    ])
  })

  it("mudar o horário guardado de um dia fechado não é alteração visível", () => {
    const horario = { ...HORARIO_PADRAO, dom: { open: false, start: "09:00", end: "13:00" } }
    expect(com({ business_hours: horario })).toEqual([])
  })

  it("segue a ordem do formulário", () => {
    const campos = com({
      handoff_message: "Já chamo a equipe.",
      name: "Recepção central",
      business_hours: { ...HORARIO_PADRAO, seg: { open: true, start: "07:00", end: "18:00" } },
    }).map((a) => a.campo)
    expect(campos).toEqual(["name", "business_hours.seg", "handoff_message"])
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/agent-config/alteracoes.test.ts`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/agent-config/alteracoes.ts`)

```ts
import {
  DIAS,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_DIA,
  lerBusinessHours,
  type Agent,
  type BusinessHours,
} from "./schema"

/** O que a publicação leva ao ar: a configuração, sem id, status nem credencial. */
export type ConfiguracaoPublicavel = Pick<
  Agent,
  | "name"
  | "specialty"
  | "persona_instructions"
  | "greeting_message"
  | "business_hours"
  | "handoff_enabled"
  | "handoff_message"
>

export type Alteracao = { campo: string; rotulo: string; antes: string; depois: string }

const texto = (v: string | null) => v?.trim() || "Vazio"

function faixa(horario: BusinessHours, dia: (typeof DIAS)[number]): string {
  const f = horario[dia]
  return f.open ? `${f.start} às ${f.end}` : "Fechado"
}

/**
 * O que muda no ar quando a clínica publicar de novo. Editar um agente
 * ativo só vale depois de publicar (agent-config-v1), então a tela precisa
 * dizer o que a publicação leva. Compara o que o paciente sente: espaço
 * nas pontas, vazio contra null e o horário guardado de um dia fechado
 * não contam. A ordem é a do formulário.
 */
export function alteracoesNaoPublicadas(
  publicada: ConfiguracaoPublicavel,
  atual: ConfiguracaoPublicavel,
): Alteracao[] {
  const lista: Alteracao[] = []
  const comparar = (campo: string, rotulo: string, antes: string, depois: string) => {
    if (antes !== depois) lista.push({ campo, rotulo, antes, depois })
  }

  comparar("name", "Nome", texto(publicada.name), texto(atual.name))
  comparar(
    "specialty",
    "Especialidade",
    ROTULO_DA_ESPECIALIDADE[publicada.specialty],
    ROTULO_DA_ESPECIALIDADE[atual.specialty],
  )
  comparar("persona_instructions", "Persona", texto(publicada.persona_instructions), texto(atual.persona_instructions))
  comparar("greeting_message", "Saudação", texto(publicada.greeting_message), texto(atual.greeting_message))

  const horarioAntes = lerBusinessHours(publicada.business_hours)
  const horarioDepois = lerBusinessHours(atual.business_hours)
  for (const dia of DIAS) {
    comparar(
      `business_hours.${dia}`,
      `Horário de ${ROTULO_DO_DIA[dia].toLowerCase()}`,
      faixa(horarioAntes, dia),
      faixa(horarioDepois, dia),
    )
  }

  const ligado = (v: boolean) => (v ? "Ligado" : "Desligado")
  comparar("handoff_enabled", "Passar para humano", ligado(publicada.handoff_enabled), ligado(atual.handoff_enabled))
  comparar("handoff_message", "Mensagem de transferência", texto(publicada.handoff_message), texto(atual.handoff_message))

  return lista
}
```

- [x] **Passo 4:** `npx vitest run lib/agent-config`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(agents): alterações não publicadas como regra pura`

---

### Tarefa 7: Agentes com operação (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/agents/{tipos.ts,lista-em-operacao.tsx,operacao-do-agente.tsx}` e `components/agents/operacao.test.tsx`.
- Criar: `_fixtures/agentes.ts`, `telas/agentes/page.tsx` e `telas/agentes/[id]/page.tsx`.

**Interfaces:**
- Consome: `saudeDoAgente`, `SaudeDoAgente`, `StatusDoAgente`, `alteracoesNaoPublicadas`, `LinhaDoTempo`, `PreviaDoWhatsApp`, `ChatBubble`, `formatarTelefone`, `tempoRelativo`, `LIMITE_DE_AGENTES` e `ROTULO_DO_PLANO`.
- **Tipos** (`tipos.ts`):
  - `AgenteEmOperacao` (**já existe**, tarefa 5): `{ id; nome; especialidade: MedicalSpecialty; numero: string | null; publicadoEm: string | null; sinais: SinaisDoAgente; volume7d: { conversas; mensagens; passadasParaHumano } }`. O status é `sinais.status`.
  - `RegistroDeAlteracao`: `{ id; instante; autor; acao: "criou" | "editou" | "publicou" | "pausou" | "conectou" | "desconectado-pela-meta"; detalhe? }`.
  - `TesteDeConversa`: `{ turnos: { lado: "paciente" | "clinica"; texto; hora }[]; usados: number; limite: number }`.
  - `DetalheDoAgente`: `AgenteEmOperacao & { publicada: ConfiguracaoPublicavel | null; atual: ConfiguracaoPublicavel; historico: RegistroDeAlteracao[]; teste: TesteDeConversa }`.
- **Telas:**
  - `ListaDeAgentesEmOperacao({ agentes, plano: ClinicPlan, agora, hrefDoAgente, acaoDesabilitada })`;
  - `OperacaoDoAgente({ agente: DetalheDoAgente, agora, acaoDesabilitada })`.

- [x] **Passo 1: fixture.** 4 agentes, cobrindo:
  - no ar, com volume alto;
  - atenção, com 3 de 40 falhas e alterações não publicadas (saudação e sábado);
  - desconectado pela Meta, pausado pela Meta há 2 h;
  - rascunho, sem número.

  O detalhe de cada um tem:
  - histórico de 5 a 7 registros, com autores "Ana Paula Souza" e "Sistema" (este no evento da Meta);
  - teste com 4 turnos, 4 de 10 usados.

  A clínica está no plano HealthTech (sem limite de agentes). No Pro, o trigger barraria o quarto agente, e a lista perderia um dos quatro níveis de saúde. Visão geral e Integrações usam estes mesmos quatro agentes.

- [x] **Passo 2: teste de componente que falha** (`operacao.test.tsx`):
  - **lista:**
    - mostra, por agente, o selo de status, a saúde e "há X";
    - com a fixture do teste no Pro com 3 agentes, traz "3 de 3 agentes do plano Pro"; no HealthTech, "4 agentes, sem limite no plano HealthTech";
    - "Novo agente" aparece desabilitado com o `title` do protótipo;
  - **detalhe com alterações:** "Alterações não publicadas", "Saudação" e "Horário de sábado", e "Publicar alterações" desabilitado;
  - **detalhe sem alterações:** "A versão no ar é a mesma da configuração";
  - **detalhe nunca publicado** (`publicada: null`): "Ainda não publicado", sem tabela de diferenças;
  - **teste:** "4 de 10 mensagens de teste" e "não envia nada pelo WhatsApp";
  - **desconectado pela Meta:** o motivo com "Reconecte".

- [x] **Passo 3: lista** (`ListaDeAgentesEmOperacao`).
  - **Cabeçalho:** "Agentes"; o uso do plano (com `LIMITE_DE_AGENTES`) em `text-ink-3`; ação "Novo agente".
  - **Linhas**, uma por agente, como link para o detalhe:
    - nome e especialidade;
    - `StatusDoAgente`;
    - saúde com motivo quando não é `ok`;
    - "Última conversa há X" (ou "Nunca conversou");
    - "{n} conversas em 7 dias", em `tabular-nums`;
    - número formatado ou "Sem número".
  - **Desktop:** grade de colunas alinhadas (nome | saúde | atividade | volume).
  - **Mobile:** nome e status na primeira linha, saúde na segunda, atividade e volume na terceira.
  - **Ordenação:** falha > atenção > ok > fora do ar, para o problema subir.

- [x] **Passo 4: detalhe** (`OperacaoDoAgente`). Cabeçalho:
  - voltar para a lista;
  - nome, `StatusDoAgente` e `SaudeDoAgente`, sempre visíveis no topo (skill `ui-ux`);
  - ações: "Pausar" (secundário; em protótipo, desabilitado, e a descrição diz que pede confirmação) e "Publicar alterações" (`marca`, a única ação verde da tela; desabilitado).

  Corpo em grade `lg:grid-cols-[minmax(0,1fr)_22rem]`.
  - **Coluna principal:**
    1. **Saúde:** motivo em destaque. No desconectado pela Meta, um `Alert` `danger` com o que aconteceu (app reinstalado ou troca de celular) e "Reconectar no editor", desabilitado.
    2. **Volume, 7 dias:** conversas, mensagens, passadas para humano e envios com falha nas últimas 24 h. São quatro números numa faixa, não quatro cartões.
    3. **Alterações não publicadas:** tabela Campo | No ar | Na configuração. No mobile, cada alteração vira um bloco com "No ar" e "Vai ao ar". Os estados vazio e nunca publicado seguem o teste.
    4. **Histórico:** `LinhaDoTempo`. `desconectado-pela-meta` em `danger`, `publicou` em `success`.
  - **Lateral:** "Teste seguro", com `PreviaDoWhatsApp` e os turnos em `ChatBubble`. O rodapé diz: "Conversa de teste com paciente fictício. Não envia nada pelo WhatsApp e não conta como atendimento. {usados} de {limite} mensagens de teste." O campo de mensagem fica desabilitado.

- [x] **Passo 5: rotas.**
  - `telas/agentes/page.tsx`: aviso "motor de conversa (fase 3b)".
  - `telas/agentes/[id]/page.tsx`:
    - `params` é Promise;
    - `notFound()` para id fora da fixture;
    - o mesmo aviso.

- [x] **Passo 6:** `npx vitest run components/agents lib/agent-config && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 7: visual.** Capture a lista e dois detalhes (com alterações e desconectado) nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 8: commit.** `feat(agents): protótipo de agentes com saúde, volume, alterações e teste seguro`

---

### Tarefa 8: Diagnóstico de integração

**Arquivos:**
- Criar: `lib/integrations/estado.ts` e `lib/integrations/estado.test.ts`.

**Interfaces:**
- Consome: `ConexaoDoWhatsapp`.
- Produz: `EstadoDaIntegracao`, `SinaisDaIntegracao`, `Diagnostico`, `diagnosticarIntegracao()` e `estadoDoWhatsapp()`.

- [x] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { diagnosticarIntegracao, estadoDoWhatsapp, type SinaisDaIntegracao } from "./estado"

const AGORA = "2026-09-28T14:32:00-03:00"
const BASE: SinaisDaIntegracao = {
  conectadaEm: "2026-09-01T10:00:00-03:00",
  ultimaSincronizacao: "2026-09-28T14:20:00-03:00",
  ultimaFalha: null,
  autorizacaoExpiraEm: null,
}
const com = (p: Partial<SinaisDaIntegracao>) => diagnosticarIntegracao({ ...BASE, ...p }, AGORA)

describe("diagnosticarIntegracao", () => {
  it("conectada e sincronizando", () => {
    expect(com({})).toEqual({ estado: "conectada", motivo: "Sincronizando normalmente." })
  })

  it("sem conexão é desconectada, mesmo com rastro antigo", () => {
    expect(com({ conectadaEm: null, ultimaFalha: { em: AGORA, motivo: "x" } }).estado).toBe("desconectada")
  })

  it("autorização vencida é erro, antes de qualquer outra coisa", () => {
    const d = com({ autorizacaoExpiraEm: "2026-09-28T14:00:00-03:00" })
    expect(d.estado).toBe("erro")
    expect(d.motivo).toContain("venceu")
  })

  it("falha depois da última sincronização é erro, com o motivo", () => {
    expect(com({ ultimaFalha: { em: "2026-09-28T14:25:00-03:00", motivo: "a chave foi recusada." } })).toEqual({
      estado: "erro",
      motivo: "A última sincronização falhou: a chave foi recusada.",
    })
  })

  it("falha já superada por uma sincronização não conta", () => {
    expect(com({ ultimaFalha: { em: "2026-09-28T14:00:00-03:00", motivo: "x" } }).estado).toBe("conectada")
  })

  it("falha sem nenhuma sincronização ainda é erro", () => {
    expect(com({ ultimaSincronizacao: null, ultimaFalha: { em: AGORA, motivo: "x" } }).estado).toBe("erro")
  })

  it("autorização que vence em até 7 dias pede atenção", () => {
    const d = com({ autorizacaoExpiraEm: "2026-10-03T14:32:00-03:00" })
    expect(d.estado).toBe("atencao")
    expect(d.motivo).toContain("5 dias")
  })

  it("autorização que vence em mais de 7 dias não pede", () => {
    expect(com({ autorizacaoExpiraEm: "2026-10-06T14:33:00-03:00" }).estado).toBe("conectada")
  })

  it("24 h sem sincronizar pede atenção", () => {
    const d = com({ ultimaSincronizacao: "2026-09-27T14:32:00-03:00" })
    expect(d.estado).toBe("atencao")
    expect(d.motivo).toContain("1 dia")
  })

  it("conectada e nunca sincronizada conta o atraso desde a conexão", () => {
    expect(com({ ultimaSincronizacao: null, conectadaEm: "2026-09-28T14:00:00-03:00" }).estado).toBe("conectada")
    expect(com({ ultimaSincronizacao: null }).estado).toBe("atencao")
  })
})

describe("estadoDoWhatsapp", () => {
  it("traduz a conexão para o vocabulário das integrações", () => {
    expect(estadoDoWhatsapp("conectado")).toBe("conectada")
    expect(estadoDoWhatsapp("desconectado-pela-meta")).toBe("erro")
    expect(estadoDoWhatsapp("sem-numero")).toBe("desconectada")
  })
})
```

- [x] **Passo 2:** `npx vitest run lib/integrations`. Esperado: FALHA.

- [x] **Passo 3: implementação** (`lib/integrations/estado.ts`)

```ts
import { formatarDuracao } from "@/lib/formatters/data"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"

export type EstadoDaIntegracao = "conectada" | "atencao" | "erro" | "desconectada"

export type SinaisDaIntegracao = {
  conectadaEm: string | null
  ultimaSincronizacao: string | null
  /**
   * `motivo` é texto nosso, por categoria ("a chave foi recusada."), nunca
   * a resposta crua da API: ela pode trazer nome ou telefone de paciente.
   */
  ultimaFalha: { em: string; motivo: string } | null
  /** Quando o token OAuth ou a chave deixa de valer. `null` = não vence. */
  autorizacaoExpiraEm: string | null
}

export type Diagnostico = { estado: EstadoDaIntegracao; motivo: string }

const HORA = 60 * 60 * 1000
/** Antecedência para avisar que a autorização vai vencer. */
export const AVISO_DE_VENCIMENTO_MS = 7 * 24 * HORA
/** Agenda e CRM sincronizam várias vezes ao dia; um dia parado é sintoma. */
export const ATRASO_DE_SINCRONIZACAO_MS = 24 * HORA

const ms = (iso: string) => new Date(iso).getTime()

/**
 * Estado de uma integração (Google Calendar, CRM) em uma frase. O que
 * impede de funcionar vem antes do que só ameaça: autorização vencida e
 * falha não superada são erro; vencimento próximo e atraso, atenção.
 */
export function diagnosticarIntegracao(s: SinaisDaIntegracao, agora: string): Diagnostico {
  if (s.conectadaEm === null) return { estado: "desconectada", motivo: "Não conectada." }

  const t = ms(agora)
  if (s.autorizacaoExpiraEm && ms(s.autorizacaoExpiraEm) <= t) {
    return { estado: "erro", motivo: "A autorização venceu. Conecte de novo para voltar a sincronizar." }
  }
  if (s.ultimaFalha && (s.ultimaSincronizacao === null || ms(s.ultimaFalha.em) > ms(s.ultimaSincronizacao))) {
    return { estado: "erro", motivo: `A última sincronização falhou: ${s.ultimaFalha.motivo}` }
  }
  if (s.autorizacaoExpiraEm && ms(s.autorizacaoExpiraEm) - t <= AVISO_DE_VENCIMENTO_MS) {
    return {
      estado: "atencao",
      motivo: `A autorização vence em ${formatarDuracao(ms(s.autorizacaoExpiraEm) - t)}. Renove antes para não parar.`,
    }
  }
  const desde = s.ultimaSincronizacao ?? s.conectadaEm
  if (t - ms(desde) >= ATRASO_DE_SINCRONIZACAO_MS) {
    return { estado: "atencao", motivo: `Sem sincronizar há ${formatarDuracao(t - ms(desde))}.` }
  }
  return { estado: "conectada", motivo: "Sincronizando normalmente." }
}

/** A conexão do WhatsApp no vocabulário das integrações. */
export function estadoDoWhatsapp(conexao: ConexaoDoWhatsapp): EstadoDaIntegracao {
  if (conexao === "conectado") return "conectada"
  return conexao === "desconectado-pela-meta" ? "erro" : "desconectada"
}
```

- [x] **Passo 4:** `npx vitest run lib/integrations`. Esperado: PASSA.

- [x] **Passo 5: commit.** `feat(integrations): diagnóstico de integração como regra pura`

---

### Tarefa 9: Integrações (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/integrations/{tipos.ts,estado.ts,tela-de-integracoes.tsx}` e `components/integrations/integracoes.test.tsx`.
- Criar: `_fixtures/integracoes.ts` e `telas/integracoes/page.tsx`.

**Interfaces:**
- Consome: `diagnosticarIntegracao`, `estadoDoWhatsapp`, `ROTULO_DA_CONEXAO`, `formatarTelefone`, `tempoRelativo`, `formatarData` e `plural`.
- **Tipos** (`tipos.ts`):
  - `ProvedorDeCrm = "pipedrive" | "kommo" | "rd-station" | "doctoralia"`.
  - `WhatsappDoAgente`: `{ agenteId; agente; numero: string | null; conexao: ConexaoDoWhatsapp; desde: string | null }`.
  - `IntegracaoDeAgenda`: `{ conta: string | null; sinais: SinaisDaIntegracao; calendarios: { profissional; calendario }[] }`.
  - `IntegracaoDeCrm`: `{ provedor; sinais; registros30d: number | null; credencialSalvaEm: string | null }`.
  - `PainelDeIntegracoes`: `{ whatsapp; agenda; crms }`.
- **Estado** (`estado.ts`):

  | Estado | Tom | Rótulo |
  |---|---|---|
  | `conectada` | `success` | "Conectada" |
  | `atencao` | `warning` | "Atenção" |
  | `erro` | `danger` | "Com erro" |
  | `desconectada` | `neutral` | "Não conectada" |

  Mais `ROTULO_DO_CRM` e a fase de cada bloco.
- **Tela:** `TelaDeIntegracoes({ painel, agora, acaoDesabilitada })`.

- [x] **Passo 1: fixture.**
  - **WhatsApp:** derivado dos 4 agentes de `_fixtures/agentes.ts`: dois conectados, um desconectado pela Meta há 2 h e um sem número.
  - **Agenda:** Google conectado como `agenda@clinicaexemplo.com.br`, com autorização vencendo em 5 dias e 3 profissionais com calendário.
  - **CRM:** Kommo conectado com falha ("a chave foi recusada."). Pipedrive, RD Station e Doctoralia não conectados.

- [x] **Passo 2: teste de componente que falha** (`integracoes.test.tsx`):
  - **WhatsApp:** o agente desconectado mostra "Desconectado pela Meta" e "Reconecte no editor do agente"; a seção não tem campo de token.
  - **Agenda:** mostra "vence em 5 dias" e a lista de calendários por profissional.
  - **CRM:** o conectado com falha mostra "Com erro" e o motivo; os não conectados mostram "Conectar", desabilitado.
  - **Credenciais:** nenhuma aparece. A credencial salva vira "Chave salva em {data}", e o HTML não contém "token" com valor.

- [x] **Passo 3: tela.**
  - **`PageHeader`:** "Integrações", com a descrição "O que o Nextech usa fora dele: WhatsApp, agenda e CRM." Sem ação primária global: cada bloco tem a sua.
  - **Faixa de resumo:** "3 conectadas, 2 pedem atenção", calculada dos diagnósticos. Os problemas vêm primeiro.
  - **Seção "WhatsApp dos agentes":**
    - texto: "A conexão é feita no editor de cada agente. Aqui você acompanha o estado.";
    - uma linha por agente: nome, número formatado, estado e "desde há X";
    - no `erro`, a explicação do `ACCOUNT_OFFBOARDED` ("O WhatsApp Business foi reinstalado ou trocou de celular, e a Meta desconectou o número. O agente foi pausado.") e o link "Reconecte no editor do agente", desabilitado.
  - **Seção "Agenda":**
    - cartão do Google Calendar com a fase 5 em `text-ink-3`: conta conectada, diagnóstico, última sincronização e calendários por profissional (`ListaDeDados`);
    - ações "Renovar autorização" (quando `atencao`/`erro`) e "Desconectar" (perigo), ambas desabilitadas.
  - **Seção "CRM":**
    - fase 6;
    - grade `sm:grid-cols-2` com um cartão por provedor: nome, estado, e "Chave salva em {data}" + "{n} registros em 30 dias" quando conectado;
    - ação "Conectar" ou "Trocar chave", desabilitada.
  - **Rodapé da tela:** "Chaves e tokens ficam criptografados e não aparecem de novo depois de salvos."
  - **Critério visual:**
    - o que está com erro chama atenção sem que a tela vire um mar vermelho: só o selo e a linha do motivo;
    - nenhum verde fora de "Conectada".

- [x] **Passo 4: rota.** `telas/integracoes/page.tsx`, com o aviso "Google Calendar (fase 5), CRM (fase 6) e eventos da Meta (fase 3b)".

- [x] **Passo 5:** `npx vitest run components/integrations lib/integrations && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture nos 3 tamanhos. Critique e ajuste.

- [x] **Passo 7: commit.** `feat(integrations): protótipo de integrações com WhatsApp, agenda e CRM`

---

### Tarefa 10: Minha conta (protótipo)

> Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar: `components/account/{tipos.ts,tela-minha-conta.tsx,escolha-de-tema.tsx}` e `components/account/minha-conta.test.tsx`.
- Criar: `_fixtures/minha-conta.ts` e `telas/minha-conta/page.tsx`.

**Interfaces:**
- **Tipos** (`tipos.ts`): `MinhaConta = { nome: string | null; email: string; papel: ClinicRole; clinica: string; ultimoAcesso: string | null; senhaAlteradaEm: string | null }`.
- **Telas:**
  - `TelaMinhaConta({ conta, agora, acaoDesabilitada })`;
  - `EscolhaDeTema()`, `"use client"`, com `next-themes`.

- [x] **Passo 1: fixture.** "Ana Paula Souza" (`ana.paula@clinicasorriso.com.br`), responsável na "Clínica Sorriso Recife", último acesso há 2 min (14:30, como em `_fixtures/equipe.ts`) e senha alterada há 3 meses.

- [x] **Passo 2: teste de componente que falha** (`minha-conta.test.tsx`):
  - mostra nome, e-mail, "Responsável" e o nome da clínica;
  - os campos de nome e senha e o botão de salvar estão desabilitados, com o `title` do protótipo;
  - a seção de senha diz por que está desabilitada (envio de e-mail);
  - com `senhaAlteradaEm: null`, diz "Senha nunca alterada";
  - `EscolhaDeTema` renderiza os rótulos das opções. Antes de montar, nenhuma vem marcada, para não quebrar a hidratação.

- [x] **Passo 3: tela.** Uma coluna `max-w-2xl`, com seções no padrão `FormSection` (título e descrição à esquerda em `lg`, campos à direita):
  1. **Perfil:**
     - nome (`Input` desabilitado);
     - e-mail somente leitura, com a dica "Trocar o e-mail pede confirmação no endereço novo, e chega com o envio de e-mail.";
     - "Salvar" desabilitado.
  2. **Acesso:** `ListaDeDados` com clínica, papel (`ROTULO_DO_PAPEL`) e último acesso. Texto: "Seu papel é definido pelo responsável pela clínica."
  3. **Aparência:**
     - `EscolhaDeTema`, com opções Claro, Escuro e Sistema. Sistema só se o `ThemeProvider` tiver `enableSystem`; confira em `components/theme-provider.tsx` e `app/layout.tsx`;
     - é o único controle vivo da tela: preferência do navegador, não dado de negócio;
     - `radiogroup` com `role`/`aria-checked` nativos (`input type="radio"`), e montagem igual à do `ThemeSwitch`.
  4. **Senha:**
     - `Alert` `info`: "A troca de senha manda um link de confirmação para o seu e-mail. Fica disponível quando o envio de e-mail entrar no ar.";
     - "Senha alterada há 3 meses";
     - campos de senha atual, nova e confirmação, e o botão, todos desabilitados.

- [x] **Passo 4: rota.** `telas/minha-conta/page.tsx`, com o aviso "e-mail transacional (Resend)".

- [x] **Passo 5:** `npx vitest run components/account && npx tsc --noEmit`. Esperado: PASSA.

- [x] **Passo 6: visual.** Capture nos 3 tamanhos e troque o tema pela própria tela uma vez.

- [x] **Passo 7: commit.** `feat(account): protótipo de minha conta com perfil, acesso, aparência e senha`

---

### Tarefa 11: Galeria, verificação final e docs

**Arquivos:**
- Modificar: `app/(admin)/admin/design-system/page.tsx`. Entram as 4 telas novas, com "O que mostra" e "Entra no ar com", e o link para "Estados das rotas reais".
- Modificar: `tests/architecture/prototipos.test.ts`. O mínimo de telas sobe de 7 para 13 (é só aperto).
- Modificar: este plano, `docs/roadmap.md`, `docs/status.md`, a seção "Próximo plano" do plano da parte 2 e a memória `nextech-sistema-de-design.md`.

- [x] **Passo 1: suíte inteira.** `npx vitest run`, `npx tsc --noEmit` e `npm run build`. Esperado: tudo passa.
- [x] **Passo 2: passada visual.**
  - as 5 rotas de protótipo novas e a vitrine de estados;
  - `/dashboard` e `/dashboard/agents` reais, para ver a guarda e o carregamento;
  - `--cores /`, que precisa mostrar `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`.
- [x] **Passo 3: docs.**
  - **Plano:** status "✅ concluído", com o número de testes e a tabela de ajustes.
  - **Roadmap:** seção "Redesign do painel, parte 3", com o que entrou, a decisão de staff/Agentes e o que fica para a parte 4 (painel interno).
  - **Status:** número de testes e linha do redesign.
  - **Plano da parte 2:** "Próximo plano" marca os itens 1 a 4 e 10 como feitos e aponta para este plano. Os itens 5 a 9 ficam como escopo da parte 4.
  - **Memória:** acesso por papel com regra única (`lib/navigation/acesso.ts`) e estados nas rotas reais.
- [x] **Passo 4: commit.** `docs: fecha a parte 3 do redesign no plano, roadmap e status`
