# Redesign do painel, parte 2: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, nesta sessão e sem subagentes. Carregue `frontend-design` antes de desenhar cada tela. Os passos usam checkbox (`- [ ]`).

## Status da execução: ✅ concluído em 2026-09-26

As 14 tarefas foram executadas na `staging` local, ainda sem push para o GitHub.
- **Testes:** 569 passando (eram 402). `tsc` e `npm run build` limpos.
- **Verificação visual:** as oito rotas de protótipo e o menu novo no painel da clínica, nos dois temas, em 1440px e 390px, sem rolagem horizontal no celular.
- **Landing:** conferida no navegador (`--accent` = `lab(72.8575% -47.9172 13.5998)`).
- **Ambiente:** no meio da sessão, o `next dev` passou a devolver 500 ("Jest worker encountered 2 child process exceptions") em toda rota dinâmica, inclusive na `/dashboard/agents/[id]`, que já existia. O build compila a rota normalmente. A ficha do paciente foi conferida num `next start` na porta 3100. O servidor de dev precisa ser reiniciado.

Ajustes feitos durante a execução, além do que o plano descrevia:

| Tarefa | Ajuste | Por quê |
|---|---|---|
| 2 | `contemBusca`: busca sem letra usa só a regra dos dígitos | "81" casava pelo texto com todo telefone de DDD 81 |
| 3 | `FiltroSegmentado` ganhou `quebrar` e `max-w-full` | Numa coluna estreita, o último recorte ficava cortado pela metade |
| 5 | A janela de 24h ganhou linha própria no cabeçalho, e "Paciente" vira ícone no celular | O nome do paciente truncava em 1440px e em 390px |
| 5 | Avatar sem letra no nome vira ícone | Paciente só com telefone mostrava "(0" como iniciais |
| 5 | Retomada da IA já vencida diz que a próxima mensagem volta para a IA | A faixa mostrava um horário que já tinha passado |
| 6 | Consentimento e opt-out descem para baixo do nome no celular | As colunas deles somem abaixo de `sm` |
| 8 | Uma `GradeDeHorarios` serve às visões dia e semana, em vez de dois componentes | O layout é o mesmo; duplicá-lo seria convidar à divergência |
| 8 | Hora com 5rem; bloco curto (menos de 50 min, ou meia coluna) em duas linhas; conflito marcado por barra na borda da coluna | O nome era cortado e a hachura cobria o texto dos blocos |
| 8 | Com o mesmo início, o compromisso mais longo fica à esquerda | Convenção de calendário; o teste de faixas assumia isso |
| 8 | Filtro de profissional com `contain: inline-size` | A faixa impunha 399px à página em 390px |
| 10 | Prévia do template fica no topo e acompanha a rolagem | Esticava até o fim da grade, com um vão vazio |
| 11 | Atraso 0 vira "Sai no mesmo dia"; o resumo de inscritos some sem inscritos; a coluna Passo some no celular | "Espera 0 dias", zeros sem sentido e selo cortado |
| 12 | Número de destaque sem `tabular-nums` | A Cal Sans espaçava os dígitos ("R$ 697 ,00") |
| 12, 13 | "Ver fatura" e "Mudar acesso" viram ícone no celular; o papel desce para baixo do e-mail; a matriz perde a largura mínima | Cortados em 390px, e dois papéis ficavam escondidos na rolagem |
| 14 | O histórico da ficha fica no topo da coluna | Esticava até a altura da lateral |

**Formato (decidido pelo Jhones):** plano enxuto. O código completo aparece só na lógica pura e nos testes dela, que são o contrato. Cada tela é descrita por props, estrutura, estados e critério visual. O TSX é escrito uma vez só, direto no arquivo.

**Objetivo:** substituir as listas simples da v0 por protótipos completos das sete telas futuras e aplicar a nova divisão do menu. Cada tela vira um componente de domínio com props tipadas; quando o backend da fase chegar, a rota real só troca a fonte do dado.

**Arquitetura:**
- **Lógica pura:** regra de negócio que o backend também vai usar mora em `lib/<domínio>/`, sem I/O: janela de 24h, conflito de agenda, corpo de template, limites do plano e formatadores.
- **Componentes de domínio:** a apresentação e o mapa de status → tom ficam em `components/<domínio>/`.
- **Dado fictício:** só em `app/(admin)/admin/design-system/_fixtures/`, importado só pelas telas de protótipo.
- **Estado de tela:** filtros e seleção vivem na URL (`?c=`, `?status=`, `?q=`). A busca é um `<form method="get">`, sem JavaScript.

**Tecnologias:** Next.js 16 (App Router, `searchParams` é Promise), React 19, Tailwind v4, shadcn/ui, lucide-react e Vitest 5 (ambiente `node`, testes de componente com `renderToStaticMarkup`).

**Specs:**
- `docs/design/prompt-mestre-v0.md`, seções 2 e 6. A seção 9 fica de fora.
- `docs/specs/conversation-engine-v1.md`, `patient-v1.md`, `message-sequences-v1.md`, `whatsapp-templates-v1.md`, `team-access-v1.md` e `atendimento-billing-v1.md`.
- `docs/superpowers/plans/2026-09-26-redesign-do-painel.md`, parte 1: as "Restrições globais" continuam valendo.

## Decisões do Jhones (2026-09-26)

| Tema | Decisão |
|---|---|
| Terceiro grupo do menu | Passa de "Configuração" a **"Gestão"** |
| Integrações | Item novo em "Gestão", só owner e "em breve". Motivo: guarda credencial da clínica (regra 8). A conexão do WhatsApp continua no editor do agente |
| Métricas e consumo | **Não vira item.** O consumo (os dois limites) fica em Plano e cobrança, e as métricas de operação na Visão geral |
| Grupo "Conta" | Continua no menu do usuário, no pé do sidebar |
| Minha conta | Fora desta sessão (depende do Resend), salvo se sobrar tempo, e só com pergunta antes |

## Restrições globais

- **Da parte 1, todas continuam valendo:**
  - texto pt-BR sem caixa alta, sem `·` e sem `→` em botão;
  - cor só por token;
  - verde (`brand`) só no item ativo, no foco, em uma ação que liga algo por tela e em estado positivo;
  - raios: `control`, `xl`, `card`, `sheet` e `pill`;
  - Cal Sans só em título de página, título de destaque e número de KPI.
- **Não alterar:** `supabase/**`, `middleware.ts` e `actions.ts`. Em `lib/`, só estes módulos:
  - `lib/navigation`;
  - os novos e puros `lib/formatters`, `lib/conversations/janela.ts`, `lib/scheduling/conflitos.ts`, `lib/whatsapp/corpo-do-template.ts`, `lib/billing/plan-limits.ts` e `lib/billing/consumo.ts`;
  - a delegação de `normalizarTermo` em `lib/clinic-profile/schema.ts`.
- **Dado inventado:** nunca em `app/(dashboard)` nem em `components/`. Toda tela de protótipo mostra `AvisoDePrototipo`. Os testes de `tests/architecture/` só ganham regras, nunca perdem.
- **Tempo determinístico:** componente não chama `new Date()`. Recebe `agora` (ISO) por prop. No protótipo, `AGORA` vem de `_fixtures/agora.ts`.
- **Hidratação:** data formatada só por `lib/formatters`, com nome de mês e de dia de tabela própria.
- **Ações de escrita no protótipo:** botão desabilitado com `title="Protótipo: a ação ainda não existe"`. Única exceção: em Conversas, assumir, devolver, resolver urgência, responder e anotar mudam estado local, para mostrar a transição.
- **Padrão novo** que servir a mais de uma tela vai para `components/patterns`.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/navigation/dashboard-nav.ts` (+ teste) | Grupo "Gestão" com Integrações |
| `lib/formatters/{data,telefone,numero,texto}.ts` (+ testes) | Data no fuso, duração, tempo relativo, telefone, número, moeda, iniciais, busca |
| `lib/conversations/janela.ts` (+ teste) | Janela de 24h da Meta |
| `lib/scheduling/conflitos.ts` (+ teste) | Sobreposição por profissional |
| `lib/whatsapp/corpo-do-template.ts` (+ teste) | Variáveis `{{n}}`, validação e trechos |
| `lib/billing/plan-limits.ts`, `consumo.ts` (+ testes) | Atendimentos por plano e projeção do ciclo |
| `components/patterns/{filtro-segmentado,busca,linha-do-tempo,lista-de-dados,avatar-de-iniciais,medidor-de-uso,previa-do-whatsapp}.tsx` | Padrões novos |
| `components/{conversations,patients,schedule,templates,sequences,billing,team}/` | Telas de domínio |
| `app/(admin)/admin/design-system/_fixtures/*.ts` | Dado fictício |
| `app/(admin)/admin/design-system/telas/*/page.tsx` | Rotas de protótipo, que só juntam fixture e componente |
| `tests/architecture/prototipos.test.ts` | Guardas do dado fictício |

Somem: `components/patterns/workspace-page.tsx` e `components/patterns/search-input.tsx` (v0, sem uso depois da troca).

## Verificação visual

Copie `docs/design/shot-referencia.mjs` para `$SCRATCH/shot/shot.mjs` e rode `npm i playwright-core@1` nessa pasta. Os comandos:

```bash
SHOT="C:/Users/Jhone/AppData/Local/Temp/claude/c--Projetos-pessoais-Nextech/36393f81-96a1-4360-809e-68f9b5b4af72/scratchpad/shot"
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs <pasta> admin:<rota>:<tema>:<largura> ...
MSYS_NO_PATHCONV=1 node $SHOT/shot.mjs --cores /
```

Para cada tela, gere as capturas de `dark:1440`, `light:1440` e `dark:390` e critique cada uma com a seção 12 do prompt mestre:
- a hierarquia se entende em 5 segundos?
- a ação primária é evidente?
- há borda de mais?
- o celular parece projetado?

Antes de trocar de branch, rode `git checkout -- CLAUDE.md`.

---

### Tarefa 1: Menu com "Gestão" e "Integrações"

**Arquivos:**
- Modificar: `lib/navigation/dashboard-nav.ts`, `lib/navigation/navigation.test.ts`, `components/shell/icones.ts` e `components/shell/trilha.test.ts`
- Modificar: `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md` (bloco "Atualização 2026-09-26")

- [x] **Passo 1: testes que falham** (em `navigation.test.ts`)

```ts
it("tem os três grupos, nesta ordem", () => {
  expect(DASHBOARD_NAV.map((g) => g.label)).toEqual(["Operação", "Automação", "Gestão"])
})

it("Gestão lista perfil, equipe, integrações e cobrança", () => {
  const gestao = DASHBOARD_NAV.find((g) => g.label === "Gestão")!
  expect(gestao.items.map((i) => i.label)).toEqual([
    "Perfil da clínica",
    "Equipe e acessos",
    "Integrações",
    "Plano e cobrança",
  ])
})

it("staff não vê o grupo Gestão", () => {
  const grupos = resolveDashboardNav("staff", "/dashboard").map((g) => g.label)
  expect(grupos).toEqual(["Operação", "Automação"])
})

it("Integrações é só do owner: guarda credencial da clínica", () => {
  expect(rotulos("owner")).toContain("Integrações")
  expect(rotulos("staff")).not.toContain("Integrações")
  expect(rotulos("professional")).not.toContain("Integrações")
})

it("Integrações ainda não tem tela", () => {
  const item = DASHBOARD_NAV.flatMap((g) => g.items).find((i) => i.label === "Integrações")!
  expect(item).toMatchObject({ href: "/dashboard/integrations", status: "em-breve" })
})
```

Remova os testes antigos equivalentes ("Configuração lista…" e "staff não vê o grupo Configuração"). Em `trilha.test.ts`, troque o comentário para "staff não vê Gestão" e acrescente:

```ts
it("perfil da clínica fica sob Gestão", () => {
  const rota = "/dashboard/settings"
  expect(montarTrilha(resolveDashboardNav("owner", rota), rota)).toEqual([
    { label: "Gestão" },
    { label: "Perfil da clínica" },
  ])
})
```

- [x] **Passo 2:** rode `npx vitest run lib/navigation components/shell`. Esperado: falha em "Gestão".
- [x] **Passo 3: implementar.**
  - Em `DASHBOARD_NAV`, o terceiro grupo passa a `label: "Gestão"`, com os itens nesta ordem:
    - Perfil;
    - Equipe;
    - `{ label: "Integrações", href: "/dashboard/integrations", status: "em-breve", roles: ["owner"] }`;
    - Cobrança.
  - Atualize os comentários: "staff — Operação e Automação, sem Gestão"; o cabeçalho vazio vira "Gestão".
  - Em `icones.ts`, adicione `"/dashboard/integrations": Plug`.
- [x] **Passo 4:** rode `npx vitest run lib/navigation components/shell tests/architecture`. Esperado: tudo passa. `rotas.test.ts` confirma que `/dashboard/integrations` não tem página.
- [x] **Passo 5: doc.** No topo de `2026-09-16-navegacao-e-rotas-design.md`, registre a atualização com as quatro decisões da tabela "Decisões do Jhones". Na tabela da seção 1, renomeie o grupo e acrescente a linha de Integrações (rota `/dashboard/integrations`, fases 5 e 6, "Estado das conexões da clínica: Google Calendar, CRM e WhatsApp de cada agente").
- [x] **Passo 6: commit.** `feat(nav): grupo Gestão com Integrações, só para o responsável`

---

### Tarefa 2: Formatadores (`lib/formatters`)

**Arquivos:**
- Criar: `lib/formatters/data.ts`, `telefone.ts`, `numero.ts`, `texto.ts` e `formatters.test.ts`
- Modificar: `components/shell/user-menu.tsx` (passa a importar `iniciais` de `lib/formatters/texto`)
- Modificar: `lib/clinic-profile/schema.ts` (`normalizarTermo` delega para `normalizarTexto`)

**Interfaces produzidas:**
```ts
// data.ts
export const FUSO_PADRAO = "America/Sao_Paulo"
export type PartesDaData = { ano: number; mes: number; dia: number; hora: number; minuto: number; diaDaSemana: number }
export function partesDaData(instante: Date | string, fuso?: string): PartesDaData
export function formatarHora(instante: Date | string, fuso?: string): string          // "08:05"
export function formatarData(instante: Date | string, fuso?: string): string          // "28/09/2026"
export function formatarDataCurta(instante: Date | string, fuso?: string): string     // "28 set"
export function chaveDoDia(instante: Date | string, fuso?: string): string            // "2026-09-28"
export function somarDias(chave: string, dias: number): string
export function diaDaSemanaDaChave(chave: string): number                             // 0 = domingo
export function semanaDe(chave: string): string[]                                     // 7 chaves, segunda primeiro
export function descreverDia(chave: string): string                                   // "segunda, 28 de setembro"
export function rotuloCurtoDoDia(chave: string): string                               // "seg 28"
export function tempoRelativo(instante: Date | string, agora: Date | string, fuso?: string): string
export function formatarDuracao(ms: number): string
// telefone.ts
export function formatarTelefone(e164: string): string                                // "(81) 99911-2895"
// numero.ts
export function formatarNumero(n: number): string                                     // "1.284"
export function formatarMoeda(centavos: number): string                               // "R$ 1.234,50"
// texto.ts
export function normalizarTexto(valor: string): string
export function iniciais(nome: string): string
export function plural(n: number, um: string, varios: string): string                 // "3 agentes"
export function contemBusca(campos: readonly (string | null)[], busca: string): boolean
```

- [x] **Passo 1: testes que falham** (`lib/formatters/formatters.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import {
  chaveDoDia, descreverDia, formatarData, formatarDataCurta, formatarDuracao, formatarHora,
  partesDaData, rotuloCurtoDoDia, semanaDe, somarDias, tempoRelativo,
} from "./data"
import { formatarTelefone } from "./telefone"
import { formatarMoeda, formatarNumero } from "./numero"
import { contemBusca, iniciais, normalizarTexto, plural } from "./texto"

const AGORA = "2026-09-28T14:32:00-03:00" // segunda-feira

describe("datas no fuso da clínica", () => {
  it("lê hora e dia em São Paulo mesmo com o instante em UTC", () => {
    // 02:10 UTC do dia 29 ainda é dia 28 em São Paulo
    expect(partesDaData("2026-09-29T02:10:00Z")).toMatchObject({ dia: 28, hora: 23, minuto: 10, diaDaSemana: 1 })
  })

  it("formata hora, data e data curta", () => {
    expect(formatarHora("2026-09-28T08:05:00-03:00")).toBe("08:05")
    expect(formatarData(AGORA)).toBe("28/09/2026")
    expect(formatarDataCurta(AGORA)).toBe("28 set")
  })

  it("meia-noite é 00, não 24", () => {
    expect(formatarHora("2026-09-28T00:00:00-03:00")).toBe("00:00")
  })

  it("recusa data inválida em vez de mostrar NaN", () => {
    expect(() => formatarHora("ontem")).toThrow(RangeError)
  })
})

describe("chaves de dia", () => {
  it("gera a chave do dia local", () => {
    expect(chaveDoDia("2026-09-29T02:10:00Z")).toBe("2026-09-28")
  })

  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-09-28", 3)).toBe("2026-10-01")
    expect(somarDias("2026-10-01", -1)).toBe("2026-09-30")
  })

  it("a semana começa na segunda", () => {
    expect(semanaDe("2026-10-01")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ])
    expect(semanaDe("2026-10-04")[0]).toBe("2026-09-28") // domingo fecha a semana
  })

  it("descreve o dia por extenso e em rótulo curto", () => {
    expect(descreverDia("2026-09-28")).toBe("segunda, 28 de setembro")
    expect(rotuloCurtoDoDia("2026-10-03")).toBe("sáb 3")
  })
})

describe("tempo relativo", () => {
  it.each([
    ["2026-09-28T14:31:30-03:00", "agora"],
    ["2026-09-28T14:27:00-03:00", "há 5 min"],
    ["2026-09-28T11:02:00-03:00", "há 3 h"],
    ["2026-09-27T22:00:00-03:00", "ontem"],
    ["2026-09-24T10:00:00-03:00", "há 4 dias"],
    ["2026-09-12T10:00:00-03:00", "12 set"],
    ["2025-12-30T10:00:00-03:00", "30 dez 2025"],
  ])("%s → %s", (instante, esperado) => {
    expect(tempoRelativo(instante, AGORA)).toBe(esperado)
  })
})

describe("duração", () => {
  it.each([
    [30_000, "menos de 1 min"],
    [45 * 60_000, "45 min"],
    [3 * 3_600_000, "3 h"],
    [3 * 3_600_000 + 12 * 60_000, "3 h 12 min"],
    [26 * 3_600_000, "1 dia"],
    [5 * 86_400_000 + 3_600_000, "5 dias"],
  ])("%d ms → %s", (ms, esperado) => {
    expect(formatarDuracao(ms)).toBe(esperado)
  })
})

describe("telefone", () => {
  it("formata celular e fixo brasileiros", () => {
    expect(formatarTelefone("+5581999112895")).toBe("(81) 99911-2895")
    expect(formatarTelefone("+558133334444")).toBe("(81) 3333-4444")
  })

  it("devolve número estrangeiro como veio", () => {
    expect(formatarTelefone("+14155550100")).toBe("+14155550100")
  })
})

describe("números e moeda", () => {
  it("separa milhar com ponto", () => {
    expect(formatarNumero(1284)).toBe("1.284")
    expect(formatarNumero(5000)).toBe("5.000")
    expect(formatarNumero(999)).toBe("999")
  })

  it("formata centavos como real", () => {
    expect(formatarMoeda(123450)).toBe("R$ 1.234,50")
    expect(formatarMoeda(9900)).toBe("R$ 99,00")
    expect(formatarMoeda(5)).toBe("R$ 0,05")
  })

  it("recusa centavo fracionado: dinheiro não arredonda escondido", () => {
    expect(() => formatarMoeda(10.5)).toThrow(RangeError)
  })
})

describe("texto", () => {
  it("normaliza acento, caixa e espaço", () => {
    expect(normalizarTexto("  Dôr  No PEITO ")).toBe("dor no peito")
  })

  it("iniciais do nome ou do e-mail", () => {
    expect(iniciais("Ana Paula Souza")).toBe("AS")
    expect(iniciais("carla.mota@clinica.com")).toBe("CM")
    expect(iniciais("Bia")).toBe("BI")
  })

  it("plural com número formatado", () => {
    expect(plural(1, "agente", "agentes")).toBe("1 agente")
    expect(plural(1200, "atendimento", "atendimentos")).toBe("1.200 atendimentos")
  })

  it("busca ignora acento e casa telefone por dígitos", () => {
    expect(contemBusca(["Mariana Araújo", "+5581900000001"], "araujo")).toBe(true)
    expect(contemBusca(["Mariana Araújo", "+5581900000001"], "(81) 90000-0001")).toBe(true)
    expect(contemBusca([null, "+5581900000001"], "joão")).toBe(false)
    expect(contemBusca(["Qualquer"], "   ")).toBe(true)
  })

  it("dois dígitos soltos não casam telefone por acaso", () => {
    expect(contemBusca(["Ana", "+5581900000001"], "81")).toBe(false)
  })
})
```

- [x] **Passo 2:** rode `npx vitest run lib/formatters`. Esperado: falha (módulos inexistentes).
- [x] **Passo 3: implementar.** Regras que o código precisa seguir:
  - `partesDaData` usa um `Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", weekday: "short", year/month/day/hour/minute numéricos })`, em cache por fuso, e lê só números com `formatToParts`. Nomes de mês (`jan…dez`, `janeiro…dezembro`) e de dia (`dom…sáb`, `domingo…sábado`) vêm de tabela própria. Data inválida lança `RangeError("Data inválida")`.
  - As chaves de dia fazem a aritmética em `Date.UTC`.
  - `tempoRelativo`, nesta ordem:
    1. menos de 60 s (inclui futuro por desvio de relógio) → "agora";
    2. menos de 60 min → `há N min`;
    3. mesmo dia local → `há N h`;
    4. um dia de calendário antes → "ontem";
    5. menos de 7 dias → `há N dias`;
    6. o resto → data curta, com o ano quando for outro.
  - `formatarDuracao`:
    1. menos de 1 min → "menos de 1 min";
    2. menos de 60 min → `N min`;
    3. menos de 24 h → `H h` ou `H h M min`;
    4. o resto → `1 dia` ou `N dias`.
  - `formatarTelefone`: `/^\+55(\d{2})(\d{4,5})(\d{4})$/`.
  - `formatarNumero` e `formatarMoeda` fazem o milhar por regex, sem Intl.
  - `contemBusca`: termo normalizado contido em algum campo normalizado, ou, se a busca tem 3 dígitos ou mais, dígitos contidos nos dígitos de algum campo. Busca vazia casa tudo.
  - Mova `iniciais` de `user-menu.tsx` para `texto.ts` sem mudar o corpo. `normalizarTermo` passa a ser `return normalizarTexto(valor)`, mantendo o comentário.
- [x] **Passo 4:** rode `npx vitest run lib/formatters lib/clinic-profile components/shell && npx tsc --noEmit`. Esperado: passa.
- [x] **Passo 5: commit.** `feat(formatters): datas no fuso da clínica, moeda e busca sem Intl textual`

---

### Tarefa 3: Padrões novos e guardas do protótipo

**Arquivos:**
- Criar: `components/patterns/filtro-segmentado.tsx`, `busca.tsx`, `linha-do-tempo.tsx`, `lista-de-dados.tsx`, `avatar-de-iniciais.tsx` e `patterns.test.tsx`
- Criar: `tests/architecture/prototipos.test.ts` e `app/(admin)/admin/design-system/_fixtures/agora.ts`
- Modificar: `tests/architecture/tokens.test.ts` (varre toda subpasta de `components/`, menos `ui` e `marketing`)

**Interfaces produzidas** (todas server-compatíveis, sem `"use client"`):
```ts
export type Segmento = { valor: string; rotulo: string; href: string; contagem?: number }
export function FiltroSegmentado(p: { rotulo: string; segmentos: readonly Segmento[]; atual: string }): JSX.Element
export function Busca(p: { rotulo: string; placeholder?: string; valor?: string; preservar?: Record<string, string | undefined> }): JSX.Element
export type EventoDaLinha = { id: string; instante: string; quando: string; titulo: string; detalhe?: string; tom?: StatusTone; icone?: ReactNode }
export function LinhaDoTempo(p: { rotulo: string; eventos: readonly EventoDaLinha[] }): JSX.Element
export function ListaDeDados(p: { itens: readonly { termo: string; valor: ReactNode }[]; colunas?: 1 | 2 }): JSX.Element
export function AvatarDeIniciais(p: { nome: string; tamanho?: "sm" | "default" | "lg"; className?: string }): JSX.Element
// _fixtures/agora.ts
export const AGORA = "2026-09-28T14:32:00-03:00"
```

**Como cada um se comporta:**
- **`FiltroSegmentado`:** `<nav aria-label>` com `<ul>` de `Link` em pílula. O atual tem `aria-current="page"`, `bg-accent` e `text-ink-1`. A contagem vem em `tabular-nums text-ink-3`. No celular, a faixa rola na horizontal.
- **`Busca`:** `<form role="search" method="get">` com `<label className="sr-only">`, `input type="search" name="q"` e um `input type="hidden"` para cada `preservar` definido. Ícone de lupa. Sem JavaScript.
- **`LinhaDoTempo`:** `<ol aria-label>` com trilho vertical em `border-hairline`. Cada item tem ponto ou ícone no tom, título `text-ink-1`, detalhe `text-ink-2` e `<time dateTime={instante}>` com `quando` em `text-ink-3`.
- **`ListaDeDados`:** `<dl>`, termo `text-xs text-ink-3`, valor `text-sm text-ink-1`.
- **`AvatarDeIniciais`:** `Avatar` com `AvatarFallback` do shadcn, `aria-hidden` (o nome sempre aparece ao lado), neutro (`bg-surface-2 text-ink-2`).

- [x] **Passo 1: testes que falham.** O arquivo `tests/architecture/prototipos.test.ts`, completo:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho.replace(/\\/g, "/")] : []
  })
}

const PROTOTIPOS = "app/(admin)/admin/design-system"
const todos = [...arquivos("app"), ...arquivos("components"), ...arquivos("lib")]

describe("dado fictício", () => {
  // O dado inventado existe para desenhar tela. Se ele vazar para uma rota
  // que a clínica alcança, vira informação falsa sobre paciente de verdade.
  it("só as telas de protótipo importam _fixtures", () => {
    const infratores = todos.filter(
      (f) => !f.startsWith(`${PROTOTIPOS}/`) && readFileSync(f, "utf8").includes("_fixtures"),
    )
    expect(infratores).toEqual([])
  })

  it("componente e lib não importam nada de app/", () => {
    const infratores = [...arquivos("components"), ...arquivos("lib")].filter((f) =>
      /from\s+["']@\/app\//.test(readFileSync(f, "utf8")),
    )
    expect(infratores).toEqual([])
  })

  it("toda tela de protótipo mostra o aviso de dado fictício", () => {
    const paginas = arquivos(`${PROTOTIPOS}/telas`).filter((f) => f.endsWith("/page.tsx"))
    expect(paginas.length).toBeGreaterThanOrEqual(7)
    const semAviso = paginas.filter((f) => !readFileSync(f, "utf8").includes("<AvisoDePrototipo"))
    expect(semAviso).toEqual([])
  })
})
```

Em `components/patterns/patterns.test.tsx`, as asserções (com `renderToStaticMarkup`):
- `FiltroSegmentado`: só o segmento atual tem `aria-current="page"`, e a contagem aparece;
- `Busca`: `role="search"`, `method="get"`, `name="q"` com o valor, hidden de `preservar` definido e nenhum hidden para `undefined`;
- `LinhaDoTempo`: `<time dateTime=` com o instante, itens na ordem recebida;
- `ListaDeDados`: `<dt>` e `<dd>` pareados;
- `AvatarDeIniciais`: iniciais no fallback e `aria-hidden="true"`.

- [x] **Passo 2:** rode `npx vitest run tests/architecture components/patterns`. Esperado:
  - o teste do aviso falha: nenhuma página usa `<AvisoDePrototipo` direto, porque a v0 usa `WorkspacePage prototipo=`;
  - os padrões falham por não existirem.
- [x] **Passo 3:** implemente os padrões e `_fixtures/agora.ts`. Em `tokens.test.ts`, `PAINEL` passa a incluir `readdirSync("components")` filtrado por diretório, menos `ui` e `marketing`. Nas 7 páginas antigas, tire a prop `prototipo` do `WorkspacePage` e ponha `<AvisoDePrototipo entrega="…" />` explícito antes dele. Nunca se commita com teste vermelho.
- [x] **Passo 4:** rode de novo. Esperado: tudo passa.
- [x] **Passo 5: commit.** `feat(patterns): filtro, busca, linha do tempo e guardas do dado fictício`

---

### Tarefa 4: Janela de 24h (`lib/conversations/janela.ts`)

**Interface:**
```ts
export const DURACAO_DA_JANELA_MS = 86_400_000
export const ALERTA_DA_JANELA_MS = 7_200_000
export type Janela =
  | { aberta: true; fechaEm: string; restanteMs: number; fracaoRestante: number }
  | { aberta: false; fechouEm: string | null }
export function janelaDeAtendimento(ultimaDoPaciente: string | null, agora: string | Date): Janela
```

- [x] **Passo 1: teste** (`lib/conversations/janela.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { DURACAO_DA_JANELA_MS, janelaDeAtendimento } from "./janela"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("janela de atendimento da Meta", () => {
  it("sem mensagem do paciente não há janela", () => {
    expect(janelaDeAtendimento(null, AGORA)).toEqual({ aberta: false, fechouEm: null })
  })

  it("aberta: conta 24h a partir da última mensagem do paciente", () => {
    const j = janelaDeAtendimento("2026-09-28T13:32:00-03:00", AGORA)
    expect(j).toMatchObject({ aberta: true, restanteMs: 23 * 3_600_000 })
    if (j.aberta) {
      expect(j.fechaEm).toBe(new Date("2026-09-29T13:32:00-03:00").toISOString())
      expect(j.fracaoRestante).toBeCloseTo(23 / 24)
    }
  })

  it("fecha exatamente 24h depois", () => {
    expect(janelaDeAtendimento("2026-09-27T14:32:00-03:00", AGORA)).toEqual({
      aberta: false,
      fechouEm: new Date(AGORA).toISOString(),
    })
  })

  it("fechada há mais tempo guarda quando fechou", () => {
    const j = janelaDeAtendimento("2026-09-26T09:00:00-03:00", AGORA)
    expect(j).toEqual({ aberta: false, fechouEm: new Date("2026-09-27T09:00:00-03:00").toISOString() })
  })

  it("carimbo no futuro (relógio adiantado) conta como recém-aberta, nunca mais de 24h", () => {
    const j = janelaDeAtendimento("2026-09-28T14:40:00-03:00", AGORA)
    expect(j).toMatchObject({ aberta: true, restanteMs: DURACAO_DA_JANELA_MS, fracaoRestante: 1 })
  })

  it("aceita Date como agora", () => {
    expect(janelaDeAtendimento("2026-09-28T13:32:00-03:00", new Date(AGORA)).aberta).toBe(true)
  })

  it("data inválida é erro, não janela aberta com NaN", () => {
    expect(() => janelaDeAtendimento("ontem", AGORA)).toThrow(RangeError)
  })
})
```

- [x] **Passo 2:** rode e veja falhar.
- [x] **Passo 3: implementar.**

```ts
/**
 * Janela de atendimento da Meta (conversation-engine-v1): 24h a partir da
 * última mensagem DO PACIENTE (`last_inbound_at`). Dentro dela a clínica
 * responde com texto livre; fora, só com template aprovado
 * (whatsapp-templates-v1). Mensagem da clínica, da IA ou do celular, não
 * abre nem estende a janela.
 */
export const DURACAO_DA_JANELA_MS = 24 * 60 * 60 * 1000

/** Abaixo disto a janela entra em alerta: tempo de a recepção ver e responder. */
export const ALERTA_DA_JANELA_MS = 2 * 60 * 60 * 1000

export type Janela =
  | { aberta: true; fechaEm: string; restanteMs: number; fracaoRestante: number }
  | { aberta: false; fechouEm: string | null }

function instante(valor: string | Date): number {
  const t = new Date(valor).getTime()
  if (Number.isNaN(t)) throw new RangeError("Data inválida")
  return t
}

export function janelaDeAtendimento(
  ultimaDoPaciente: string | null,
  agora: string | Date,
): Janela {
  if (!ultimaDoPaciente) return { aberta: false, fechouEm: null }

  const fecha = instante(ultimaDoPaciente) + DURACAO_DA_JANELA_MS
  // Carimbo da Meta à frente do relógio do servidor: a janela acabou de
  // abrir. Limitar a 24h impede uma janela "maior que a da Meta".
  const restante = Math.min(fecha - instante(agora), DURACAO_DA_JANELA_MS)

  if (restante <= 0) return { aberta: false, fechouEm: new Date(fecha).toISOString() }
  return {
    aberta: true,
    fechaEm: new Date(fecha).toISOString(),
    restanteMs: restante,
    fracaoRestante: restante / DURACAO_DA_JANELA_MS,
  }
}
```

- [x] **Passo 4:** rode e veja passar.
- [x] **Passo 5: commit.** `feat(conversations): regra da janela de 24h da Meta`

---

### Tarefa 5: Conversas

Carregue `frontend-design` antes de desenhar.

**Arquivos:**
- Criar em `components/conversations/`: `tipos.ts`, `estado.ts` (+ `estado.test.ts`), `indicador-de-janela.tsx`, `lista-de-conversas.tsx`, `conversa.tsx` (client), `painel-do-paciente.tsx`, `caixa-de-conversas.tsx` e `conversas.test.tsx`
- Modificar: `components/patterns/chat-bubble.tsx` (prop `quem?: "ia" | "equipe"`, padrão `"ia"`, sem mudar o visual de hoje)
- Criar: `_fixtures/pacientes.ts` (base comum a Conversas, Pacientes e Sequências) e `_fixtures/conversas.ts`
- Reescrever: `telas/conversas/page.tsx`

**Tipos** (`tipos.ts`, vocabulário de conversation-engine-v1; na fase 3b, estes tipos passam a ser montados a partir de `lib/conversations`):
```ts
export type Autor = "patient" | "ai" | "human"
export type EventoDaConversa =
  | "humano_assumiu" | "devolvida_para_ia" | "ia_retomou" | "urgencia_detectada"
  | "urgencia_resolvida" | "falha_da_ia" | "qualificado" | "consulta_agendada"
export type ItemDaConversa =
  | { tipo: "mensagem"; id: string; autor: Autor; autorNome?: string; texto: string; em: string;
      audio?: { segundos: number; transcrita: boolean } }
  | { tipo: "nota"; id: string; autorNome: string; texto: string; em: string }
  | { tipo: "evento"; id: string; evento: EventoDaConversa; detalhe?: string; em: string }
export type PacienteDaConversa = {
  id: string; nome: string | null; telefone: string; convenio: string | null
  consentimentoEm: string | null; optOut: boolean; desde: string
  sequenciaAtiva: string | null; proximaConsulta: string | null
}
export type ConversaResumo = {
  id: string; paciente: PacienteDaConversa; agente: string
  atendidaPor: "ai" | "human"; urgente: boolean
  ultimaDoPaciente: string | null
  ultima: { autor: Autor; previa: string; em: string }
  naoLidas: number
}
export type ConversaAberta = ConversaResumo & { humanoAssumiuEm: string | null; itens: ItemDaConversa[] }
```

**Lógica** (`estado.ts`):
```ts
export type EstadoDaConversa = "urgente" | "aguardando" | "humano" | "ia"
export type FiltroDeEstado = EstadoDaConversa | "todas"
export const ROTULO_DO_ESTADO: Record<EstadoDaConversa, string> =
  { urgente: "Urgente", aguardando: "Aguardando", humano: "Humano", ia: "IA" }
export const TOM_DO_ESTADO: Record<EstadoDaConversa, StatusTone> =
  { urgente: "danger", aguardando: "warning", humano: "info", ia: "neutral" }
export function estadoDaConversa(c: Pick<ConversaResumo, "urgente" | "atendidaPor" | "ultima">): EstadoDaConversa
export function ordenarConversas(cs: readonly ConversaResumo[]): ConversaResumo[]
export function contarPorEstado(cs: readonly ConversaResumo[]): Record<FiltroDeEstado, number>
export function filtrarConversas(cs: readonly ConversaResumo[], f: { estado: FiltroDeEstado; busca: string }): ConversaResumo[]
export function lerFiltroDeEstado(valor: string | undefined): FiltroDeEstado   // desconhecido → "todas"
export function tomDaJanela(j: Janela): StatusTone   // aberta com folga: success; aberta e menos de ALERTA: warning; fechada: neutral
```

- [x] **Passo 1: teste** (`components/conversations/estado.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { janelaDeAtendimento } from "@/lib/conversations/janela"
import type { ConversaResumo } from "./tipos"
import {
  contarPorEstado, estadoDaConversa, filtrarConversas, lerFiltroDeEstado, ordenarConversas, tomDaJanela,
} from "./estado"

function conversa(p: Partial<ConversaResumo> & { id: string }): ConversaResumo {
  return {
    paciente: { id: `p-${p.id}`, nome: null, telefone: "+5581900000000", convenio: null,
      consentimentoEm: null, optOut: false, desde: "2026-01-01T00:00:00-03:00",
      sequenciaAtiva: null, proximaConsulta: null },
    agente: "Recepção", atendidaPor: "ai", urgente: false, ultimaDoPaciente: null,
    ultima: { autor: "ai", previa: "", em: "2026-09-28T10:00:00-03:00" }, naoLidas: 0,
    ...p,
  }
}

describe("estado da conversa", () => {
  it("urgente vence qualquer outro estado", () => {
    expect(estadoDaConversa(conversa({ id: "1", urgente: true, atendidaPor: "human" }))).toBe("urgente")
  })

  it("com humano e o paciente por último, está aguardando resposta", () => {
    // Inclui a falha da IA: handoff silencioso deixa a pergunta sem resposta.
    const c = conversa({ id: "1", atendidaPor: "human", ultima: { autor: "patient", previa: "?", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("aguardando")
  })

  it("com humano e a clínica por último, é humano", () => {
    const c = conversa({ id: "1", atendidaPor: "human", ultima: { autor: "human", previa: "ok", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("humano")
  })

  it("com a IA, é IA mesmo com o paciente por último: a resposta está a caminho", () => {
    const c = conversa({ id: "1", ultima: { autor: "patient", previa: "oi", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("ia")
  })
})

describe("ordem da caixa", () => {
  it("urgente, depois aguardando, depois o mais recente", () => {
    const cs = [
      conversa({ id: "ia-nova", ultima: { autor: "ai", previa: "", em: "2026-09-28T14:00:00-03:00" } }),
      conversa({ id: "aguardando", atendidaPor: "human", ultima: { autor: "patient", previa: "", em: "2026-09-28T09:00:00-03:00" } }),
      conversa({ id: "urgente", urgente: true, ultima: { autor: "patient", previa: "", em: "2026-09-28T08:00:00-03:00" } }),
      conversa({ id: "ia-velha", ultima: { autor: "ai", previa: "", em: "2026-09-27T14:00:00-03:00" } }),
    ]
    expect(ordenarConversas(cs).map((c) => c.id)).toEqual(["urgente", "aguardando", "ia-nova", "ia-velha"])
  })
})

describe("filtro e contagem", () => {
  const cs = [
    conversa({ id: "1", urgente: true }),
    conversa({ id: "2", paciente: { ...conversa({ id: "x" }).paciente, nome: "Mariana Araújo" } }),
    conversa({ id: "3", atendidaPor: "human", ultima: { autor: "human", previa: "", em: "2026-09-28T10:00:00-03:00" } }),
  ]

  it("conta cada estado e o total", () => {
    expect(contarPorEstado(cs)).toEqual({ todas: 3, urgente: 1, aguardando: 0, humano: 1, ia: 1 })
  })

  it("filtra por estado e por busca ao mesmo tempo", () => {
    expect(filtrarConversas(cs, { estado: "ia", busca: "araujo" }).map((c) => c.id)).toEqual(["2"])
    expect(filtrarConversas(cs, { estado: "todas", busca: "" })).toHaveLength(3)
  })

  it("filtro desconhecido na URL vira todas", () => {
    expect(lerFiltroDeEstado("hackeado")).toBe("todas")
    expect(lerFiltroDeEstado("urgente")).toBe("urgente")
    expect(lerFiltroDeEstado(undefined)).toBe("todas")
  })
})

describe("tom da janela", () => {
  const AGORA = "2026-09-28T14:32:00-03:00"
  it("folga é positiva, menos de 2h é alerta, fechada é neutra", () => {
    expect(tomDaJanela(janelaDeAtendimento("2026-09-28T14:00:00-03:00", AGORA))).toBe("success")
    expect(tomDaJanela(janelaDeAtendimento("2026-09-27T15:32:00-03:00", AGORA))).toBe("warning")
    expect(tomDaJanela(janelaDeAtendimento("2026-09-26T14:00:00-03:00", AGORA))).toBe("neutral")
  })
})
```

- [x] **Passo 2:** veja falhar. **Passo 3:** implemente `estado.ts`. **Passo 4:** veja passar.

- [x] **Passo 5: a tela.**

**`CaixaDeConversas`** (server). Props:
```ts
{ conversas: ConversaResumo[]; contagens: Record<FiltroDeEstado, number>; filtro: { estado: FiltroDeEstado; busca: string }
  aberta: ConversaAberta | null; celularNaConversa: boolean; agora: string; caminho: string; caminhoDaFicha: string }
```
- `PageHeader`: título "Conversas"; descrição "Quem está atendendo cada paciente agora, e o que precisa de você."
- Moldura: `rounded-card border`, grade `md:grid-cols-[20rem_minmax(0,1fr)]` e altura `md:h-[calc(100dvh-12rem)] md:min-h-[36rem]`. Lista e conversa rolam por dentro.
- Coluna da lista: `Busca`, que preserva `status`, e o `FiltroSegmentado`:
  - "Todas";
  - "Urgentes";
  - "Aguardando";
  - "Humano";
  - "IA".

  Cada um com contagem e href que preserva `q`. Abaixo vem a `ListaDeConversas`.
- No celular: sem `?c`, só a lista; com `?c`, só a conversa, com "Voltar às conversas". No desktop, a primeira da lista abre se não houver `?c`.
- Lista vazia pelo filtro: `Vazio` com "Nenhuma conversa neste filtro." e o link "Ver todas".

**`ListaDeConversas`** (server):
- Cada item é um `Link` com `aria-current` quando selecionado e `bg-accent`.
- Conteúdo: `AvatarDeIniciais`, nome (ou telefone formatado quando sem nome), `tempoRelativo`, prévia de uma linha com prefixo "IA: " ou "Você: " quando a clínica falou por último, `StatusBadge` do estado e o contador de não lidas.
- Urgente ganha um trilho `bg-danger-fg` à esquerda; o texto "Urgente" do badge garante a leitura sem cor.

**`Conversa`** (`"use client"`). Guarda em estado local `atendidaPor`, `urgente` e `itens`, iniciados pelas props. Cabeçalho:
- nome, agente e `StatusBadge` do estado derivado;
- `IndicadorDeJanela`: texto "Janela aberta: fecha em 3 h 12 min" ou "Janela fechada às 09:14" e uma linha de 2px que esvazia com `fracaoRestante`, no `tomDaJanela`. É o elemento memorável da tela. `role="meter"`, com `aria-valuetext`;
- botão "Paciente", que abre um `Sheet` abaixo de `xl` e, no celular, fica ao lado do link de voltar.

Faixa de estado:
- **urgente** (`danger`): "Urgência detectada. A IA parou e só volta quando alguém da equipe resolver." Botão "Marcar como resolvida": `urgente=false`, `atendidaPor="human"`, evento `urgencia_resolvida`.
- **humano** (`info`): "A equipe está atendendo. A IA volta sozinha 24h depois da última mensagem da equipe." Mostra a hora calculada de `humanoAssumiuEm` + 24h. Botão "Devolver para a IA": evento `devolvida_para_ia`.

Linha do tempo, com separador de dia ("Hoje", "Ontem", "26 set"):
- **Paciente:** `ChatBubble lado="paciente"`.
- **IA:** `lado="clinica" quem="ia"`, com autor "IA" e ícone de robô.
- **Equipe:** `quem="equipe"`, com o nome da pessoa. O tom é neutro (`bg-surface-2`, borda `hairline`), para a IA e a equipe se distinguirem pela cor e pelo rótulo.
- **Áudio:** ícone de microfone e "Áudio, 0:42". Se `transcrita` é false: "Transcrição não guardada: paciente sem consentimento".
- **Nota:** cartão largo em `warning-bg`/`warning-border`, com cadeado e "Nota interna de Carla, só a equipe vê".
- **Evento:** pílula centralizada com ícone e texto. Os textos ficam em `EVENTOS: Record<EventoDaConversa, { texto: string; icone: LucideIcon }>`.

Rodapé: `Tabs` com "Responder" e "Nota interna".
- **Responder, com a IA atendendo:** "A IA está respondendo esta conversa." e botão "Assumir conversa" (`primario`), que muda para humano e registra o evento `humano_assumiu`.
- **Responder, com a janela fechada:** "A janela de 24h fechou. Texto livre não chega mais ao paciente; só um template aprovado." e "Enviar template" desabilitado (protótipo).
- **Responder, com humano e janela aberta:** `Textarea` e "Enviar". Acrescenta uma mensagem `human` com o autor "Você".
- **Nota interna:** sempre disponível. `Textarea` e "Salvar nota".

Comentário no topo do arquivo: "No protótipo, assumir, devolver, resolver, responder e anotar mudam só o estado local. A fase 3b liga estes pontos às server actions."

**`PainelDoPaciente`**:
- nome e telefone formatado;
- `ListaDeDados` com:
  - Convênio (ou "Particular ou não informado");
  - Consentimento (`StatusBadge` success com "Dado em 12/03/2026", ou warning "Pendente");
  - Mensagens automáticas ("Recebe", ou "Pediu para não receber");
  - Sequência ativa;
  - Próxima consulta;
  - Paciente desde;
- link "Abrir ficha do paciente" para `${caminhoDaFicha}/${id}`.

No `xl`, fica numa coluna fixa de 17rem à direita da conversa; abaixo disso, no `Sheet` com `SheetTitle`.

**Fixtures:**
- `_fixtures/pacientes.ts`: 12 pacientes no tipo `PacienteNaTabela` da tarefa 6 (defina o tipo aqui, se preciso, e mova depois). Nomes, telefones `+55819000000NN` e convênios fictícios.
- `_fixtures/conversas.ts`: 7 conversas de clínica odontológica, com os agentes "Recepção Odonto" e "Estética":
  1. urgente: sangramento depois de extração, com `urgencia_detectada` e o detalhe da palavra;
  2. aguardando: falha da IA, com `falha_da_ia`;
  3. humano: Carla assumiu, com nota interna;
  4. humano com a janela fechada: última do paciente há 30 h;
  5. IA com a janela perto de fechar: última do paciente há 23 h;
  6. IA agendando: `qualificado` e `consulta_agendada`;
  7. IA com áudio sem consentimento.

**Página** (`telas/conversas/page.tsx`, async):
1. lê `searchParams` (`c`, `status`, `q`);
2. filtra com `filtrarConversas` e conta com `contarPorEstado`;
3. acha a aberta;
4. renderiza `<AvisoDePrototipo entrega="motor de conversa (fase 3b)" />` e a `CaixaDeConversas`, com `caminho="/admin/design-system/telas/conversas"`, `caminhoDaFicha="/admin/design-system/telas/pacientes"` e `agora={AGORA}`.

- [x] **Passo 6: testes de renderização** (`conversas.test.tsx`). As asserções:
  - a lista mostra o texto do estado de cada conversa e `aria-current` só na selecionada;
  - a lista com uma conversa urgente começa por ela;
  - `Conversa` com a IA atendendo mostra "Assumir conversa" e nenhum textarea de resposta;
  - `Conversa` com a janela fechada mostra "só um template aprovado";
  - uma nota aparece com "Nota interna" e o nome do autor;
  - a bolha da IA mostra o autor "IA", e a da equipe o nome da pessoa.
- [x] **Passo 7:** rode `npx vitest run components tests/architecture && npx tsc --noEmit`, depois as capturas de `/admin/design-system/telas/conversas` (os 3 tamanhos) e de `?c=<id>` em 390px. Critique e corrija.
- [x] **Passo 8: commit.** `feat(conversations): protótipo da caixa com janela de 24h e passagem para humano`

---

### Tarefa 6: Pacientes

Carregue `frontend-design`.

**Arquivos:**
- Criar em `components/patients/`: `tipos.ts`, `segmentos.ts` (+ teste), `tabela-de-pacientes.tsx`, `ficha-do-paciente.tsx` e `pacientes.test.tsx`
- Criar: `telas/pacientes/[id]/page.tsx`
- Reescrever: `telas/pacientes/page.tsx`

**Tipos** (usam o `Patient` real de `lib/patients/schema.ts`: é a tela cujo dado já existe):
```ts
export type PacienteNaTabela = Patient & { convenio: string | null }
export type TipoDeContato = "primeiro_contato" | "consentimento" | "conversa" | "sequencia_entrou" | "sequencia_parou" | "consulta" | "opt_out"
export type ContatoDoPaciente = { id: string; tipo: TipoDeContato; em: string; detalhe: string }
export type FichaDoPaciente = PacienteNaTabela & { historico: ContatoDoPaciente[]; conversaId: string | null }
```

**Lógica** (`segmentos.ts`):
```ts
export type SegmentoDePacientes = "todos" | "sem-consentimento" | "opt-out" | "inativos"
export const DIAS_PARA_INATIVO = 180 // gatilho padrão de reativação (message-sequences-v1)
export function lerSegmento(valor: string | undefined): SegmentoDePacientes
export function estaNoSegmento(p: Patient, s: SegmentoDePacientes, agora: string): boolean
export function filtrarPacientes(ps: readonly PacienteNaTabela[], f: { segmento: SegmentoDePacientes; busca: string }, agora: string): PacienteNaTabela[] // último contato primeiro
export function contarSegmentos(ps: readonly PacienteNaTabela[], agora: string): Record<SegmentoDePacientes, number>
```

- [x] **Passo 1: teste** (`segmentos.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import type { PacienteNaTabela } from "./tipos"
import { contarSegmentos, estaNoSegmento, filtrarPacientes, lerSegmento } from "./segmentos"

const AGORA = "2026-09-28T14:32:00-03:00"
function p(x: Partial<PacienteNaTabela> & { id: string }): PacienteNaTabela {
  return {
    clinic_id: "c", whatsapp_phone_number: "+5581900000000", name: null, insurance_id: null,
    created_at: "2026-01-01T00:00:00-03:00", last_contact_at: "2026-09-27T10:00:00-03:00",
    consent_given_at: "2026-01-01T00:00:00-03:00", opted_out: false, convenio: null, ...x,
  }
}

describe("segmentos de pacientes", () => {
  it("sem consentimento é consent_given_at nulo", () => {
    expect(estaNoSegmento(p({ id: "1", consent_given_at: null }), "sem-consentimento", AGORA)).toBe(true)
  })

  it("inativo é 180 dias ou mais sem contato, como o gatilho de reativação", () => {
    expect(estaNoSegmento(p({ id: "1", last_contact_at: "2026-04-01T14:32:00-03:00" }), "inativos", AGORA)).toBe(true)
    expect(estaNoSegmento(p({ id: "1", last_contact_at: "2026-04-02T14:33:00-03:00" }), "inativos", AGORA)).toBe(false)
  })

  it("todos inclui quem saiu das mensagens", () => {
    expect(estaNoSegmento(p({ id: "1", opted_out: true }), "todos", AGORA)).toBe(true)
  })

  it("conta cada segmento", () => {
    const ps = [p({ id: "1" }), p({ id: "2", opted_out: true, consent_given_at: null })]
    expect(contarSegmentos(ps, AGORA)).toEqual({ todos: 2, "sem-consentimento": 1, "opt-out": 1, inativos: 0 })
  })

  it("filtra por nome ou telefone e ordena pelo contato mais recente", () => {
    const ps = [
      p({ id: "velho", name: "Rafael Mendes", last_contact_at: "2026-09-01T10:00:00-03:00" }),
      p({ id: "novo", name: "Rafaela Lins", last_contact_at: "2026-09-28T10:00:00-03:00" }),
      p({ id: "outro", name: "Camila", whatsapp_phone_number: "+5581900000077" }),
    ]
    expect(filtrarPacientes(ps, { segmento: "todos", busca: "rafa" }, AGORA).map((x) => x.id)).toEqual(["novo", "velho"])
    expect(filtrarPacientes(ps, { segmento: "todos", busca: "000077" }, AGORA).map((x) => x.id)).toEqual(["outro"])
  })

  it("segmento desconhecido na URL vira todos", () => {
    expect(lerSegmento("x")).toBe("todos")
  })
})
```

- [x] **Passos 2 a 4:** falha, implementação, passa.

- [x] **Passo 5: a tela.**

**`TabelaDePacientes`** (server). Props: `{ pacientes; contagens; filtro; agora; caminho }`.
- `PageHeader`:
  - título "Pacientes";
  - descrição "Todo paciente que já falou com a clínica pelo WhatsApp.";
  - ação "Cadastrar paciente" desabilitada (protótipo).
- `Busca` e `FiltroSegmentado`: "Todos", "Sem consentimento", "Não recebem mensagens" e "Sem contato há 6 meses".
- `Table` do shadcn com as colunas:
  - Paciente: nome, ou "Sem nome ainda" em `text-ink-3`; no celular, o telefone vai embaixo;
  - Telefone (`md+`);
  - Convênio (`lg+`);
  - Último contato (relativo);
  - Consentimento (`StatusBadge`: success "Dado" ou warning "Pendente");
  - Mensagens (`sm+`: "Recebe" neutro, ou "Não recebe" neutro com ícone).
- A linha inteira é clicável: um `Link` no nome com `after:absolute after:inset-0` e a linha `relative`.
- Vazio: "Nenhum paciente neste filtro."

**`FichaDoPaciente`** (server). Props: `{ paciente: FichaDoPaciente; agora; caminhoDaLista; caminhoDaConversa }`.
- "Pacientes" como link de volta.
- `PageHeader` com o nome, e a descrição com o telefone e "Paciente desde 12 mar".
- Grade `lg:[minmax(0,1fr)_20rem]`:
  - principal: `Cartao` "Histórico de contato" com `LinhaDoTempo`. É só metadado (canal, agente, sequência, motivo de parada): a ficha nunca mostra conteúdo de mensagem, o que protege a exposição desnecessária;
  - lateral: três `Cartao`:
    - "Consentimento": estado e o que ele permite, por exemplo "Com consentimento, a transcrição de áudio pode ser guardada.";
    - "Mensagens automáticas": opt-out; se saiu, "Pediu para não receber em 14/08. Nunca volta a ser inscrito sozinho.";
    - "Convênio".
- Ações:
  - "Abrir conversa", link para `caminhoDaConversa?c=` quando houver;
  - "Excluir dados do paciente" (`perigo`, desabilitado), com a explicação LGPD de que remove ou anonimiza e encerra as sequências.

**Página `[id]`:** `notFound()` quando o id não existe no fixture.

- [x] **Passo 6: testes de renderização.** As asserções:
  - sem nome aparece "Sem nome ainda";
  - os badges "Pendente" e "Não recebe" aparecem;
  - a ficha de quem saiu mostra "Nunca volta a ser inscrito";
  - o histórico renderiza `<time`.
- [x] **Passo 7:** rode os testes, `tsc` e as capturas (lista e ficha, 3 tamanhos cada). Critique e corrija.
- [x] **Passo 8: commit.** `feat(patients): protótipo da lista e da ficha com consentimento e opt-out`

---

### Tarefa 7: Conflito de agenda (`lib/scheduling/conflitos.ts`)

**Interface:**
```ts
export type StatusDoAgendamento = "pendente" | "confirmado" | "cancelado" | "faltou"
export type Agendamento = { id: string; profissionalId: string; inicio: string; fim: string; status: StatusDoAgendamento }
export type Conflito = { profissionalId: string; ids: [string, string]; inicio: string; fim: string }
export function sobrepoe(a: Pick<Agendamento, "inicio" | "fim">, b: Pick<Agendamento, "inicio" | "fim">): boolean
export function encontrarConflitos(ags: readonly Agendamento[]): Conflito[]
export function idsEmConflito(cs: readonly Conflito[]): Set<string>
```

- [x] **Passo 1: teste** (`lib/scheduling/conflitos.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { encontrarConflitos, idsEmConflito, sobrepoe, type Agendamento } from "./conflitos"

const h = (hhmm: string) => `2026-09-28T${hhmm}:00-03:00`
function ag(id: string, ini: string, fim: string, x: Partial<Agendamento> = {}): Agendamento {
  return { id, profissionalId: "ana", inicio: h(ini), fim: h(fim), status: "confirmado", ...x }
}

describe("sobreposição", () => {
  it("encostar não é conflito: é agenda cheia", () => {
    expect(sobrepoe(ag("a", "09:00", "09:30"), ag("b", "09:30", "10:00"))).toBe(false)
  })
  it("começar antes de o outro terminar é conflito", () => {
    expect(sobrepoe(ag("a", "09:00", "09:40"), ag("b", "09:30", "10:00"))).toBe(true)
  })
  it("um dentro do outro é conflito", () => {
    expect(sobrepoe(ag("a", "09:00", "11:00"), ag("b", "09:30", "10:00"))).toBe(true)
  })
})

describe("conflitos da agenda", () => {
  it("devolve o par e o trecho sobreposto", () => {
    expect(encontrarConflitos([ag("a", "10:00", "10:40"), ag("b", "10:30", "11:00")])).toEqual([
      { profissionalId: "ana", ids: ["a", "b"], inicio: new Date(h("10:30")).toISOString(), fim: new Date(h("10:40")).toISOString() },
    ])
  })

  it("profissionais diferentes no mesmo horário não conflitam", () => {
    expect(encontrarConflitos([ag("a", "10:00", "11:00"), ag("b", "10:00", "11:00", { profissionalId: "bruno" })])).toEqual([])
  })

  it("cancelado libera o horário", () => {
    expect(encontrarConflitos([ag("a", "10:00", "11:00"), ag("b", "10:00", "11:00", { status: "cancelado" })])).toEqual([])
  })

  it("três sobrepostos geram os três pares, em ordem de início", () => {
    const cs = encontrarConflitos([ag("c", "10:20", "10:50"), ag("a", "10:00", "11:00"), ag("b", "10:10", "10:30")])
    expect(cs.map((c) => c.ids)).toEqual([["a", "b"], ["a", "c"], ["b", "c"]])
    expect(idsEmConflito(cs)).toEqual(new Set(["a", "b", "c"]))
  })

  it("duração zero ou negativa é dado quebrado, não agenda", () => {
    expect(() => encontrarConflitos([ag("a", "10:00", "10:00")])).toThrow(RangeError)
  })
})
```

- [x] **Passo 2:** veja falhar.
- [x] **Passo 3: implementar.**
  - `sobrepoe`: `ini(a) < fim(b) && ini(b) < fim(a)`.
  - `encontrarConflitos`:
    1. valida duração maior que zero;
    2. descarta cancelados;
    3. agrupa por profissional e ordena por início;
    4. varre cada `i`, comparando com `j > i` enquanto `ini(j) < fim(i)`;
    5. o trecho sobreposto vai de `max(inícios)` a `min(fins)`, em ISO;
    6. ordena o resultado por `inicio` e, no empate, pelos ids.
- [x] **Passo 4:** veja passar.
- [x] **Passo 5: commit.** `feat(scheduling): detecção de conflito por profissional`

---

### Tarefa 8: Agenda

Carregue `frontend-design`.

**Arquivos:**
- Criar em `components/schedule/`: `tipos.ts`, `grade.ts` (+ `grade.test.ts`), `agenda-do-dia.tsx`, `agenda-da-semana.tsx`, `agenda-em-lista.tsx`, `tela-da-agenda.tsx` e `agenda.test.tsx`
- Criar: `_fixtures/agenda.ts`
- Reescrever: `telas/agenda/page.tsx`

**Tipos e lógica de layout:**
```ts
export type ProfissionalDaAgenda = { id: string; nome: string; especialidade: string }
export type CompromissoDaAgenda = Agendamento & { paciente: string; procedimento: string }
export type Expediente = { abre: string; fecha: string; diasAbertos: readonly number[] } // "08:00", 0 = domingo
export type Visao = "dia" | "semana"
// grade.ts
export function horasDaGrade(e: Expediente): string[]                 // ["08:00", …, "17:00"]
export function posicaoNaGrade(inicio: string, fim: string, e: Expediente): { topo: number; altura: number } // %, limitada à grade
export function faixas(itens: readonly { id: string; inicio: string; fim: string }[]): Map<string, { faixa: number; total: number }>
export function lerVisao(v: string | undefined): Visao
```

- [x] **Passo 1: teste** (`grade.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { faixas, horasDaGrade, lerVisao, posicaoNaGrade } from "./grade"

const E = { abre: "08:00", fecha: "18:00", diasAbertos: [1, 2, 3, 4, 5] }
const h = (hhmm: string) => `2026-09-28T${hhmm}:00-03:00`

describe("grade da agenda", () => {
  it("uma linha por hora cheia do expediente", () => {
    expect(horasDaGrade(E)).toEqual(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"])
  })

  it("posição em porcentagem do expediente", () => {
    expect(posicaoNaGrade(h("09:00"), h("09:30"), E)).toEqual({ topo: 10, altura: 5 })
  })

  it("consulta que passa do expediente é cortada na borda", () => {
    expect(posicaoNaGrade(h("17:30"), h("18:30"), E)).toEqual({ topo: 95, altura: 5 })
    expect(posicaoNaGrade(h("07:30"), h("08:30"), E)).toEqual({ topo: 0, altura: 5 })
  })

  it("sobrepostos dividem a coluna; os seguintes voltam a ocupar tudo", () => {
    const m = faixas([
      { id: "a", inicio: h("10:00"), fim: h("11:00") },
      { id: "b", inicio: h("10:30"), fim: h("11:30") },
      { id: "c", inicio: h("11:30"), fim: h("12:00") },
    ])
    expect(m.get("a")).toEqual({ faixa: 0, total: 2 })
    expect(m.get("b")).toEqual({ faixa: 1, total: 2 })
    expect(m.get("c")).toEqual({ faixa: 0, total: 1 })
  })

  it("faixa liberada é reaproveitada dentro do mesmo grupo", () => {
    const m = faixas([
      { id: "a", inicio: h("10:00"), fim: h("12:00") },
      { id: "b", inicio: h("10:00"), fim: h("10:30") },
      { id: "c", inicio: h("11:00"), fim: h("11:30") },
    ])
    expect(m.get("c")).toEqual({ faixa: 1, total: 2 })
  })

  it("visão desconhecida vira dia", () => {
    expect(lerVisao("mes")).toBe("dia")
    expect(lerVisao("semana")).toBe("semana")
  })
})
```

- [x] **Passos 2 a 4:** falha, implementação, passa. `faixas` agrupa por sobreposição transitiva e, dentro do grupo, dá a menor faixa livre; `total` é o número de faixas do grupo. `posicaoNaGrade` usa `partesDaData` e é arredondada a 2 casas.

- [x] **Passo 5: a tela.**

**`TelaDaAgenda`** (server). Props:
```ts
{ visao: Visao; data: string; profissionalId: string | null; profissionais; compromissos: CompromissoDaAgenda[]
  expediente: Expediente; agora: string; caminho: string }
```

Cabeçalho:
- `PageHeader`: título "Agenda"; descrição igual ao dia por extenso ou "Semana de 28 set a 4 out"; ação "Novo agendamento" desabilitada.

Barra:
- `FiltroSegmentado` "Dia"/"Semana";
- navegação "Anterior", "Hoje" e "Próximo", como `Link` com ícones e `aria-label`;
- `FiltroSegmentado` de profissional: "Todos" só na visão dia; na semana, o padrão é o primeiro profissional.

Aviso de conflito: se há conflitos no período, uma caixa `danger` com "2 conflitos antes de confirmar" e a lista "Dra. Ana Lima: Mariana Araújo e João Pedro, 10:30 às 10:40". Os conflitos saem de `encontrarConflitos`.

**`AgendaDoDia`** (`md+`):
- calha de horas à esquerda e uma coluna por profissional, com cabeçalho de nome e especialidade;
- 1 hora = 4rem;
- blocos posicionados por `posicaoNaGrade` e `faixas`;
- conteúdo do bloco: hora "10:00 às 10:40", paciente e procedimento;
- estados:
  - confirmado: trilho `bg-ink-2` e `bg-surface-1`;
  - pendente: borda tracejada e "A confirmar";
  - faltou: `text-ink-3` e "Faltou";
  - cancelado: não aparece na grade, só conta no rodapé "1 cancelada";
- conflito: borda `danger-border`, fundo `danger-bg`, ícone e o texto "Conflito" (nunca só cor);
- o trecho sobreposto ganha hachura `bg-[repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_6px)] text-danger-fg/30`;
- se `data` é o dia de `agora`, uma linha "agora" de 1px em `bg-brand`, com um ponto.

**`AgendaDaSemana`** (`md+`): a mesma grade com 7 colunas (segunda a domingo) para um profissional. Dia fora de `diasAbertos` recebe a hachura neutra e "Fechado".

**`AgendaEmLista`** (abaixo de `md`, com `md:hidden`; as grades usam `hidden md:block`):
- na visão dia, a lista cronológica com hora, paciente, procedimento, profissional e badge;
- na visão semana, agrupada por dia;
- conflito marcado com o mesmo texto.

**Vazio:** "Nenhuma consulta neste dia. Horário livre das 08:00 às 18:00."

**Fixture:** 3 profissionais (Dra. Ana Lima, ortodontia; Dr. Bruno Reis, implante; Dra. Carla Mota, estética) e cerca de 25 compromissos na semana de 28/09. Na segunda:
- dois conflitos (Ana às 10:30 e Bruno às 15:30);
- um cancelado;
- um "faltou" às 08:00;
- um pendente.

- [x] **Passo 6: testes de renderização.** As asserções:
  - o bloco em conflito contém "Conflito";
  - o cancelado não aparece na grade;
  - a lista do celular mostra o nome do profissional;
  - o dia fechado na semana mostra "Fechado".
- [x] **Passo 7:** rode os testes, `tsc` e as capturas (dia e semana; 1440 nos dois temas, 390 no escuro). Critique e corrija.
- [x] **Passo 8: commit.** `feat(schedule): protótipo da agenda por profissional com conflitos visíveis`

---

### Tarefa 9: Corpo do template (`lib/whatsapp/corpo-do-template.ts`)

**Interface:**
```ts
export const LIMITE_DO_CORPO = 1024
export type ProblemaNoCorpo = "vazio" | "longo_demais" | "fora_de_sequencia" | "comeca_com_variavel" | "termina_com_variavel"
export const MENSAGEM_DO_PROBLEMA: Record<ProblemaNoCorpo, string>
export function variaveisDoCorpo(corpo: string): number[]
export function problemasNoCorpo(corpo: string): ProblemaNoCorpo[]
export type Trecho = { tipo: "texto"; texto: string } | { tipo: "variavel"; numero: number }
export function segmentarCorpo(corpo: string): Trecho[]
```
Comentário do módulo: "Regras da Meta para o corpo vigentes em set/2026. Revisar contra a documentação antes da fase 4 (whatsapp-templates-v1, Em aberto). Mudança de regra fica aqui, nunca na tela."

- [x] **Passo 1: teste** (`lib/whatsapp/corpo-do-template.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { LIMITE_DO_CORPO, problemasNoCorpo, segmentarCorpo, variaveisDoCorpo } from "./corpo-do-template"

describe("variáveis do corpo", () => {
  it("lista as variáveis uma vez, em ordem", () => {
    expect(variaveisDoCorpo("Olá {{1}}, sua consulta é {{2}} às {{3}}. Até {{2}}!")).toEqual([1, 2, 3])
  })
  it("chave simples ou com espaço não é variável", () => {
    expect(variaveisDoCorpo("Use {1} ou {{ 1 }}")).toEqual([])
  })
})

describe("validação antes de enviar à Meta", () => {
  it("corpo válido não tem problema", () => {
    expect(problemasNoCorpo("Olá {{1}}, lembrando sua consulta dia {{2}} às {{3}}.")).toEqual([])
  })
  it("vazio", () => {
    expect(problemasNoCorpo("   ")).toEqual(["vazio"])
  })
  it("variáveis precisam ser 1, 2, 3 sem pular", () => {
    expect(problemasNoCorpo("Olá {{1}}, dia {{3}}.")).toContain("fora_de_sequencia")
    expect(problemasNoCorpo("Olá {{2}}.")).toContain("fora_de_sequencia")
  })
  it("não pode começar nem terminar com variável", () => {
    expect(problemasNoCorpo("{{1}}, tudo bem?")).toContain("comeca_com_variavel")
    expect(problemasNoCorpo("Até logo, {{1}}")).toContain("termina_com_variavel")
  })
  it("limite de tamanho", () => {
    expect(problemasNoCorpo("a".repeat(LIMITE_DO_CORPO + 1))).toContain("longo_demais")
  })
})

describe("trechos para a prévia", () => {
  it("alterna texto e variável", () => {
    expect(segmentarCorpo("Olá {{1}}, até {{2}}.")).toEqual([
      { tipo: "texto", texto: "Olá " },
      { tipo: "variavel", numero: 1 },
      { tipo: "texto", texto: ", até " },
      { tipo: "variavel", numero: 2 },
      { tipo: "texto", texto: "." },
    ])
  })
})
```

- [x] **Passos 2 a 4:** falha, implementação (regex `/\{\{(\d+)\}\}/g`), passa.
- [x] **Passo 5: commit.** `feat(whatsapp): validação do corpo de template antes de enviar à Meta`

---

### Tarefa 10: Templates

Carregue `frontend-design`.

**Arquivos:**
- Criar em `components/templates/`: `tipos.ts`, `status.tsx` (+ teste), `biblioteca.tsx`, `editor-de-template.tsx` (client), `tela-de-templates.tsx` e `templates.test.tsx`
- Criar: `components/patterns/previa-do-whatsapp.tsx`, extraída da moldura de `components/agents/preview-de-conversa.tsx`, que passa a usá-la sem mudar o visual
- Criar: `_fixtures/templates.ts`
- Reescrever: `telas/templates/page.tsx`

**Tipos e mapas:**
```ts
export type StatusDoTemplate = "draft" | "pending_review" | "approved" | "rejected"
export type CategoriaDoTemplate = "UTILITY" | "MARKETING"
export type UsoDoTemplate = "lembrete" | "recall" | "reativacao" | "follow_up"
export type TemplateDoWhatsApp = {
  id: string; nome: string; uso: UsoDoTemplate; categoria: CategoriaDoTemplate; agente: string
  corpo: string; exemplos: Record<number, string>; status: StatusDoTemplate
  motivoRejeicao: string | null; enviadoEm: string | null; atualizadoEm: string
}
export const ROTULO_DO_STATUS_DO_TEMPLATE = { draft: "Rascunho", pending_review: "Em análise na Meta", approved: "Aprovado", rejected: "Rejeitado" }
export const TOM_DO_STATUS_DO_TEMPLATE = { draft: "neutral", pending_review: "info", approved: "success", rejected: "danger" }
export const ROTULO_DA_CATEGORIA = { UTILITY: "Utilidade", MARKETING: "Marketing" }
export const ROTULO_DO_USO = { lembrete: "Lembrete de consulta", recall: "Recall de retorno", reativacao: "Reativação", follow_up: "Follow-up pós-consulta" }
export function StatusDoTemplate({ status }: { status: StatusDoTemplate }): JSX.Element
export function podeEnviarParaAprovacao(t: Pick<TemplateDoWhatsApp, "status" | "corpo">): boolean // draft ou rejected, sem problemas no corpo
```

- [x] **Passo 1: teste** (`status.test.tsx`):
  - o mapa de tom é exatamente o acima;
  - só `draft` e `rejected` com corpo válido podem ser enviados;
  - `approved` com corpo válido não pode, porque editar exige reenvio pelo fluxo de rascunho;
  - o badge sempre contém o rótulo.
- [x] **Passos 2 a 4:** falha, implementação, passa.

- [x] **Passo 5: a tela.**

**`TelaDeTemplates`** (server): `{ templates; filtro: { status: StatusDoTemplate | "todos"; busca }; aberto: TemplateDoWhatsApp | null; celularNoEditor: boolean; agora; caminho }`.
- `PageHeader`: título "Templates"; descrição "Mensagens aprovadas pela Meta para falar com o paciente fora da janela de 24h."; ação "Novo template" desabilitada.
- Grade `lg:[20rem_minmax(0,1fr)]`, com o mesmo padrão de celular de Conversas.

**`Biblioteca`:**
- `Busca`;
- `FiltroSegmentado`: "Todos", "Aprovados", "Em análise", "Rejeitados" e "Rascunhos";
- cada item: o uso como título, o nome na Meta (`text-xs text-ink-3`), a categoria e o badge de status.

**`EditorDeTemplate`** (client; estado local `corpo` e `exemplos`):
- **Cabeçalho:** uso, nome, agente e badge.
- **Faixa de status:**
  - rejeitado (`danger`): "Motivo da Meta:" com o texto, e "Ao editar, o template volta para rascunho e precisa ser enviado de novo.";
  - em análise (`info`): "Enviado em 27/09 às 16:10. A análise leva de minutos a um dia; você não precisa fazer nada." O corpo fica somente leitura;
  - aprovado (`success`): "Pode ser usado em lembretes e sequências."
- **Categoria:** dois radios nativos, com o custo explicado ao lado de cada um, nunca em tooltip:
  - Marketing: "cobrada por mensagem, sem desconto de volume";
  - Utilidade: "mais barata; a Meta pode reclassificar como marketing".
- **Corpo:** `Textarea` com contador `n/1024`.
- **Variáveis:** para cada `{{n}}` detectada, um campo "Exemplo para {{n}}".
- **Problemas:** saem de `problemasNoCorpo`, em lista `role="alert"` com `MENSAGEM_DO_PROBLEMA`.
- **Prévia:** `PreviaDoWhatsApp` com a bolha da clínica. Os trechos de variável aparecem com o exemplo destacado (`bg-brand/15`, sublinhado pontilhado) ou, sem exemplo, como a pílula `{{n}}`.
- **Ações:**
  - "Salvar rascunho" (`secundario`) e "Enviar para aprovação" (`primario`), ambos desabilitados no protótipo;
  - se `!podeEnviarParaAprovacao`, o `title` explica o motivo: o problema, "Aguardando a Meta" ou "Aprovado; edite para reenviar".

**Fixture:** 6 templates:
- lembrete aprovado;
- recall de limpeza rejeitado ("O conteúdo foi classificado como marketing, mas a categoria enviada é utilidade.");
- reativação aprovada;
- follow-up em análise;
- dois rascunhos, um deles com `{{3}}` pulando o `{{2}}`, para mostrar a validação.

- [x] **Passo 6: testes de renderização.** As asserções:
  - o rejeitado mostra "Motivo da Meta" e o texto;
  - a prévia substitui a variável pelo exemplo;
  - o rascunho inválido mostra a mensagem de "fora_de_sequencia";
  - o `PreviewDeConversa` do agente continua mostrando "Prévia no WhatsApp".
- [x] **Passo 7:** rode os testes (incluindo `components/agents`), `tsc` e as capturas. Critique e corrija.
- [x] **Passo 8: commit.** `feat(templates): protótipo da biblioteca com validação e prévia no WhatsApp`

---

### Tarefa 11: Sequências

Carregue `frontend-design`.

**Arquivos:**
- Criar em `components/sequences/`: `tipos.ts`, `regras.ts` (+ teste), `lista-de-sequencias.tsx`, `editor-de-sequencia.tsx`, `tela-de-sequencias.tsx` e `sequencias.test.tsx`
- Criar: `_fixtures/sequencias.ts` (usa os pacientes e os templates dos fixtures)
- Reescrever: `telas/sequencias/page.tsx`

**Tipos** (vocabulário de message-sequences-v1):
```ts
export type TipoDeGatilho = "patient_inactive" | "routine_recall" | "post_visit_followup"
export type StatusDaSequencia = "draft" | "active" | "paused"
export type StatusDaInscricao = "active" | "stopped_replied" | "stopped_booked" | "stopped_opted_out" | "completed"
export type PassoDaSequencia = { ordem: number; atrasoDias: number; template: Pick<TemplateDoWhatsApp, "id" | "nome" | "uso" | "categoria" | "status" | "corpo"> }
export type Inscricao = { id: string; paciente: { id: string; nome: string | null; telefone: string }; passoAtual: number; status: StatusDaInscricao; inscritoEm: string; ultimoEnvioEm: string | null }
export type Sequencia = { id: string; nome: string; agente: string; gatilho: { tipo: TipoDeGatilho; dias: number }; status: StatusDaSequencia; passos: PassoDaSequencia[]; inscricoes: Inscricao[] }
```

**Lógica** (`regras.ts`):
```ts
export const ROTULO_DO_GATILHO: Record<TipoDeGatilho, string> // Reativação, Recall, Follow-up
export function descreverGatilho(g: Sequencia["gatilho"]): string
export function diaDeCadaPasso(passos: readonly PassoDaSequencia[]): number[] // acumulado, pela ordem
export function passosBloqueados(passos: readonly PassoDaSequencia[]): number[] // ordens com template não aprovado
export function podeAtivar(s: Pick<Sequencia, "status" | "passos">): boolean
export const ROTULO_DA_INSCRICAO: Record<StatusDaInscricao, string>
export const TOM_DA_INSCRICAO: Record<StatusDaInscricao, StatusTone>
export const ROTULO_DA_SEQUENCIA: Record<StatusDaSequencia, string> // Rascunho, Ativa, Pausada
export const TOM_DA_SEQUENCIA: Record<StatusDaSequencia, StatusTone> // neutral, success, warning
export function resumoDasInscricoes(is: readonly Inscricao[]): Record<StatusDaInscricao, number>
```

- [x] **Passo 1: teste** (`regras.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import type { PassoDaSequencia } from "./tipos"
import {
  descreverGatilho, diaDeCadaPasso, passosBloqueados, podeAtivar, resumoDasInscricoes, TOM_DA_INSCRICAO,
} from "./regras"

function passo(ordem: number, atrasoDias: number, status: PassoDaSequencia["template"]["status"] = "approved"): PassoDaSequencia {
  return { ordem, atrasoDias, template: { id: `t${ordem}`, nome: `t_${ordem}`, uso: "reativacao", categoria: "MARKETING", status, corpo: "Oi {{1}}." } }
}

describe("gatilho", () => {
  it("descreve cada tipo em linguagem da clínica", () => {
    expect(descreverGatilho({ tipo: "patient_inactive", dias: 180 })).toBe("Sem contato há 180 dias")
    expect(descreverGatilho({ tipo: "routine_recall", dias: 180 })).toBe("180 dias desde a última consulta")
    expect(descreverGatilho({ tipo: "post_visit_followup", dias: 1 })).toBe("1 dia depois da consulta")
    expect(descreverGatilho({ tipo: "post_visit_followup", dias: 3 })).toBe("3 dias depois da consulta")
  })
})

describe("passos", () => {
  it("o atraso é relativo ao passo anterior; o dia mostrado é acumulado", () => {
    expect(diaDeCadaPasso([passo(2, 7), passo(1, 3), passo(3, 14)])).toEqual([3, 10, 24])
  })

  it("template não aprovado bloqueia o passo, nunca cai para texto livre", () => {
    expect(passosBloqueados([passo(1, 3), passo(2, 7, "rejected"), passo(3, 7, "pending_review")])).toEqual([2, 3])
  })

  it("só ativa rascunho ou pausada, com passos e nenhum bloqueado", () => {
    expect(podeAtivar({ status: "draft", passos: [passo(1, 3)] })).toBe(true)
    expect(podeAtivar({ status: "draft", passos: [] })).toBe(false)
    expect(podeAtivar({ status: "paused", passos: [passo(1, 3, "draft")] })).toBe(false)
    expect(podeAtivar({ status: "active", passos: [passo(1, 3)] })).toBe(false)
  })
})

describe("inscrições", () => {
  it("parar por resposta ou agendamento é resultado bom; sair é alerta", () => {
    expect(TOM_DA_INSCRICAO).toEqual({
      active: "info", stopped_replied: "success", stopped_booked: "success", stopped_opted_out: "warning", completed: "neutral",
    })
  })

  it("resume por situação", () => {
    const base = { paciente: { id: "p", nome: null, telefone: "+5581900000000" }, passoAtual: 1, inscritoEm: "2026-09-01T00:00:00-03:00", ultimoEnvioEm: null }
    expect(resumoDasInscricoes([
      { ...base, id: "1", status: "active" },
      { ...base, id: "2", status: "stopped_booked" },
      { ...base, id: "3", status: "stopped_booked" },
    ])).toEqual({ active: 1, stopped_replied: 0, stopped_booked: 2, stopped_opted_out: 0, completed: 0 })
  })
})
```

Rótulos da inscrição: "Em andamento", "Respondeu", "Agendou", "Pediu para sair" e "Concluiu sem resposta".

- [x] **Passos 2 a 4:** falha, implementação, passa.

- [x] **Passo 5: a tela.**

**`TelaDeSequencias`**: `{ sequencias; aberta: Sequencia | null; celularNoEditor: boolean; agora; caminho; caminhoDoTemplate }`.
- `PageHeader`: título "Sequências"; descrição "Recall, reativação e follow-up: mensagens espaçadas que param sozinhas quando o paciente responde, agenda ou pede para sair."; ação "Nova sequência" desabilitada.
- Lista à esquerda (`lg:[18rem_1fr]`): nome, tipo, gatilho, badge e "12 em andamento".

**`EditorDeSequencia`:**
- **Cabeçalho:** nome, badge e agente. Ação da tela: "Ativar sequência" (`marca`, a única da tela) ou "Pausar" (`secundario`), desabilitada no protótipo. Se não `podeAtivar`, o `title` diz por quê.
- **Bloco "Quando começa":** tipo e `descreverGatilho`.
- **Bloco "Quando para":** três itens fixos com ícone, "responde", "agenda" e "pede para sair", e a regra de exclusividade em uma linha: "Um paciente fica em uma sequência por vez."
- **Passos:** trilho vertical com marcos de dia:
  - "Dia 0: entra na sequência";
  - cada passo como cartão numerado (a sequência é ordem de verdade), com "Dia 3", "espera 3 dias", o uso do template (link para `caminhoDoTemplate?t=`), a categoria, o badge e a primeira linha do corpo;
  - passo bloqueado: caixa `warning` com "Este passo não envia até o template ser aprovado.";
  - fim: "Concluída sem resposta";
  - "Adicionar passo" tracejado e desabilitado.
- **Inscritos:**
  - contadores das 5 situações em linha;
  - `Table` com Paciente, Passo ("2 de 3"), Situação (badge), Entrou (relativo) e Último envio;
  - vazio: "Ninguém entrou ainda. O gatilho roda uma vez por dia."

**Fixture:** 3 sequências:
- Reativação 180 dias: ativa, 3 passos aprovados, cerca de 10 inscritos com as 5 situações;
- Recall semestral: rascunho, 2 passos, o segundo com o template rejeitado;
- Follow-up pós-consulta: pausada, 1 passo em análise.

- [x] **Passo 6: testes de renderização.** As asserções:
  - o passo bloqueado mostra o aviso;
  - "Dia 10" aparece no segundo passo;
  - a tabela de inscritos mostra "Agendou";
  - o `title` de "Ativar sequência" explica o bloqueio.
- [x] **Passo 7:** rode os testes, `tsc` e as capturas. Critique e corrija.
- [x] **Passo 8: commit.** `feat(sequences): protótipo do editor de passos com gatilho e motivo de parada`

---

### Tarefa 12: Plano e cobrança

Carregue `frontend-design`.

**Arquivos:**
- Criar: `lib/billing/plan-limits.ts`, `lib/billing/consumo.ts` e `lib/billing/billing.test.ts`
- Criar: `components/patterns/medidor-de-uso.tsx` (+ `medidor-de-uso.test.tsx`)
- Criar em `components/billing/`: `tipos.ts`, `faturas.tsx`, `tela-de-cobranca.tsx` e `cobranca.test.tsx`
- Criar: `_fixtures/cobranca.ts`
- Reescrever: `telas/cobranca/page.tsx`

**Interfaces:**
```ts
// lib/billing/plan-limits.ts: a contagem por AttendanceSession entra aqui na fase 7
export const LIMITE_DE_ATENDIMENTOS: Record<ClinicPlan, number> // 150, 500, 5000
// lib/billing/consumo.ts
export function projetarConsumo(p: { usados: number; inicio: string; fim: string; agora: string }): number | null
// components/patterns/medidor-de-uso.tsx
export type NivelDeUso = "folga" | "atencao" | "no-limite"
export const LIMIAR_DE_ATENCAO = 0.8
export function nivelDeUso(usado: number, limite: number | null): NivelDeUso
export function MedidorDeUso(p: { titulo: string; usado: number; limite: number | null; unidade: [string, string]; explicacao: string; projecao?: string; ilimitado?: string }): JSX.Element
// components/billing/tipos.ts
export type StatusDaFatura = "paga" | "em_aberto" | "vencida"
export type Fatura = { id: string; referencia: string; vencimento: string; valorCentavos: number; status: StatusDaFatura }
export type ResumoDaCobranca = {
  plano: ClinicPlan; valorMensalCentavos: number; ciclo: { inicio: string; fim: string }
  atendimentosUsados: number; agentesCriados: number
  proximaCobranca: { em: string; valorCentavos: number }
  formaDePagamento: { tipo: "pix" | "boleto" | "cartao"; detalhe: string }
  faturas: Fatura[]
}
export const ROTULO_DA_FATURA / TOM_DA_FATURA // Paga success, Em aberto info, Vencida danger
```

- [x] **Passo 1: teste** (`lib/billing/billing.test.ts`)

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { formatarNumero } from "@/lib/formatters/numero"
import { LIMITE_DE_ATENDIMENTOS } from "./plan-limits"
import { projetarConsumo } from "./consumo"

describe("limites de atendimento", () => {
  it("são os da spec", () => {
    expect(LIMITE_DE_ATENDIMENTOS).toEqual({ starter: 150, pro: 500, healthtech: 5000 })
  })

  it("batem com o que a landing promete", () => {
    // Se um lado mudar sozinho, a clínica compra um número e o painel mostra outro.
    const landing = readFileSync("components/pricing.tsx", "utf8")
    for (const n of Object.values(LIMITE_DE_ATENDIMENTOS)) {
      expect(landing).toContain(`Até ${formatarNumero(n)} atendimentos/mês`)
    }
  })
})

describe("projeção do ciclo", () => {
  const ciclo = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }

  it("projeta linearmente pelo ritmo até agora", () => {
    expect(projetarConsumo({ ...ciclo, usados: 300, agora: "2026-09-16T00:00:00-03:00" })).toBe(600)
  })

  it("no primeiro dia o ritmo é ruído: não projeta", () => {
    expect(projetarConsumo({ ...ciclo, usados: 12, agora: "2026-09-01T20:00:00-03:00" })).toBeNull()
  })

  it("ciclo encerrado projeta o que foi usado", () => {
    expect(projetarConsumo({ ...ciclo, usados: 480, agora: "2026-10-02T00:00:00-03:00" })).toBe(480)
  })

  it("ciclo sem duração é erro", () => {
    expect(() => projetarConsumo({ usados: 1, inicio: ciclo.inicio, fim: ciclo.inicio, agora: ciclo.inicio })).toThrow(RangeError)
  })
})
```

`medidor-de-uso.test.tsx`:
- `nivelDeUso(399, 500)` é "folga", `(400, 500)` é "atencao", `(500, 500)` e `(620, 500)` são "no-limite", e `(9, null)` é "folga";
- a renderização tem `role="meter"` com `aria-valuenow` e `aria-valuemax`;
- ilimitado não renderiza barra e mostra o texto `ilimitado`.

- [x] **Passos 2 a 4:** falha, implementação, passa.

- [x] **Passo 5: a tela.**

**`TelaDeCobranca`**: `{ resumo: ResumoDaCobranca; agora }`.
- `PageHeader`: título "Plano e cobrança", badge com o nome do plano e descrição "Quanto do plano você já usou neste ciclo, e o que vem na próxima cobrança."

Dois `MedidorDeUso` lado a lado. Os dois limites são o centro da tela e as regras ficam escritas, nunca em tooltip:
- **Atendimentos no ciclo:** `usado/limite` de `LIMITE_DE_ATENDIMENTOS`.
  - Explicação: "Um atendimento fecha quando a IA envia 5 respostas ou o paciente fica 20 minutos sem escrever."
  - Projeção: "No ritmo atual, fecha o ciclo com cerca de 441."
  - Rodapé: "Ao chegar no limite, a IA para de responder e a equipe é avisada; as conversas continuam com vocês."
- **Agentes:** `agentesCriados/LIMITE_DE_AGENTES[plano]`.
  - Explicação: "Cada agente atende uma especialidade com o próprio número."
  - No HealthTech: "Ilimitado no plano HealthTech".

`Cartao` "Seu plano": valor mensal, os dois limites e "Mudança de plano e cancelamento são feitos com a equipe Nextech." com o link "Falar com a equipe" (desabilitado).

`Cartao` "Próxima cobrança": data, valor e forma de pagamento (Pix, boleto ou cartão final 4242).

`Cartao` "Faturas": `Table` com Referência ("set 2026"), Vencimento, Valor, Situação (badge) e "Ver fatura" desabilitado.

**Fixture:** o valor e as faturas são fictícios (comentário no arquivo).
- plano Pro, ciclo de 01/09 a 01/10;
- 412 atendimentos, que dá o nível de atenção;
- 2 agentes;
- 4 faturas, uma vencida.

- [x] **Passo 6: testes de renderização.** As asserções:
  - "412" e "500" aparecem;
  - a explicação do atendimento está no HTML, e não num atributo `title`;
  - a fatura vencida mostra "Vencida".
- [x] **Passo 7:** rode os testes, `tsc` e as capturas. Critique e corrija.
- [x] **Passo 8: commit.** `feat(billing): protótipo de consumo com os dois limites do plano`

---

### Tarefa 13: Equipe e acessos

Carregue `frontend-design`.

**Arquivos:**
- Criar em `components/team/`: `tipos.ts`, `capacidades.ts` (+ teste), `convites.ts` (+ teste), `tela-de-equipe.tsx` e `equipe.test.tsx`
- Criar: `_fixtures/equipe.ts`
- Reescrever: `telas/equipe/page.tsx`

**Interfaces:**
```ts
export type MembroDaEquipe = { id: string; nome: string; email: string; papel: ClinicRole; profissional: string | null; ultimoAcesso: string | null; voce: boolean }
export type Convite = { id: string; email: string; papel: ClinicRole; enviadoEm: string; expiraEm: string }
export type AlteracaoDeAcesso = { id: string; em: string; texto: string }
// capacidades.ts: proposta de matriz (team-access-v1 deixa em aberto campo a campo)
export type Alcance = "tudo" | "proprios" | "nada"
export type Capacidade = { id: string; rotulo: string; tela?: string; alcance: Record<ClinicRole, Alcance> }
export const CAPACIDADES: readonly Capacidade[]
// convites.ts
export function situacaoDoConvite(c: Pick<Convite, "expiraEm">, agora: string): { expirado: boolean; texto: string } // "expira em 5 dias" / "expirou há 2 dias"
```

`CAPACIDADES`, fiel ao código de hoje (o editor de agente é só owner; staff vê a lista):

| id | rótulo | tela | owner | staff | professional |
|---|---|---|---|---|---|
| conversas | Ver e responder conversas | `/dashboard/conversations` | tudo | tudo | nada |
| agenda | Ver a agenda | `/dashboard/schedule` | tudo | tudo | proprios |
| pacientes | Ver pacientes | `/dashboard/patients` | tudo | tudo | proprios |
| automacao | Ver agentes, sequências e templates | `/dashboard/agents` | tudo | tudo | nada |
| editar-agentes | Configurar e publicar agentes | | tudo | nada | nada |
| perfil | Editar o perfil e o dado regulatório | `/dashboard/settings` | tudo | nada | nada |
| equipe | Convidar pessoas e mudar acessos | `/dashboard/settings/team` | tudo | nada | nada |
| cobranca | Ver plano e cobrança | `/dashboard/billing` | tudo | nada | nada |

- [x] **Passo 1: testes**

```ts
// components/team/capacidades.test.ts
import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav"
import { CAPACIDADES } from "./capacidades"

describe("matriz de capacidades", () => {
  it("quem pode usar a tela é exatamente quem a vê no menu", () => {
    // Matriz e menu divergindo faria a tela prometer um acesso que o menu esconde.
    const itens = DASHBOARD_NAV.flatMap((g) => g.items)
    for (const c of CAPACIDADES.filter((c) => c.tela)) {
      const item = itens.find((i) => i.href === c.tela)!
      expect(item, c.tela).toBeDefined()
      const podem = (["owner", "staff", "professional"] as const).filter((r) => c.alcance[r] !== "nada")
      expect(podem, c.id).toEqual(item.roles ?? ["owner", "staff", "professional"])
    }
  })

  it("owner pode tudo", () => {
    expect(CAPACIDADES.every((c) => c.alcance.owner === "tudo")).toBe(true)
  })

  it("profissional só alcança o que é dele", () => {
    for (const c of CAPACIDADES) expect(["proprios", "nada"]).toContain(c.alcance.professional)
  })
})
```

```ts
// components/team/convites.test.ts
import { describe, expect, it } from "vitest"
import { situacaoDoConvite } from "./convites"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("convite", () => {
  it("válido diz quanto falta", () => {
    expect(situacaoDoConvite({ expiraEm: "2026-10-03T14:32:00-03:00" }, AGORA)).toEqual({ expirado: false, texto: "expira em 5 dias" })
  })
  it("vencido diz há quanto tempo", () => {
    expect(situacaoDoConvite({ expiraEm: "2026-09-26T10:00:00-03:00" }, AGORA)).toEqual({ expirado: true, texto: "expirou há 2 dias" })
  })
  it("vence no instante exato", () => {
    expect(situacaoDoConvite({ expiraEm: AGORA }, AGORA).expirado).toBe(true)
  })
})
```

- [x] **Passos 2 a 4:** falha, implementação (`formatarDuracao` para os textos), passa.

- [x] **Passo 5: a tela.**

**`TelaDeEquipe`**: `{ membros; convites; alteracoes; agora }`.
- `PageHeader`: título "Equipe e acessos"; descrição "Quem entra no painel da clínica e o que cada pessoa pode fazer."; ação "Convidar pessoa" desabilitada.
- **`Cartao` "Pessoas":** `Table` com:
  - Pessoa: avatar, nome, e-mail e a marca "Você";
  - Papel: `ROTULO_DO_PAPEL` de `lib/navigation/landing`;
  - Vínculo: o profissional do cadastro, ou "Não se aplica";
  - Último acesso (relativo, ou "Ainda não entrou");
  - "Mudar acesso" desabilitado. Para "Você", sem ação.
- **`Cartao` "Convites pendentes":** e-mail, papel e situação.
  - Expirado: badge warning "Expirado" e "Reenviar" desabilitado.
  - Vazio: "Nenhum convite esperando resposta."
- **`Cartao` "O que cada papel pode fazer":** tabela com as capacidades nas linhas e os 3 papéis nas colunas, cada cabeçalho com uma linha de descrição ("acesso total", "recepção", "a própria agenda"). Célula:
  - `Check` com sr-only "Pode";
  - "Só os próprios";
  - `Minus` com sr-only "Não pode".

  Nota: "Proposta da matriz; a versão final sai da spec de equipe."
- **`Cartao` "Alterações de acesso":** `LinhaDoTempo`.

**Fixture:**
- 5 pessoas: Ana Paula (owner, você), Carla e Diego (staff), Dra. Ana Lima e Dr. Bruno Reis (professional, vinculados);
- 2 convites, um vencido;
- 4 alterações.

- [x] **Passo 6: testes de renderização.** As asserções:
  - toda célula da matriz tem texto acessível ("Pode", "Só os próprios" ou "Não pode");
  - "Você" aparece uma vez;
  - o convite vencido mostra "Expirado".
- [x] **Passo 7:** rode os testes, `tsc` e as capturas. Critique e corrija.
- [x] **Passo 8: commit.** `feat(team): protótipo de equipe com matriz de capacidades e convites`

---

### Tarefa 14: Galeria, limpeza, verificação final e docs

**Arquivos:**
- Modificar: `app/(admin)/admin/design-system/page.tsx`. Cada tela ganha uma linha "O que mostra" (por exemplo, Conversas: "fila por prioridade, janela de 24h, passar para humano e notas internas") além de "Entra no ar com".
- Apagar: `components/patterns/workspace-page.tsx` e `components/patterns/search-input.tsx`. Confirme com `grep -rn "workspace-page\|search-input" app components` que não sobrou uso.
- Modificar: este plano ("Status da execução"), `docs/roadmap.md`, `docs/status.md` e a memória `nextech-sistema-de-design.md`.

- [x] **Passo 1: suíte inteira.** `npx vitest run`, `npx tsc --noEmit` e `npm run build`. Esperado: tudo passa. Se o build falhar por variável de ambiente, registre em vez de contornar.
- [x] **Passo 2: passada visual.** As 8 rotas de protótipo (as 7 telas e a ficha do paciente) nos 3 tamanhos, mais `/dashboard` e `/dashboard/settings`, para ver o menu novo. Rode também `--cores /`, que precisa mostrar `--accent no escopo -> lab(72.8575% -47.9172 13.5998)`.
- [x] **Passo 3: Minha conta.** Se sobrar tempo, pergunte ao Jhones (opções selecionáveis) antes de começar.
- [x] **Passo 4: docs.**
  - **Plano:** status "✅ concluído", com os números de testes e a tabela de ajustes da execução.
  - **Roadmap:** seção "Redesign do painel, parte 2" com o que entrou, as decisões do menu e o que fica. Fica de fora:
    - Minha conta;
    - protótipo de Integrações;
    - o modelo de dados da seção 9;
    - mover a landing.
  - **Status:** a linha do redesign passa a "✅ protótipos completos; telas reais chegam com cada fase", com o número de testes atualizado.
  - **Memória:** padrão de protótipo (componente de domínio em `components/<domínio>` + `_fixtures`, com a guarda em `tests/architecture/prototipos.test.ts`) e "Gestão" no lugar de "Configuração".
- [x] **Passo 5: commit.** `docs: fecha a parte 2 do redesign no plano, roadmap e status`

---

## Próximo plano (parte 3) — telas que faltam

Tudo com o padrão da parte 2:
- componente de domínio em `components/<domínio>/`;
- dado fictício em `_fixtures/`, com `AGORA`;
- protótipo só em `/admin/design-system/telas/*`, com `AvisoDePrototipo`;
- regra pura com teste em `lib/<domínio>/`.

A ordem e o recorte são decisão do Jhones: apresente como opções selecionáveis, com a recomendada primeiro, antes de escrever o plano.

**Painel da clínica**
1. **Integrações** (`/dashboard/integrations`, só owner, já no menu como "em breve"):
   - Google Calendar da clínica (OAuth por clínica, fase 5);
   - CRM (Pipedrive, Kommo, RD Station, Doctoralia, fase 6);
   - estado do WhatsApp de cada agente, com `ACCOUNT_OFFBOARDED` e reconexão.

   A conexão do WhatsApp continua no editor do agente; aqui só aparece o estado.
2. **Minha conta**: nome, e-mail, aparência e troca de senha. A senha depende do Resend: no protótipo, desabilitada e explicada.
3. **Visão geral completa**, como protótipo. A rota real continua honesta, sem número inventado. Mostra:
   - conversas aguardando;
   - agendamentos do dia;
   - funil (`dashboard-overview-v1`);
   - saúde dos agentes;
   - alertas (urgência, janela fechando, template rejeitado, limite do plano);
   - atividade recente.
4. **Agentes com operação** (prompt mestre, seção 6): saúde, última atividade, volume processado, histórico de alterações e teste seguro antes de publicar. A tela real existe; o protótipo mostra o que chega com a fase 3b.

**Painel interno** (itens "em breve" de `ADMIN_NAV`)
5. **Consumo**: atendimentos por clínica contra o limite do plano, só agregado.
6. **Conexões**: estado do WhatsApp por clínica e template rejeitado.
7. **Saúde**: falhas de webhook, erros do OpenRouter e cron que não rodou.
8. **Conversas de suporte**: justificativa obrigatória antes de abrir (bloqueio, não aviso) e registro em `admin_audit_log` (desenho de navegação, seção 3).
9. **Auditoria**: a trilha consultável.

**Estados transversais** (prompt mestre, seção 7)
10. `loading.tsx` com Skeleton, `error.tsx` com recuperação e permissão negada, nas rotas reais do painel. Isto não é protótipo: vale para as telas que já existem.

**Antes de começar:** o `next dev` da sessão anterior ficou quebrado para rotas dinâmicas (500 "Jest worker"). Reinicie o servidor.
