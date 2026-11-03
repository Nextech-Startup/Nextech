# CRM próprio, parte 1: a tela com dado de exemplo — plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** o funil comercial da clínica em `/dashboard/crm`, completo e navegável na conta de demonstração, com ~17 oportunidades de exemplo, sem backend.

**Arquitetura:** as regras puras (transição de etapa, números do funil, filtros, busca) ficam em `lib/crm/` e são as mesmas que a parte 2 vai usar sobre o banco. A tela é um componente de domínio em `components/crm/`. O estado das oportunidades mora num `useReducer` no navegador, que aplica a mesma regra de movimento da lib, e por isso mover no protótipo não grava nada. A página lê `isDemo` e responde `notFound()` fora da demonstração, como toda tela "em breve". A busca vai por POST, numa server action que lê `isDemo`.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind com os tokens do painel, `@dnd-kit/core` 6.3.1 (dependência nova), Vitest 5 em ambiente `node` com `renderToStaticMarkup` para os componentes.

**Spec:** `docs/specs/crm-v1.md` (parte 1 e as seções 1, 2, 5 e 6). Leia a spec antes do plano.

## Restrições globais

- Responder e comentar em pt-BR.
- Etapas fixas: `novo`, `qualificado`, `agendado`, `compareceu` (abertas), `ganho`, `perdido` (encerram).
- Motivos de perda, lista fixa e nunca texto livre: preço; sem horário que sirva; escolheu outra clínica; parou de responder; não era paciente (engano, propaganda); outro.
- Não existe "reabrir" nesta v1: oportunidade encerrada não volta ao funil.
- Ganho pede procedimento e valor fechado; Perdido pede o motivo.
- "Parado há N dias" fica em tom de alerta **a partir de 3 dias** sem atividade (`DIAS_PARA_ALERTA = 3`, com `>=`).
- O verde `brand` só aparece em Ganho. No resto, os tokens `surface`, `ink` e `hairline`, nunca `[var(--x)]` (`tests/architecture/tokens.test.ts`).
- Datas só por `lib/formatters`. Nada de `new Date()` em componente: o "agora" chega como prop.
- A busca nunca lê `?q=`. O termo vai no corpo de um POST (server action) e nunca para a URL nem para o log.
- O período fica na URL (`?periodo=7|30|90`, padrão 30), e o responsável também (`?responsavel=meus|sem`, padrão todos). As encerradas usam `?vista=encerradas&resultado=ganho|perdido&motivo=<motivo>`.
- Celular (390 px): a faixa vira o seletor de etapa e mostra uma coluna por vez. Nada de rolagem horizontal.
- Fixtures: só em `app/_fixtures/`, importadas só por página, action do painel e teste (`tests/architecture/prototipos.test.ts`). Componente e lib nunca importam de `app/`.
- Commits vão na `staging`. Nunca na `main`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/crm/tipos.ts` | Etapas, motivos, rótulos, `Oportunidade`, `EventoDaOportunidade` e guardas de tipo |
| `lib/crm/movimento.ts` | `validarMovimento`, `aplicarMovimento`, `etapasDeDestino`, `lerValorEmCentavos` e `mensagemDoMovimento` |
| `lib/crm/metricas.ts` | `faixaDoFunil` e `resumoDoPeriodo` (as definições da seção 5 da spec) |
| `lib/crm/cartao.ts` | `nomeDoPaciente`, `atividadeDoCartao`, `ultimaMudancaAutomatica` e `tituloDoEvento` |
| `lib/crm/filtros.ts` | Leitura dos parâmetros da URL, `hrefDoCrm`, filtro por responsável e encerradas |
| `lib/crm/busca.ts` | `idsQueCasam` (nome ou telefone) |
| `app/_fixtures/crm.ts` | `OPORTUNIDADES` e `PROCEDIMENTOS_DO_CRM` de exemplo |
| `components/crm/estado.ts` | Redutor do quadro no navegador |
| `components/crm/cartao-da-oportunidade.tsx` | Cartão |
| `components/crm/faixa-do-funil.tsx` | A faixa (cabeçalho no desktop, seletor no celular) |
| `components/crm/resumo-do-periodo.tsx` | Os três números do período |
| `components/crm/painel-da-oportunidade.tsx` | Painel lateral |
| `components/crm/lista-de-encerradas.tsx` | Lista das encerradas |
| `components/crm/mover-para.tsx` | Menu "Mover para…" |
| `components/crm/pedido-de-fechamento.tsx` | Diálogo de Ganho e Perdido |
| `components/crm/busca-do-crm.tsx` | Busca por POST |
| `components/crm/quadro.tsx` | Colunas com `@dnd-kit` |
| `components/crm/tela-do-crm.tsx` | Composição (cliente) |
| `lib/navigation/dashboard-nav.ts` | Item "CRM" |
| `app/(dashboard)/dashboard/crm/page.tsx`, `acoes.ts`, `loading.tsx` | Rota e busca |

---

### Tarefa 1: Tipos e regra de movimento

**Arquivos:**
- Criar: `lib/crm/tipos.ts`, `lib/crm/movimento.ts`
- Teste: `lib/crm/movimento.test.ts`

**Interfaces:**
- Produz: os tipos `Etapa`, `EtapaAberta`, `MotivoDePerda`, `Referencia`, `EventoDaOportunidade`, `Oportunidade`, `PedidoDeMovimento` e `ResultadoDoMovimento`; as constantes `ETAPAS`, `ETAPAS_ABERTAS`, `MOTIVOS_DE_PERDA`, `ROTULO_DA_ETAPA` e `ROTULO_DO_MOTIVO`; as funções `ehEtapa`, `ehEtapaAberta`, `ehMotivoDePerda`, `validarMovimento(op, pedido)`, `aplicarMovimento(op, pedido, em, autor)`, `etapasDeDestino(op)`, `lerValorEmCentavos(texto)` e `mensagemDoMovimento(resultado)`.

- [x] **Passo 1: escrever `lib/crm/tipos.ts`** (só tipos e constantes, sem teste próprio)

```ts
/**
 * O funil comercial da clínica (spec crm-v1). Os tipos moram em lib/, e não
 * em components/, porque a parte 2 monta as oportunidades a partir do banco
 * em lib/crm, e lib não importa de components.
 */

export const ETAPAS = ["novo", "qualificado", "agendado", "compareceu", "ganho", "perdido"] as const
export type Etapa = (typeof ETAPAS)[number]

/** As quatro colunas do quadro, na ordem do funil. */
export const ETAPAS_ABERTAS = ["novo", "qualificado", "agendado", "compareceu"] as const
export type EtapaAberta = (typeof ETAPAS_ABERTAS)[number]

export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  agendado: "Agendado",
  compareceu: "Compareceu",
  ganho: "Ganho",
  perdido: "Perdido",
}

/** Lista fixa, nunca texto livre: texto livre levaria dado de paciente para onde não deve. */
export const MOTIVOS_DE_PERDA = [
  "preco",
  "sem_horario",
  "outra_clinica",
  "sem_resposta",
  "nao_era_paciente",
  "outro",
] as const
export type MotivoDePerda = (typeof MOTIVOS_DE_PERDA)[number]

export const ROTULO_DO_MOTIVO: Record<MotivoDePerda, string> = {
  preco: "Preço",
  sem_horario: "Sem horário que sirva",
  outra_clinica: "Escolheu outra clínica",
  sem_resposta: "Parou de responder",
  nao_era_paciente: "Não era paciente (engano, propaganda)",
  outro: "Outro",
}

export function ehEtapa(v: unknown): v is Etapa {
  return typeof v === "string" && (ETAPAS as readonly string[]).includes(v)
}

export function ehEtapaAberta(v: unknown): v is EtapaAberta {
  return typeof v === "string" && (ETAPAS_ABERTAS as readonly string[]).includes(v)
}

export function ehMotivoDePerda(v: unknown): v is MotivoDePerda {
  return typeof v === "string" && (MOTIVOS_DE_PERDA as readonly string[]).includes(v)
}

/** Algo que a tela mostra pelo nome: procedimento, membro da equipe. */
export type Referencia = { id: string; nome: string }

export type EventoDaOportunidade = {
  id: string
  /** Nulo na abertura. */
  de: Etapa | null
  para: Etapa
  em: string
  /** Nulo quando foi o sistema (primeira mensagem, qualificação da IA). */
  autor: Referencia | null
}

export type Oportunidade = {
  id: string
  paciente: { id: string; nome: string | null; telefone: string; optOut: boolean }
  /** A conversa que abriu a oportunidade. */
  conversaId: string | null
  etapa: Etapa
  etapaDesde: string
  /** Muda com mensagem do paciente e com mudança de etapa. */
  ultimaAtividade: string
  abertaEm: string
  /** Preenchida só em Ganho e Perdido. */
  encerradaEm: string | null
  procedimento: Referencia | null
  valorCentavos: number | null
  responsavel: Referencia | null
  proximaAcao: string | null
  /** Preenchido só em Perdido. */
  motivoDePerda: MotivoDePerda | null
  /** Na parte 2, decifrada no servidor; nunca em log nem em URL. */
  nota: string | null
  urgente: boolean
  /** Do mais antigo para o mais novo; o primeiro é a abertura. */
  eventos: EventoDaOportunidade[]
}
```

- [x] **Passo 2: escrever o teste que falha**, em `lib/crm/movimento.test.ts`

```ts
import { describe, expect, it } from "vitest"
import {
  aplicarMovimento,
  etapasDeDestino,
  lerValorEmCentavos,
  mensagemDoMovimento,
  validarMovimento,
  type PedidoDeMovimento,
} from "./movimento"
import type { Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const CARLA = { id: "m-carla", nome: "Carla Mendes" }
const CLAREAMENTO = { id: "proc-clareamento", nome: "Clareamento dental" }

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Paciente Um", telefone: "+5581900000001", optOut: false },
    conversaId: "c-1",
    etapa: "novo",
    etapaDesde: "2026-09-27T10:00:00-03:00",
    ultimaAtividade: "2026-09-27T10:00:00-03:00",
    abertaEm: "2026-09-27T10:00:00-03:00",
    encerradaEm: null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: null,
    nota: null,
    urgente: false,
    eventos: [{ id: "op-1-e1", de: null, para: "novo", em: "2026-09-27T10:00:00-03:00", autor: null }],
    ...p,
  }
}

const pedido = (p: Partial<PedidoDeMovimento> = {}): PedidoDeMovimento => ({
  oportunidadeId: "op-1",
  de: "novo",
  para: "agendado",
  ...p,
})

describe("validarMovimento", () => {
  it("move para qualquer etapa aberta, inclusive para trás", () => {
    expect(validarMovimento(op(), pedido({ para: "compareceu" }))).toEqual({ status: "ok" })
    expect(validarMovimento(op({ etapa: "agendado" }), pedido({ de: "agendado", para: "novo" }))).toEqual({ status: "ok" })
  })

  it("sem oportunidade, nao-encontrada", () => {
    expect(validarMovimento(undefined, pedido())).toEqual({ status: "nao-encontrada" })
  })

  it("a etapa que a tela viu já mudou: sem-mudanca", () => {
    expect(validarMovimento(op({ etapa: "qualificado" }), pedido({ de: "novo" }))).toEqual({ status: "sem-mudanca" })
  })

  it("para a mesma etapa: sem-mudanca", () => {
    expect(validarMovimento(op(), pedido({ para: "novo" }))).toEqual({ status: "sem-mudanca" })
  })

  it("encerrada não reabre", () => {
    const ganha = op({ etapa: "ganho", encerradaEm: AGORA })
    expect(validarMovimento(ganha, pedido({ de: "ganho", para: "novo" }))).toEqual({
      status: "invalido",
      erro: "Oportunidade encerrada não volta ao funil.",
    })
  })

  it("Ganho exige procedimento e valor inteiro positivo", () => {
    expect(validarMovimento(op(), pedido({ para: "ganho", valorCentavos: 10000 }))).toEqual({
      status: "invalido",
      erro: "Escolha o procedimento fechado.",
    })
    for (const valorCentavos of [null, 0, -1, 10.5, 100_000_001]) {
      expect(validarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos }))).toEqual({
        status: "invalido",
        erro: "Informe o valor fechado.",
      })
    }
    expect(validarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos: 120000 }))).toEqual({ status: "ok" })
  })

  it("Perdido exige um motivo da lista", () => {
    expect(validarMovimento(op(), pedido({ para: "perdido" }))).toEqual({ status: "invalido", erro: "Escolha o motivo da perda." })
    expect(
      validarMovimento(op(), pedido({ para: "perdido", motivo: "caro demais" as never })),
    ).toEqual({ status: "invalido", erro: "Escolha o motivo da perda." })
    expect(validarMovimento(op(), pedido({ para: "perdido", motivo: "preco" }))).toEqual({ status: "ok" })
  })
})

describe("aplicarMovimento", () => {
  it("muda a etapa, as datas e grava o evento com o autor", () => {
    const movida = aplicarMovimento(op(), pedido({ para: "agendado" }), AGORA, CARLA)
    expect(movida).toMatchObject({ etapa: "agendado", etapaDesde: AGORA, ultimaAtividade: AGORA, encerradaEm: null })
    expect(movida.eventos.at(-1)).toEqual({ id: "op-1-e2", de: "novo", para: "agendado", em: AGORA, autor: CARLA })
  })

  it("Ganho encerra e grava procedimento e valor", () => {
    const ganha = aplicarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos: 120000 }), AGORA, CARLA)
    expect(ganha).toMatchObject({ etapa: "ganho", encerradaEm: AGORA, procedimento: CLAREAMENTO, valorCentavos: 120000 })
  })

  it("Perdido encerra e grava o motivo, sem mexer em procedimento e valor", () => {
    const antes = op({ procedimento: CLAREAMENTO, valorCentavos: 50000 })
    const perdida = aplicarMovimento(antes, pedido({ para: "perdido", motivo: "preco" }), AGORA, null)
    expect(perdida).toMatchObject({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco", procedimento: CLAREAMENTO, valorCentavos: 50000 })
  })

  it("recusa aplicar o que a validação recusa", () => {
    expect(() => aplicarMovimento(op(), pedido({ para: "perdido" }), AGORA, CARLA)).toThrow("Movimento inválido")
  })

  it("não altera a oportunidade recebida", () => {
    const antes = op()
    aplicarMovimento(antes, pedido(), AGORA, CARLA)
    expect(antes.etapa).toBe("novo")
    expect(antes.eventos).toHaveLength(1)
  })
})

describe("etapasDeDestino", () => {
  it("aberta: todas as outras etapas, na ordem do funil", () => {
    expect(etapasDeDestino(op({ etapa: "qualificado" }))).toEqual(["novo", "agendado", "compareceu", "ganho", "perdido"])
  })
  it("encerrada: nenhuma", () => {
    expect(etapasDeDestino(op({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco" }))).toEqual([])
  })
})

describe("lerValorEmCentavos", () => {
  it.each([
    ["1200", 120000],
    ["1.200", 120000],
    ["1.200,50", 120050],
    ["R$ 1.200,5", 120050],
    ["99,9", 9990],
    ["0", 0],
  ])("%s → %d", (texto, centavos) => {
    expect(lerValorEmCentavos(texto)).toBe(centavos)
  })
  it.each(["", "abc", "1,234", "12.34", "1.2345,00", "-10", "1,2,3"])("%s → null", (texto) => {
    expect(lerValorEmCentavos(texto)).toBeNull()
  })
})

describe("mensagemDoMovimento", () => {
  it("cada recusa tem a frase da tela; ok não tem", () => {
    expect(mensagemDoMovimento({ status: "ok" })).toBeNull()
    expect(mensagemDoMovimento({ status: "sem-mudanca" })).toBe("Este cartão mudou de etapa antes. O quadro foi atualizado.")
    expect(mensagemDoMovimento({ status: "nao-encontrada" })).toBe("Oportunidade não encontrada.")
    expect(mensagemDoMovimento({ status: "invalido", erro: "Escolha o motivo da perda." })).toBe("Escolha o motivo da perda.")
  })
})
```

- [x] **Passo 3: rodar e ver falhar**

Rode: `npx vitest run lib/crm/movimento.test.ts`
Esperado: FALHA, com "Failed to resolve import ./movimento".

- [x] **Passo 4: implementar `lib/crm/movimento.ts`**

```ts
import {
  ETAPAS,
  ehEtapaAberta,
  ehMotivoDePerda,
  type Etapa,
  type MotivoDePerda,
  type Oportunidade,
  type Referencia,
} from "./tipos"

/**
 * A mudança manual de etapa (spec crm-v1, "Regras de movimento"). É a mesma
 * regra na tela de protótipo (parte 1) e, na parte 2, a pré-checagem antes
 * da RPC `move_opportunity`, que repete a regra no banco.
 */
export type PedidoDeMovimento = {
  oportunidadeId: string
  /** A etapa que a tela viu. Se o cartão mudou no caminho, nada muda. */
  de: Etapa
  para: Etapa
  procedimento?: Referencia | null
  valorCentavos?: number | null
  motivo?: MotivoDePerda | null
}

export type ResultadoDoMovimento =
  | { status: "ok" }
  | { status: "sem-mudanca" }
  | { status: "nao-encontrada" }
  | { status: "invalido"; erro: string }

/** R$ 1 milhão: acima disso é erro de digitação, não tratamento de clínica. */
export const VALOR_MAXIMO_CENTAVOS = 100_000_000

const invalido = (erro: string): ResultadoDoMovimento => ({ status: "invalido", erro })

export function validarMovimento(op: Oportunidade | undefined, p: PedidoDeMovimento): ResultadoDoMovimento {
  if (!op) return { status: "nao-encontrada" }
  if (op.etapa !== p.de || p.para === p.de) return { status: "sem-mudanca" }
  if (!ehEtapaAberta(op.etapa)) return invalido("Oportunidade encerrada não volta ao funil.")
  if (p.para === "ganho") {
    if (!p.procedimento) return invalido("Escolha o procedimento fechado.")
    const v = p.valorCentavos
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || v > VALOR_MAXIMO_CENTAVOS) {
      return invalido("Informe o valor fechado.")
    }
  }
  if (p.para === "perdido" && !ehMotivoDePerda(p.motivo)) return invalido("Escolha o motivo da perda.")
  return { status: "ok" }
}

/**
 * A oportunidade depois do movimento, com o evento no fim da trilha. Só
 * aplica o que `validarMovimento` aceita: chamar sem validar é um bug, e o
 * erro aparece aqui em vez de virar um cartão incoerente.
 */
export function aplicarMovimento(
  op: Oportunidade,
  p: PedidoDeMovimento,
  em: string,
  autor: Referencia | null,
): Oportunidade {
  if (validarMovimento(op, p).status !== "ok") throw new Error("Movimento inválido")
  const ganho = p.para === "ganho"
  return {
    ...op,
    etapa: p.para,
    etapaDesde: em,
    ultimaAtividade: em,
    encerradaEm: ehEtapaAberta(p.para) ? null : em,
    procedimento: ganho ? (p.procedimento ?? null) : op.procedimento,
    valorCentavos: ganho ? (p.valorCentavos ?? null) : op.valorCentavos,
    motivoDePerda: p.para === "perdido" ? (p.motivo ?? null) : null,
    eventos: [
      ...op.eventos,
      { id: `${op.id}-e${op.eventos.length + 1}`, de: op.etapa, para: p.para, em, autor },
    ],
  }
}

/** As opções do "Mover para…": toda etapa menos a atual; nenhuma se encerrou. */
export function etapasDeDestino(op: Oportunidade): Etapa[] {
  if (!ehEtapaAberta(op.etapa)) return []
  return ETAPAS.filter((e) => e !== op.etapa)
}

const VALOR = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/

/** "R$ 1.200,50" → 120050. Formato que não é dinheiro em reais dá null. */
export function lerValorEmCentavos(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "")
  if (!VALOR.test(t)) return null
  const [inteiro, fracao = ""] = t.replace(/\./g, "").split(",")
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"))
}

export function mensagemDoMovimento(r: ResultadoDoMovimento): string | null {
  switch (r.status) {
    case "ok":
      return null
    case "sem-mudanca":
      return "Este cartão mudou de etapa antes. O quadro foi atualizado."
    case "nao-encontrada":
      return "Oportunidade não encontrada."
    case "invalido":
      return r.erro
  }
}
```

- [x] **Passo 5: rodar e ver passar**

Rode: `npx vitest run lib/crm/movimento.test.ts`
Esperado: PASSA.

- [x] **Passo 6: commit**

```bash
git add lib/crm/tipos.ts lib/crm/movimento.ts lib/crm/movimento.test.ts
git commit -m "feat(crm): etapas do funil e a regra de movimento"
```

---

### Tarefa 2: Números do funil, regras do cartão, filtros e busca

**Arquivos:**
- Criar: `lib/crm/metricas.ts`, `lib/crm/cartao.ts`, `lib/crm/filtros.ts`, `lib/crm/busca.ts`
- Teste: `lib/crm/metricas.test.ts`, `lib/crm/cartao.test.ts`, `lib/crm/filtros.test.ts`

**Interfaces:**
- Consome: os tipos da tarefa 1.
- Produz:
  - `PeriodoEmDias = 7 | 30 | 90`, `PERIODOS`;
  - `faixaDoFunil(ops, agora, dias): Faixa`, com `Faixa = { etapas: EtapaDaFaixa[]; ganhas: number; perdidas: number }` e `EtapaDaFaixa = { etapa: EtapaAberta; contagem: number; valorCentavos: number; passagem: number | null }`;
  - `resumoDoPeriodo(ops, agora, dias): ResumoDoCrm`, com `ResumoDoCrm = { valorGanhoCentavos: number; conversao: number | null; diasAteFechar: number | null }`;
  - `DIAS_PARA_ALERTA`, `nomeDoPaciente(op)`, `atividadeDoCartao(op, agora): AtividadeDoCartao`, `ultimaMudancaAutomatica(op)`, `tituloDoEvento(ev)`;
  - `lerPeriodo`, `lerResponsavel`, `lerVista`, `lerFiltroDeEncerradas`, `filtrarPorResponsavel(ops, filtro, euId)`, `filtrarEncerradas(ops, filtro)`, `hrefDoCrm(caminho, p)`, e os tipos `FiltroDeResponsavel`, `Vista`, `FiltroDeEncerradas` e `ParametrosDoCrm`;
  - `idsQueCasam(ops, termo): string[]`.

**Definições (seção 5 da spec), como ficam no código:**
- *No período:* o instante está em `[agora − dias, agora]`.
- *Chegou à etapa X:* a etapa mais avançada da trilha de eventos é X ou além, contando Ganho como além de Compareceu e Perdido como não avanço. Assim, quem foi movido de Novo direto para Agendado conta como quem passou por Qualificado.
- *Contagem e valor da etapa:* o estado de agora (as oportunidades nela), sem período. O valor é a soma de `valorCentavos`, e quem não tem valor conta zero.
- *Passagem de X para a seguinte:* das abertas no período que chegaram a X, a parcela que chegou à seguinte. É `null` sem base e na última coluna.
- *Ganhas e perdidas ao lado da faixa:* encerradas no período.

- [x] **Passo 1: escrever o teste que falha**, em `lib/crm/metricas.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { faixaDoFunil, resumoDoPeriodo } from "./metricas"
import type { Etapa, Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"

/** Oportunidade aberta em `aberta`, que passou pelas etapas `trilha` (a última é a atual). */
function op(id: string, aberta: string, trilha: Etapa[], p: Partial<Oportunidade> = {}): Oportunidade {
  const etapa = trilha.at(-1)!
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome: `Paciente ${id}`, telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa,
    etapaDesde: aberta,
    ultimaAtividade: aberta,
    abertaEm: aberta,
    encerradaEm: final ? (p.encerradaEm ?? aberta) : null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: etapa === "perdido" ? "preco" : null,
    nota: null,
    urgente: false,
    eventos: trilha.map((para, i) => ({ id: `${id}-e${i + 1}`, de: i === 0 ? null : trilha[i - 1], para, em: aberta, autor: null })),
    ...p,
  }
}

describe("faixaDoFunil", () => {
  const ops = [
    op("a", "2026-09-27T10:00:00-03:00", ["novo"], { valorCentavos: 10000 }),
    op("b", "2026-09-26T10:00:00-03:00", ["novo", "qualificado"], { valorCentavos: 20000 }),
    // Pulou Qualificado: conta como quem passou por ele.
    op("c", "2026-09-25T10:00:00-03:00", ["novo", "agendado"], { valorCentavos: 30000 }),
    op("d", "2026-09-22T10:00:00-03:00", ["novo", "qualificado", "agendado", "compareceu", "ganho"], {
      encerradaEm: "2026-09-27T10:00:00-03:00",
      valorCentavos: 50000,
    }),
    // A janela de 7 dias começa em 21/09 às 14:32: tudo aqui acima está dentro dela.
    op("e", "2026-09-22T09:00:00-03:00", ["novo", "perdido"], { encerradaEm: "2026-09-23T10:00:00-03:00" }),
    // Aberta e encerrada fora dos 7 dias, dentro dos 30.
    op("f", "2026-09-05T10:00:00-03:00", ["novo", "qualificado", "ganho"], { encerradaEm: "2026-09-10T10:00:00-03:00" }),
  ]

  it("contagem e valor são o estado de agora, sem período", () => {
    const { etapas } = faixaDoFunil(ops, AGORA, 7)
    expect(etapas.map((e) => [e.etapa, e.contagem, e.valorCentavos])).toEqual([
      ["novo", 1, 10000],
      ["qualificado", 1, 20000],
      ["agendado", 1, 30000],
      ["compareceu", 0, 0],
    ])
  })

  it("passagem pela trilha, das abertas no período", () => {
    // 7 dias: a, b, c, d, e. Chegaram a Novo: 5; a Qualificado ou além: b, c, d = 3.
    // A Qualificado: 3; a Agendado ou além: c, d = 2. A Agendado: 2; a Compareceu: d = 1.
    const { etapas } = faixaDoFunil(ops, AGORA, 7)
    expect(etapas.map((e) => e.passagem)).toEqual([3 / 5, 2 / 3, 1 / 2, null])
  })

  it("ganhas e perdidas encerradas no período", () => {
    expect(faixaDoFunil(ops, AGORA, 7)).toMatchObject({ ganhas: 1, perdidas: 1 })
    expect(faixaDoFunil(ops, AGORA, 30)).toMatchObject({ ganhas: 2, perdidas: 1 })
  })

  it("sem base, passagem nula", () => {
    expect(faixaDoFunil([], AGORA, 7).etapas.map((e) => e.passagem)).toEqual([null, null, null, null])
  })

  it("instante no futuro não está no período", () => {
    const futura = op("z", "2026-09-29T10:00:00-03:00", ["novo"])
    expect(faixaDoFunil([futura], AGORA, 7).etapas[0].passagem).toBeNull()
  })
})

describe("resumoDoPeriodo", () => {
  const ops = [
    op("g1", "2026-09-22T10:00:00-03:00", ["novo", "ganho"], { encerradaEm: "2026-09-24T10:00:00-03:00", valorCentavos: 120000 }),
    op("g2", "2026-09-10T10:00:00-03:00", ["novo", "ganho"], { encerradaEm: "2026-09-25T10:00:00-03:00", valorCentavos: 30000 }),
    op("p1", "2026-09-26T10:00:00-03:00", ["novo", "perdido"], { encerradaEm: "2026-09-27T10:00:00-03:00" }),
    op("a1", "2026-09-27T10:00:00-03:00", ["novo"]),
  ]

  it("valor ganho, conversão e tempo médio até fechar", () => {
    // 7 dias: ganhas no período g1 e g2 (encerradas em 24 e 25). Abertas no período: g1, p1, a1 → 1 ganha de 3.
    // A janela começa em 21/09 às 14:32. Dias até fechar: g1 = 2, g2 = 15 → média 8,5.
    expect(resumoDoPeriodo(ops, AGORA, 7)).toEqual({ valorGanhoCentavos: 150000, conversao: 1 / 3, diasAteFechar: 8.5 })
  })

  it("sem nada no período, conversão e tempo nulos", () => {
    expect(resumoDoPeriodo([], AGORA, 30)).toEqual({ valorGanhoCentavos: 0, conversao: null, diasAteFechar: null })
  })
})
```

- [x] **Passo 2: implementar `lib/crm/metricas.ts`**

```ts
import { ETAPAS_ABERTAS, type Etapa, type EtapaAberta, type Oportunidade } from "./tipos"

/**
 * Os números da tela do CRM (spec crm-v1, "Definições dos números"). Regra
 * pura, a mesma sobre a fixture (parte 1) e sobre o banco (parte 2).
 */

export const PERIODOS = [7, 30, 90] as const
export type PeriodoEmDias = (typeof PERIODOS)[number]

const DIA_MS = 86_400_000

function noPeriodo(instante: string | null, agora: string, dias: number): boolean {
  if (!instante) return false
  const atras = Date.parse(agora) - Date.parse(instante)
  return atras >= 0 && atras <= dias * DIA_MS
}

/** Ganho é além de Compareceu; Perdido não é avanço. */
const ORDEM: Record<Etapa, number> = { novo: 0, qualificado: 1, agendado: 2, compareceu: 3, ganho: 4, perdido: -1 }

const alcance = (o: Oportunidade) => Math.max(...o.eventos.map((e) => ORDEM[e.para]), ORDEM[o.etapa])
const chegou = (o: Oportunidade, etapa: Etapa) => alcance(o) >= ORDEM[etapa]
const soma = (ops: Oportunidade[]) => ops.reduce((t, o) => t + (o.valorCentavos ?? 0), 0)

export type EtapaDaFaixa = {
  etapa: EtapaAberta
  contagem: number
  valorCentavos: number
  /** Para a etapa seguinte, no período. Nula sem base e na última coluna. */
  passagem: number | null
}

export type Faixa = { etapas: EtapaDaFaixa[]; ganhas: number; perdidas: number }

export function faixaDoFunil(ops: readonly Oportunidade[], agora: string, dias: PeriodoEmDias): Faixa {
  const abertasNoPeriodo = ops.filter((o) => noPeriodo(o.abertaEm, agora, dias))
  const etapas = ETAPAS_ABERTAS.map((etapa, i): EtapaDaFaixa => {
    const nela = ops.filter((o) => o.etapa === etapa)
    const seguinte = ETAPAS_ABERTAS[i + 1]
    const base = seguinte ? abertasNoPeriodo.filter((o) => chegou(o, etapa)) : []
    return {
      etapa,
      contagem: nela.length,
      valorCentavos: soma(nela),
      passagem: seguinte && base.length > 0 ? base.filter((o) => chegou(o, seguinte)).length / base.length : null,
    }
  })
  const encerradas = (etapa: Etapa) =>
    ops.filter((o) => o.etapa === etapa && noPeriodo(o.encerradaEm, agora, dias)).length
  return { etapas, ganhas: encerradas("ganho"), perdidas: encerradas("perdido") }
}

export type ResumoDoCrm = {
  valorGanhoCentavos: number
  /** Das abertas no período, a parcela que terminou em Ganho. */
  conversao: number | null
  /** Média, em dias com uma casa, da abertura ao Ganho das ganhas no período. */
  diasAteFechar: number | null
}

export function resumoDoPeriodo(ops: readonly Oportunidade[], agora: string, dias: PeriodoEmDias): ResumoDoCrm {
  const ganhas = ops.filter((o) => o.etapa === "ganho" && noPeriodo(o.encerradaEm, agora, dias))
  const abertas = ops.filter((o) => noPeriodo(o.abertaEm, agora, dias))
  const duracoes = ganhas.map((o) => (Date.parse(o.encerradaEm!) - Date.parse(o.abertaEm)) / DIA_MS)
  return {
    valorGanhoCentavos: soma(ganhas),
    conversao: abertas.length > 0 ? abertas.filter((o) => o.etapa === "ganho").length / abertas.length : null,
    diasAteFechar:
      duracoes.length > 0 ? Math.round((duracoes.reduce((t, d) => t + d, 0) / duracoes.length) * 10) / 10 : null,
  }
}
```

- [x] **Passo 3: rodar** `npx vitest run lib/crm/metricas.test.ts`. Esperado: PASSA. Se falhar, corrija a implementação, nunca a conta escrita no teste: os números do teste foram feitos à mão a partir da definição.

- [x] **Passo 4: escrever o teste que falha**, em `lib/crm/cartao.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { atividadeDoCartao, nomeDoPaciente, tituloDoEvento, ultimaMudancaAutomatica } from "./cartao"
import type { Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const CARLA = { id: "m-carla", nome: "Carla Mendes" }

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Paciente Um", telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa: "novo",
    etapaDesde: AGORA,
    ultimaAtividade: AGORA,
    abertaEm: AGORA,
    encerradaEm: null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: null,
    nota: null,
    urgente: false,
    eventos: [{ id: "op-1-e1", de: null, para: "novo", em: AGORA, autor: null }],
    ...p,
  }
}

describe("nomeDoPaciente", () => {
  it("o nome, ou o telefone mascarado quando não há nome", () => {
    expect(nomeDoPaciente(op())).toBe("Paciente Um")
    const semNome = nomeDoPaciente(op({ paciente: { id: "p", nome: null, telefone: "+5581900000007", optOut: false } }))
    expect(semNome).not.toContain("900000007")
    expect(semNome).toMatch(/0007$/)
  })
})

describe("atividadeDoCartao", () => {
  it("a próxima ação vem primeiro", () => {
    expect(atividadeDoCartao(op({ proximaAcao: "2026-09-29T10:00:00-03:00", ultimaAtividade: "2026-09-01T10:00:00-03:00" }), AGORA)).toEqual({
      tipo: "proxima-acao",
      em: "2026-09-29T10:00:00-03:00",
    })
  })
  it("atividade nas últimas 24 h: hoje", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T15:00:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
  it("parado: alerta a partir de 3 dias", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-26T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 2, alerta: false })
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-25T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 3, alerta: true })
  })
})

describe("ultimaMudancaAutomatica", () => {
  it("o selo IA vale quando o último evento é do sistema", () => {
    expect(ultimaMudancaAutomatica(op())).toBe(true)
    const movida = op({ eventos: [...op().eventos, { id: "e2", de: "novo", para: "agendado", em: AGORA, autor: CARLA }] })
    expect(ultimaMudancaAutomatica(movida)).toBe(false)
  })
})

describe("tituloDoEvento", () => {
  it("a frase da linha do tempo", () => {
    expect(tituloDoEvento({ id: "1", de: null, para: "novo", em: AGORA, autor: null })).toBe("Aberta pela primeira mensagem do paciente")
    expect(tituloDoEvento({ id: "2", de: "novo", para: "qualificado", em: AGORA, autor: null })).toBe("IA qualificou")
    expect(tituloDoEvento({ id: "3", de: "novo", para: "agendado", em: AGORA, autor: CARLA })).toBe("Carla moveu para Agendado")
    expect(tituloDoEvento({ id: "4", de: "agendado", para: "ganho", em: AGORA, autor: CARLA })).toBe("Carla marcou como Ganho")
    expect(tituloDoEvento({ id: "5", de: "agendado", para: "perdido", em: AGORA, autor: CARLA })).toBe("Carla marcou como Perdido")
  })
})
```

- [x] **Passo 5: implementar `lib/crm/cartao.ts`**

```ts
import { mascararTelefone } from "@/lib/formatters/telefone"
import { ROTULO_DA_ETAPA, type EventoDaOportunidade, type Oportunidade } from "./tipos"

const DIA_MS = 86_400_000

/** "Parado há N dias" fica em tom de alerta a partir daqui (spec crm-v1, "Cartão"). */
export const DIAS_PARA_ALERTA = 3

/** Paciente sem nome aparece pelo telefone mascarado, como em Conversas. */
export function nomeDoPaciente(op: Oportunidade): string {
  return op.paciente.nome ?? mascararTelefone(op.paciente.telefone)
}

export type AtividadeDoCartao =
  | { tipo: "proxima-acao"; em: string }
  | { tipo: "hoje" }
  | { tipo: "parado"; dias: number; alerta: boolean }

export function atividadeDoCartao(op: Oportunidade, agora: string): AtividadeDoCartao {
  if (op.proximaAcao) return { tipo: "proxima-acao", em: op.proximaAcao }
  const dias = Math.max(0, Math.floor((Date.parse(agora) - Date.parse(op.ultimaAtividade)) / DIA_MS))
  if (dias === 0) return { tipo: "hoje" }
  return { tipo: "parado", dias, alerta: dias >= DIAS_PARA_ALERTA }
}

/** O selo IA: a última mudança foi do sistema (primeira mensagem ou qualificação). */
export function ultimaMudancaAutomatica(op: Oportunidade): boolean {
  return op.eventos.at(-1)?.autor === null
}

const primeiroNome = (nome: string) => nome.split(/\s+/)[0]

export function tituloDoEvento(ev: EventoDaOportunidade): string {
  if (!ev.autor) {
    if (ev.de === null) return "Aberta pela primeira mensagem do paciente"
    if (ev.para === "qualificado") return "IA qualificou"
    return `Sistema moveu para ${ROTULO_DA_ETAPA[ev.para]}`
  }
  const quem = primeiroNome(ev.autor.nome)
  if (ev.para === "ganho" || ev.para === "perdido") return `${quem} marcou como ${ROTULO_DA_ETAPA[ev.para]}`
  return `${quem} moveu para ${ROTULO_DA_ETAPA[ev.para]}`
}
```

Antes de rodar, confira em `lib/formatters/telefone.ts` o formato de `mascararTelefone`. O teste só exige que os dígitos do meio sumam e que o final `0007` apareça. Se a máscara esconder também o final, ajuste a última asserção ao formato real e mantenha a primeira.

- [x] **Passo 6: rodar** `npx vitest run lib/crm/cartao.test.ts`. Esperado: PASSA.

- [x] **Passo 7: escrever o teste que falha**, em `lib/crm/filtros.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { idsQueCasam } from "./busca"
import {
  filtrarEncerradas,
  filtrarPorResponsavel,
  hrefDoCrm,
  lerFiltroDeEncerradas,
  lerPeriodo,
  lerResponsavel,
  lerVista,
} from "./filtros"
import type { Etapa, Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

function op(id: string, etapa: Etapa, p: Partial<Oportunidade> = {}): Oportunidade {
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome: `Paciente ${id}`, telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa,
    etapaDesde: AGORA,
    ultimaAtividade: AGORA,
    abertaEm: AGORA,
    encerradaEm: final ? AGORA : null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: etapa === "perdido" ? "preco" : null,
    nota: null,
    urgente: false,
    eventos: [],
    ...p,
  }
}

describe("parâmetros da URL", () => {
  it("período: 7, 30 ou 90; o resto vira 30", () => {
    expect(lerPeriodo("7")).toBe(7)
    expect(lerPeriodo("90")).toBe(90)
    expect(lerPeriodo(undefined)).toBe(30)
    expect(lerPeriodo("365")).toBe(30)
  })
  it("responsável: meus, sem ou todos", () => {
    expect(lerResponsavel("meus")).toBe("meus")
    expect(lerResponsavel("sem")).toBe("sem")
    expect(lerResponsavel("m-ana")).toBe("todos")
  })
  it("vista: encerradas ou quadro", () => {
    expect(lerVista("encerradas")).toBe("encerradas")
    expect(lerVista("x")).toBe("quadro")
  })
  it("encerradas: motivo só vale com Perdido, e só da lista", () => {
    expect(lerFiltroDeEncerradas(undefined, undefined)).toEqual({ resultado: "todas", motivo: null })
    expect(lerFiltroDeEncerradas("perdido", "preco")).toEqual({ resultado: "perdido", motivo: "preco" })
    expect(lerFiltroDeEncerradas("ganho", "preco")).toEqual({ resultado: "ganho", motivo: null })
    expect(lerFiltroDeEncerradas("perdido", "caro")).toEqual({ resultado: "perdido", motivo: null })
  })
})

describe("hrefDoCrm", () => {
  it("omite o padrão e nunca leva termo de busca", () => {
    expect(hrefDoCrm("/dashboard/crm", { periodo: 30, responsavel: "todos", vista: "quadro" })).toBe("/dashboard/crm")
    expect(hrefDoCrm("/dashboard/crm", { periodo: 7, responsavel: "meus", vista: "quadro" })).toBe("/dashboard/crm?periodo=7&responsavel=meus")
    expect(
      hrefDoCrm("/dashboard/crm", { periodo: 30, responsavel: "todos", vista: "encerradas", resultado: "perdido", motivo: "preco" }),
    ).toBe("/dashboard/crm?vista=encerradas&resultado=perdido&motivo=preco")
  })
})

describe("filtrarPorResponsavel", () => {
  const ops = [op("a", "novo", { responsavel: ANA }), op("b", "novo", { responsavel: { id: "m-carla", nome: "Carla" } }), op("c", "novo")]
  it("todos, meus e sem responsável", () => {
    expect(filtrarPorResponsavel(ops, "todos", "m-ana").map((o) => o.id)).toEqual(["a", "b", "c"])
    expect(filtrarPorResponsavel(ops, "meus", "m-ana").map((o) => o.id)).toEqual(["a"])
    expect(filtrarPorResponsavel(ops, "sem", "m-ana").map((o) => o.id)).toEqual(["c"])
  })
})

describe("filtrarEncerradas", () => {
  const ops = [
    op("aberta", "novo"),
    op("g", "ganho", { encerradaEm: "2026-09-20T10:00:00-03:00" }),
    op("p1", "perdido", { encerradaEm: "2026-09-25T10:00:00-03:00", motivoDePerda: "preco" }),
    op("p2", "perdido", { encerradaEm: "2026-09-22T10:00:00-03:00", motivoDePerda: "outro" }),
  ]
  it("só as encerradas, da mais recente para a mais antiga", () => {
    expect(filtrarEncerradas(ops, { resultado: "todas", motivo: null }).map((o) => o.id)).toEqual(["p1", "p2", "g"])
  })
  it("por resultado e motivo", () => {
    expect(filtrarEncerradas(ops, { resultado: "ganho", motivo: null }).map((o) => o.id)).toEqual(["g"])
    expect(filtrarEncerradas(ops, { resultado: "perdido", motivo: "outro" }).map((o) => o.id)).toEqual(["p2"])
  })
})

describe("idsQueCasam", () => {
  const ops = [
    op("a", "novo", { paciente: { id: "1", nome: "Mariana Araújo", telefone: "+5581900000001", optOut: false } }),
    op("b", "novo", { paciente: { id: "2", nome: null, telefone: "+5581900000007", optOut: false } }),
  ]
  it("por nome, sem acento, ou por parte do telefone", () => {
    expect(idsQueCasam(ops, "mariana araujo")).toEqual(["a"])
    expect(idsQueCasam(ops, "0007")).toEqual(["b"])
    expect(idsQueCasam(ops, "ninguém")).toEqual([])
  })
})
```

- [x] **Passo 8: implementar `lib/crm/filtros.ts` e `lib/crm/busca.ts`**

```ts
// lib/crm/filtros.ts
import { PERIODOS, type PeriodoEmDias } from "./metricas"
import { ehMotivoDePerda, type MotivoDePerda, type Oportunidade } from "./tipos"

/**
 * O recorte da tela do CRM vive na URL: período, responsável e a lista das
 * encerradas. O termo de busca nunca entra aqui (spec crm-v1, "Segurança").
 */

export function lerPeriodo(v: string | undefined): PeriodoEmDias {
  return PERIODOS.find((p) => String(p) === v) ?? 30
}

export type FiltroDeResponsavel = "todos" | "meus" | "sem"
export function lerResponsavel(v: string | undefined): FiltroDeResponsavel {
  return v === "meus" || v === "sem" ? v : "todos"
}

export type Vista = "quadro" | "encerradas"
export function lerVista(v: string | undefined): Vista {
  return v === "encerradas" ? "encerradas" : "quadro"
}

export type FiltroDeEncerradas = { resultado: "todas" | "ganho" | "perdido"; motivo: MotivoDePerda | null }
export function lerFiltroDeEncerradas(resultado: string | undefined, motivo: string | undefined): FiltroDeEncerradas {
  const r = resultado === "ganho" || resultado === "perdido" ? resultado : "todas"
  return { resultado: r, motivo: r === "perdido" && ehMotivoDePerda(motivo) ? motivo : null }
}

export type ParametrosDoCrm = {
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  resultado?: FiltroDeEncerradas["resultado"]
  motivo?: MotivoDePerda | null
}

export function hrefDoCrm(caminho: string, p: ParametrosDoCrm): string {
  const q = new URLSearchParams()
  if (p.periodo !== 30) q.set("periodo", String(p.periodo))
  if (p.responsavel !== "todos") q.set("responsavel", p.responsavel)
  if (p.vista === "encerradas") {
    q.set("vista", "encerradas")
    if (p.resultado && p.resultado !== "todas") q.set("resultado", p.resultado)
    if (p.resultado === "perdido" && p.motivo) q.set("motivo", p.motivo)
  }
  const s = q.toString()
  return s ? `${caminho}?${s}` : caminho
}

export function filtrarPorResponsavel(
  ops: readonly Oportunidade[],
  filtro: FiltroDeResponsavel,
  euId: string,
): Oportunidade[] {
  if (filtro === "meus") return ops.filter((o) => o.responsavel?.id === euId)
  if (filtro === "sem") return ops.filter((o) => o.responsavel === null)
  return [...ops]
}

export function filtrarEncerradas(ops: readonly Oportunidade[], f: FiltroDeEncerradas): Oportunidade[] {
  return ops
    .filter((o) => o.encerradaEm !== null)
    .filter((o) => f.resultado === "todas" || o.etapa === f.resultado)
    .filter((o) => !f.motivo || o.motivoDePerda === f.motivo)
    .sort((a, b) => Date.parse(b.encerradaEm!) - Date.parse(a.encerradaEm!))
}
```

```ts
// lib/crm/busca.ts
import { contemBusca } from "@/lib/formatters/texto"
import type { Oportunidade } from "./tipos"

/**
 * As oportunidades cujo paciente casa com o termo, por nome ou por parte do
 * telefone (a mesma regra da fila de Conversas). Devolve só os ids: a tela já
 * tem os cartões, e a resposta da busca não precisa repetir dado de paciente.
 */
export function idsQueCasam(ops: readonly Oportunidade[], termo: string): string[] {
  return ops.filter((o) => contemBusca([o.paciente.nome, o.paciente.telefone], termo)).map((o) => o.id)
}
```

- [x] **Passo 9: rodar** `npx vitest run lib/crm`. Esperado: PASSA.

- [x] **Passo 10: commit**

```bash
git add lib/crm
git commit -m "feat(crm): números do funil, regras do cartão, filtros e busca"
```

---

### Tarefa 3: As oportunidades de exemplo

**Arquivos:**
- Criar: `app/_fixtures/crm.ts`
- Modificar: `tests/demo/fixtures.test.ts` (registrar `OPORTUNIDADES`)
- Teste: `app/_fixtures/crm.test.ts`

**Interfaces:**
- Consome: `Oportunidade`, `Etapa`, `Referencia` e `MotivoDePerda` (tarefa 1); `pacientePorId` (`app/_fixtures/pacientes.ts`); `MEMBROS` (`app/_fixtures/equipe.ts`, com `id`, `nome` e `voce`).
- Produz: `OPORTUNIDADES: Oportunidade[]` e `PROCEDIMENTOS_DO_CRM: Referencia[]`.

O conjunto cobre cada caso da tela: duas oportunidades em Novo (uma sem nome, outra com opt-out e parada há semanas), uma qualificada pela IA e urgente, uma qualificada pela IA com valor, uma qualificada à mão com próxima ação, uma qualificada e parada há 6 dias, duas agendadas, uma em Compareceu e parada, quatro ganhas (duas nos últimos 7 dias ou perto disso, uma em 30 e uma só em 90) e três perdidas com motivos diferentes. Os ids das conversas são os de `app/_fixtures/conversas.ts`: `c-urgente` (pac-04), `c-falha` (pac-05), `c-humano` (pac-01), `c-fechada` (pac-09), `c-quase` (pac-06), `c-agendando` (pac-02) e `c-audio` (pac-07).

- [x] **Passo 1: escrever o teste que falha**, em `app/_fixtures/crm.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { validarMovimento } from "@/lib/crm/movimento"
import { ETAPAS_ABERTAS, ehEtapaAberta } from "@/lib/crm/tipos"
import { CONVERSAS } from "./conversas"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "./crm"

// A fixture tem de obedecer às mesmas regras que o banco vai garantir na
// parte 2: senão o protótipo mostra uma tela que o produto nunca terá.
describe("oportunidades de exemplo", () => {
  it("uma aberta por paciente, no máximo", () => {
    const abertas = OPORTUNIDADES.filter((o) => ehEtapaAberta(o.etapa)).map((o) => o.paciente.id)
    expect(new Set(abertas).size).toBe(abertas.length)
  })

  it("ids únicos, e cada etapa aberta e encerrada aparece", () => {
    expect(new Set(OPORTUNIDADES.map((o) => o.id)).size).toBe(OPORTUNIDADES.length)
    for (const etapa of [...ETAPAS_ABERTAS, "ganho", "perdido"]) {
      expect(OPORTUNIDADES.some((o) => o.etapa === etapa), etapa).toBe(true)
    }
  })

  it("encerrada tem data de encerramento; aberta não", () => {
    for (const o of OPORTUNIDADES) expect(o.encerradaEm === null, o.id).toBe(ehEtapaAberta(o.etapa))
  })

  it("Ganho tem procedimento da lista e valor; Perdido tem motivo; as outras não têm motivo", () => {
    const procedimentos = PROCEDIMENTOS_DO_CRM.map((p) => p.id)
    for (const o of OPORTUNIDADES) {
      if (o.etapa === "ganho") {
        expect(procedimentos, o.id).toContain(o.procedimento?.id)
        expect(o.valorCentavos, o.id).toBeGreaterThan(0)
      }
      expect(o.motivoDePerda !== null, o.id).toBe(o.etapa === "perdido")
    }
  })

  it("a trilha é coerente: abre sem origem, cada evento parte de onde o anterior chegou e termina na etapa atual", () => {
    for (const o of OPORTUNIDADES) {
      const [abertura, ...resto] = o.eventos
      expect(abertura.de, o.id).toBeNull()
      expect(abertura.em, o.id).toBe(o.abertaEm)
      resto.forEach((ev, i) => {
        const anterior = o.eventos[i]
        expect(ev.de, o.id).toBe(anterior.para)
        expect(Date.parse(ev.em) >= Date.parse(anterior.em), o.id).toBe(true)
      })
      expect(o.eventos.at(-1)!.para, o.id).toBe(o.etapa)
      expect(o.eventos.at(-1)!.em, o.id).toBe(o.etapaDesde)
    }
  })

  it("a conversa citada existe nas conversas de exemplo, do mesmo paciente", () => {
    for (const o of OPORTUNIDADES.filter((x) => x.conversaId)) {
      const conversa = CONVERSAS.find((c) => c.id === o.conversaId)
      expect(conversa?.paciente.id, o.id).toBe(o.paciente.id)
    }
  })

  it("toda aberta pode ser movida pela regra da lib", () => {
    for (const o of OPORTUNIDADES.filter((x) => ehEtapaAberta(x.etapa))) {
      const para = o.etapa === "novo" ? "qualificado" : "novo"
      expect(validarMovimento(o, { oportunidadeId: o.id, de: o.etapa, para }).status, o.id).toBe("ok")
    }
  })
})
```

- [x] **Passo 2: rodar** `npx vitest run app/_fixtures/crm.test.ts`. Esperado: FALHA, com "Failed to resolve import ./crm".

- [x] **Passo 3: escrever `app/_fixtures/crm.ts`**

```ts
import type { Etapa, MotivoDePerda, Oportunidade, Referencia } from "@/lib/crm/tipos"
import { CONVERSAS } from "./conversas"
import { MEMBROS } from "./equipe"
import { pacientePorId } from "./pacientes"

/**
 * O funil de exemplo da conta de demonstração (spec crm-v1, parte 1). Mesmos
 * pacientes, conversas e equipe das outras telas: o id aponta para a mesma
 * pessoa em todas. Datas em torno do "agora" das fixtures (28/09/2026,
 * 14:32), deslocadas para hoje pelo relógio da demonstração. Notas
 * fictícias, sem data escrita no texto.
 */

export const PROCEDIMENTOS_DO_CRM: Referencia[] = [
  { id: "proc-avaliacao", nome: "Limpeza e avaliação" },
  { id: "proc-clareamento", nome: "Clareamento dental" },
  { id: "proc-implante", nome: "Implante dentário" },
  { id: "proc-ortodontia", nome: "Aparelho ortodôntico" },
  { id: "proc-harmonizacao", nome: "Harmonização facial" },
  { id: "proc-toxina", nome: "Toxina botulínica" },
]

function procedimento(id: string): Referencia {
  const p = PROCEDIMENTOS_DO_CRM.find((x) => x.id === id)
  if (!p) throw new Error(`Procedimento de protótipo inexistente: ${id}`)
  return p
}

function membro(id: string): Referencia {
  const m = MEMBROS.find((x) => x.id === id)
  if (!m) throw new Error(`Membro de protótipo inexistente: ${id}`)
  return { id: m.id, nome: m.nome }
}

/** [etapa, instante, autor]: autor nulo é o sistema. O primeiro passo é a abertura. */
type Passo = [para: Etapa, em: string, autor: string | null]

type Base = {
  id: string
  paciente: string
  conversa?: string
  procedimento?: string
  valorCentavos?: number
  responsavel?: string
  proximaAcao?: string
  motivo?: MotivoDePerda
  nota?: string
  /** Quando difere da última mudança de etapa: mensagem do paciente depois dela. */
  ultimaAtividade?: string
}

function oportunidade(b: Base, passos: Passo[]): Oportunidade {
  const p = pacientePorId(b.paciente)
  const [para, em] = passos.at(-1)!
  const final = para === "ganho" || para === "perdido"
  const urgente = CONVERSAS.find((c) => c.id === b.conversa)?.urgente ?? false
  return {
    id: b.id,
    paciente: { id: p.id, nome: p.name, telefone: p.whatsapp_phone_number, optOut: p.opted_out },
    conversaId: b.conversa ?? null,
    etapa: para,
    etapaDesde: em,
    ultimaAtividade: b.ultimaAtividade ?? em,
    abertaEm: passos[0][1],
    encerradaEm: final ? em : null,
    procedimento: b.procedimento ? procedimento(b.procedimento) : null,
    valorCentavos: b.valorCentavos ?? null,
    responsavel: b.responsavel ? membro(b.responsavel) : null,
    proximaAcao: b.proximaAcao ?? null,
    motivoDePerda: b.motivo ?? null,
    nota: b.nota ?? null,
    urgente,
    eventos: passos.map(([etapa, quando, autor], i) => ({
      id: `${b.id}-e${i + 1}`,
      de: i === 0 ? null : passos[i - 1][0],
      para: etapa,
      em: quando,
      autor: autor ? membro(autor) : null,
    })),
  }
}

export const OPORTUNIDADES: Oportunidade[] = [
  // --- Novo
  oportunidade({ id: "op-01", paciente: "pac-05", conversa: "c-falha", ultimaAtividade: "2026-09-28T14:05:00-03:00" }, [
    ["novo", "2026-09-28T13:40:00-03:00", null],
  ]),
  oportunidade({ id: "op-02", paciente: "pac-07", conversa: "c-audio" }, [["novo", "2026-09-28T12:10:00-03:00", null]]),
  oportunidade({ id: "op-03", paciente: "pac-10", nota: "Pediu para não receber mensagens automáticas." }, [
    ["novo", "2026-08-14T09:45:00-03:00", null],
  ]),
  // --- Qualificado
  oportunidade(
    { id: "op-04", paciente: "pac-04", conversa: "c-urgente", procedimento: "proc-implante", ultimaAtividade: "2026-09-28T14:20:00-03:00" },
    [
      ["novo", "2026-09-28T13:55:00-03:00", null],
      ["qualificado", "2026-09-28T14:02:00-03:00", null],
    ],
  ),
  oportunidade(
    { id: "op-05", paciente: "pac-02", conversa: "c-agendando", procedimento: "proc-clareamento", valorCentavos: 120000, responsavel: "m-carla", ultimaAtividade: "2026-09-28T14:29:00-03:00" },
    [
      ["novo", "2026-09-28T14:00:00-03:00", null],
      ["qualificado", "2026-09-28T14:12:00-03:00", null],
    ],
  ),
  oportunidade(
    {
      id: "op-06",
      paciente: "pac-06",
      conversa: "c-quase",
      procedimento: "proc-harmonizacao",
      valorCentavos: 250000,
      responsavel: "m-diego",
      proximaAcao: "2026-09-29T10:00:00-03:00",
      nota: "Quer fazer em duas etapas. Enviar orçamento por escrito.",
    },
    [
      ["novo", "2026-09-27T15:00:00-03:00", null],
      ["qualificado", "2026-09-27T15:40:00-03:00", "m-carla"],
    ],
  ),
  oportunidade(
    { id: "op-07", paciente: "pac-12", procedimento: "proc-ortodontia", valorCentavos: 480000, responsavel: "m-carla", nota: "Comparando com outra clínica do bairro." },
    [
      ["novo", "2026-09-20T10:00:00-03:00", null],
      ["qualificado", "2026-09-22T11:15:00-03:00", null],
    ],
  ),
  // --- Agendado
  oportunidade(
    {
      id: "op-08",
      paciente: "pac-01",
      conversa: "c-humano",
      procedimento: "proc-implante",
      valorCentavos: 350000,
      responsavel: "m-ana",
      proximaAcao: "2026-10-01T16:00:00-03:00",
      ultimaAtividade: "2026-09-28T11:02:00-03:00",
    },
    [
      ["novo", "2026-09-25T09:00:00-03:00", null],
      ["qualificado", "2026-09-25T09:20:00-03:00", null],
      ["agendado", "2026-09-26T10:30:00-03:00", "m-carla"],
    ],
  ),
  oportunidade(
    { id: "op-09", paciente: "pac-09", conversa: "c-fechada", procedimento: "proc-avaliacao", valorCentavos: 25000, responsavel: "m-diego", ultimaAtividade: "2026-09-27T08:30:00-03:00" },
    [
      ["novo", "2026-09-24T16:00:00-03:00", null],
      ["agendado", "2026-09-25T09:10:00-03:00", "m-diego"],
    ],
  ),
  // --- Compareceu
  oportunidade(
    { id: "op-10", paciente: "pac-03", procedimento: "proc-clareamento", valorCentavos: 120000, responsavel: "m-ana", nota: "Gostou da avaliação; vai decidir com o marido." },
    [
      ["novo", "2026-09-15T10:00:00-03:00", null],
      ["qualificado", "2026-09-15T10:30:00-03:00", null],
      ["agendado", "2026-09-16T09:00:00-03:00", "m-carla"],
      ["compareceu", "2026-09-22T17:10:00-03:00", "m-ana"],
    ],
  ),
  // --- Ganho
  oportunidade({ id: "op-11", paciente: "pac-08", procedimento: "proc-implante", valorCentavos: 420000, responsavel: "m-ana" }, [
    ["novo", "2026-09-02T09:00:00-03:00", null],
    ["qualificado", "2026-09-02T09:25:00-03:00", null],
    ["agendado", "2026-09-03T10:00:00-03:00", "m-carla"],
    ["compareceu", "2026-09-10T15:00:00-03:00", "m-ana"],
    ["ganho", "2026-09-18T11:00:00-03:00", "m-ana"],
  ]),
  oportunidade({ id: "op-12", paciente: "pac-01", procedimento: "proc-avaliacao", valorCentavos: 25000, responsavel: "m-carla" }, [
    ["novo", "2026-09-05T08:40:00-03:00", null],
    ["agendado", "2026-09-05T09:00:00-03:00", "m-carla"],
    ["ganho", "2026-09-12T10:00:00-03:00", "m-carla"],
  ]),
  oportunidade({ id: "op-13", paciente: "pac-06", procedimento: "proc-toxina", valorCentavos: 150000, responsavel: "m-diego" }, [
    ["novo", "2026-07-10T14:00:00-03:00", null],
    ["qualificado", "2026-07-10T14:20:00-03:00", null],
    ["ganho", "2026-07-25T16:00:00-03:00", "m-diego"],
  ]),
  oportunidade({ id: "op-14", paciente: "pac-09", procedimento: "proc-clareamento", valorCentavos: 110000, responsavel: "m-carla" }, [
    ["novo", "2026-09-19T10:00:00-03:00", null],
    ["qualificado", "2026-09-19T10:15:00-03:00", null],
    ["agendado", "2026-09-20T09:00:00-03:00", "m-carla"],
    ["ganho", "2026-09-24T18:00:00-03:00", "m-carla"],
  ]),
  // --- Perdido
  oportunidade({ id: "op-15", paciente: "pac-11", motivo: "preco", responsavel: "m-diego" }, [
    ["novo", "2026-09-08T10:00:00-03:00", null],
    ["qualificado", "2026-09-08T10:20:00-03:00", null],
    ["perdido", "2026-09-16T12:00:00-03:00", "m-diego"],
  ]),
  oportunidade({ id: "op-16", paciente: "pac-03", motivo: "outra_clinica" }, [
    ["novo", "2026-09-01T11:00:00-03:00", null],
    ["perdido", "2026-09-10T09:00:00-03:00", "m-carla"],
  ]),
  oportunidade({ id: "op-17", paciente: "pac-12", motivo: "sem_resposta", responsavel: "m-carla" }, [
    ["novo", "2026-08-20T10:00:00-03:00", null],
    ["qualificado", "2026-08-20T10:30:00-03:00", null],
    ["perdido", "2026-09-05T10:00:00-03:00", "m-carla"],
  ]),
]
```

Nota: `op-14` e `op-09` são do mesmo paciente (pac-09). Uma está encerrada (Ganho) e a outra aberta, o que a regra "uma aberta por vez" permite. O mesmo vale para `op-12`/`op-08` (pac-01), `op-13`/`op-06` (pac-06), `op-16`/`op-10` (pac-03) e `op-17`/`op-07` (pac-12). Se `CONVERSAS` não tiver `urgente` no topo de cada item, ou não tiver `paciente.id`, leia `app/_fixtures/conversas.ts` e ajuste só as duas leituras dentro de `oportunidade()` e do teste.

- [x] **Passo 4: registrar a fixture nas travas da demonstração.** Em `tests/demo/fixtures.test.ts`, importe `OPORTUNIDADES` de `@/app/_fixtures/crm` e acrescente `OPORTUNIDADES,` ao objeto `FIXTURES`, em ordem alfabética, depois de `MINHA_CONTA`.

- [x] **Passo 5: rodar** `npx vitest run app/_fixtures/crm.test.ts tests/demo/fixtures.test.ts tests/architecture/prototipos.test.ts`. Esperado: PASSA. Se a trava "nenhuma data escrita por extenso" falhar, reescreva a nota em vez de afrouxar a trava.

- [x] **Passo 6: commit**

```bash
git add app/_fixtures/crm.ts app/_fixtures/crm.test.ts tests/demo/fixtures.test.ts
git commit -m "feat(crm): oportunidades de exemplo da conta de demonstração"
```

---

### Tarefa 4: Cartão, faixa, resumo, painel e encerradas

Carregue as skills `ui-ux` e `frontend-design` antes. A faixa do funil é o elemento que marca a tela: barra única dividida em quatro, com números tabulares, e nada de verde fora de Ganho.

**Arquivos:**
- Criar: `components/crm/cartao-da-oportunidade.tsx`, `components/crm/faixa-do-funil.tsx`, `components/crm/resumo-do-periodo.tsx`, `components/crm/painel-da-oportunidade.tsx`, `components/crm/lista-de-encerradas.tsx` e `components/crm/mover-para.tsx`
- Teste: `components/crm/componentes.test.tsx`

**Interfaces:**
- Consome: as tarefas 1 e 2; do kit, `AvatarDeIniciais({ nome, tamanho })`, `StatusBadge({ tone, children })`, `KpiCard({ label, value, detail })`, `FiltroSegmentado({ rotulo, segmentos, atual, quebrar })`, `LinhaDoTempo({ rotulo, eventos })` e `ListaDeDados({ itens, colunas })`; `formatarMoeda`, `formatarNumero`, `formatarPercentual`, `formatarDataCurta` e `formatarHora` (`lib/formatters`).
- Produz:
  - `CartaoDaOportunidade({ op, agora, aoAbrir, alca? })`;
  - `FaixaDoFunil({ faixa, etapaNoCelular, aoEscolher, hrefDasEncerradas })`;
  - `ResumoDoPeriodo({ resumo, periodo, hrefDoPeriodo })`, com `hrefDoPeriodo: Record<PeriodoEmDias, string>`;
  - `PainelDaOportunidade({ op, aoFechar, aoMover })`, com `aoMover: (op: Oportunidade, para: Etapa) => void`;
  - `ListaDeEncerradas({ ops, filtro, hrefDe, aoAbrir })`, com `hrefDe: (f: FiltroDeEncerradas) => string`;
  - `MoverPara({ op, aoMover })`.

Nenhum destes componentes usa hook. Eles rodam dentro da árvore cliente da tarefa 5, mas não têm `"use client"` próprio, e por isso o teste os desenha com `renderToStaticMarkup`.

- [x] **Passo 1: escrever o teste que falha**, em `components/crm/componentes.test.tsx`

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { faixaDoFunil, resumoDoPeriodo } from "@/lib/crm/metricas"
import type { Oportunidade } from "@/lib/crm/tipos"
import { CartaoDaOportunidade } from "./cartao-da-oportunidade"
import { FaixaDoFunil } from "./faixa-do-funil"
import { ListaDeEncerradas } from "./lista-de-encerradas"
import { MoverPara } from "./mover-para"
import { PainelDaOportunidade } from "./painel-da-oportunidade"
import { ResumoDoPeriodo } from "./resumo-do-periodo"

const AGORA = "2026-09-28T14:32:00-03:00"
const nada = () => {}

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Mariana Araújo", telefone: "+5581900000001", optOut: false },
    conversaId: "c-humano",
    etapa: "agendado",
    etapaDesde: "2026-09-26T10:00:00-03:00",
    ultimaAtividade: "2026-09-24T10:00:00-03:00",
    abertaEm: "2026-09-25T09:00:00-03:00",
    encerradaEm: null,
    procedimento: { id: "proc-implante", nome: "Implante dentário" },
    valorCentavos: 350000,
    responsavel: { id: "m-carla", nome: "Carla Mendes" },
    proximaAcao: null,
    motivoDePerda: null,
    nota: "Prefere horário de manhã.",
    urgente: false,
    eventos: [
      { id: "e1", de: null, para: "novo", em: "2026-09-25T09:00:00-03:00", autor: null },
      { id: "e2", de: "novo", para: "qualificado", em: "2026-09-25T09:20:00-03:00", autor: null },
      { id: "e3", de: "qualificado", para: "agendado", em: "2026-09-26T10:00:00-03:00", autor: { id: "m-carla", nome: "Carla Mendes" } },
    ],
    ...p,
  }
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe("CartaoDaOportunidade", () => {
  it("nome, procedimento, valor, iniciais do responsável e parado com alerta", () => {
    const h = html(<CartaoDaOportunidade op={op()} agora={AGORA} aoAbrir={nada} />)
    expect(h).toContain("Mariana Araújo")
    expect(h).toContain("Implante dentário")
    expect(h).toContain("R$ 3.500,00")
    expect(h).toContain("CM")
    expect(h).toContain("Parado há 4 dias")
    expect(h).toContain('data-alerta="true"')
    expect(h).not.toContain(">IA<")
  })

  it("próxima ação no lugar do parado; selos IA, opt-out e urgência", () => {
    const h = html(
      <CartaoDaOportunidade
        op={op({
          proximaAcao: "2026-10-01T16:00:00-03:00",
          urgente: true,
          paciente: { id: "p", nome: "X", telefone: "+5581900000001", optOut: true },
          eventos: [{ id: "e1", de: null, para: "novo", em: AGORA, autor: null }],
        })}
        agora={AGORA}
        aoAbrir={nada}
      />,
    )
    expect(h).toContain("Próxima ação")
    expect(h).not.toContain("Parado há")
    expect(h).toContain(">IA<")
    expect(h).toContain("Opt-out")
    expect(h).toContain("Urgente")
  })

  it("sem procedimento e sem valor", () => {
    const h = html(<CartaoDaOportunidade op={op({ procedimento: null, valorCentavos: null })} agora={AGORA} aoAbrir={nada} />)
    expect(h).toContain("Sem procedimento")
    expect(h).toContain("Sem valor")
  })
})

describe("FaixaDoFunil", () => {
  it("contagem, valor e passagem por etapa aberta, e as encerradas com link", () => {
    const faixa = faixaDoFunil([op()], AGORA, 30)
    const h = html(
      <FaixaDoFunil faixa={faixa} etapaNoCelular="novo" aoEscolher={nada} hrefDasEncerradas={{ ganho: "/g", perdido: "/p" }} />,
    )
    for (const r of ["Novo", "Qualificado", "Agendado", "Compareceu"]) expect(h).toContain(r)
    expect(h).toContain("R$ 3.500,00")
    expect(h).toContain("100%")
    expect(h).toContain('href="/g"')
    expect(h).toContain('href="/p"')
    // O seletor do celular marca a etapa escolhida.
    expect(h).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Novo/)
  })
})

describe("ResumoDoPeriodo", () => {
  it("valor ganho, conversão e tempo até fechar; sem base, um traço e o porquê", () => {
    const vazio = html(
      <ResumoDoPeriodo resumo={resumoDoPeriodo([], AGORA, 30)} periodo={30} hrefDoPeriodo={{ 7: "/7", 30: "/30", 90: "/90" }} />,
    )
    expect(vazio).toContain("Valor ganho")
    expect(vazio).toContain("R$ 0,00")
    expect(vazio).toContain("Nenhuma oportunidade aberta no período")
    const cheio = html(
      <ResumoDoPeriodo
        resumo={{ valorGanhoCentavos: 150000, conversao: 0.25, diasAteFechar: 9.5 }}
        periodo={7}
        hrefDoPeriodo={{ 7: "/7", 30: "/30", 90: "/90" }}
      />,
    )
    expect(cheio).toContain("R$ 1.500,00")
    expect(cheio).toContain("25%")
    expect(cheio).toContain("9,5 dias")
  })
})

describe("PainelDaOportunidade", () => {
  it("campos, nota, linha do tempo e o link para a conversa", () => {
    const h = html(<PainelDaOportunidade op={op()} aoFechar={nada} aoMover={nada} />)
    expect(h).toContain("Implante dentário")
    expect(h).toContain("Carla Mendes")
    expect(h).toContain("Prefere horário de manhã.")
    expect(h).toContain("IA qualificou")
    expect(h).toContain("Carla moveu para Agendado")
    expect(h).toContain('href="/dashboard/conversations?c=c-humano"')
    expect(h).toContain("Mover para")
  })

  it("encerrada mostra o motivo e não oferece mover", () => {
    const perdida = op({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco" })
    const h = html(<PainelDaOportunidade op={perdida} aoFechar={nada} aoMover={nada} />)
    expect(h).toContain("Preço")
    expect(h).not.toContain("Mover para")
  })
})

describe("MoverPara", () => {
  it("lista as outras etapas", () => {
    const h = html(<MoverPara op={op()} aoMover={nada} />)
    expect(h).toContain("Mover para…")
    expect(h).toContain('value="ganho"')
    expect(h).not.toContain('value="agendado"')
  })
})

describe("ListaDeEncerradas", () => {
  const encerradas = [
    op({ id: "g", etapa: "ganho", encerradaEm: "2026-09-20T10:00:00-03:00" }),
    op({ id: "p", etapa: "perdido", encerradaEm: "2026-09-22T10:00:00-03:00", motivoDePerda: "sem_resposta" }),
  ]
  it("ganhas com valor, perdidas com motivo; filtro de motivo só em Perdidas", () => {
    const todas = html(<ListaDeEncerradas ops={encerradas} filtro={{ resultado: "todas", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(todas).toContain("R$ 3.500,00")
    expect(todas).toContain("Parou de responder")
    expect(todas).not.toContain("Motivo da perda")
    const perdidas = html(<ListaDeEncerradas ops={encerradas} filtro={{ resultado: "perdido", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(perdidas).toContain("Motivo da perda")
  })
  it("vazio explica o recorte", () => {
    const h = html(<ListaDeEncerradas ops={[]} filtro={{ resultado: "ganho", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(h).toContain("Nenhuma oportunidade encerrada neste recorte.")
  })
})
```

- [x] **Passo 2: rodar** `npx vitest run components/crm/componentes.test.tsx`. Esperado: FALHA, por faltarem os módulos.

- [x] **Passo 3: implementar `components/crm/cartao-da-oportunidade.tsx`**

```tsx
import type { ReactNode } from "react"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { StatusBadge } from "@/components/patterns/status-badge"
import { atividadeDoCartao, nomeDoPaciente, ultimaMudancaAutomatica } from "@/lib/crm/cartao"
import type { Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import { cn } from "@/lib/utils"

/**
 * O cartão do quadro (spec crm-v1, "Cartão"). `alca` é a alça de arrastar,
 * que o quadro injeta. O nome é o botão que abre o painel.
 */
export function CartaoDaOportunidade({
  op,
  agora,
  aoAbrir,
  alca,
}: {
  op: Oportunidade
  agora: string
  aoAbrir: (id: string) => void
  alca?: ReactNode
}) {
  const atividade = atividadeDoCartao(op, agora)
  return (
    <article className="grid gap-2 rounded-card border border-hairline bg-surface-1 p-3 text-sm shadow-xs">
      <div className="flex items-start gap-2">
        {alca}
        <button
          type="button"
          onClick={() => aoAbrir(op.id)}
          className="min-w-0 flex-1 truncate text-left font-medium text-ink-1 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {nomeDoPaciente(op)}
        </button>
        {op.responsavel && <AvatarDeIniciais nome={op.responsavel.nome} tamanho="sm" />}
      </div>
      <p className="flex flex-wrap gap-x-1.5 text-ink-2">
        <span>{op.procedimento?.nome ?? "Sem procedimento"}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : "Sem valor"}</span>
      </p>
      <p
        data-alerta={atividade.tipo === "parado" && atividade.alerta ? "true" : undefined}
        className={cn(
          "text-xs",
          atividade.tipo === "parado" && atividade.alerta ? "font-medium text-warning-fg" : "text-ink-3",
        )}
      >
        {atividade.tipo === "proxima-acao"
          ? `Próxima ação: ${formatarDataCurta(atividade.em)}, ${formatarHora(atividade.em)}`
          : atividade.tipo === "hoje"
            ? "Atividade hoje"
            : `Parado há ${plural(atividade.dias, "dia", "dias")}`}
      </p>
      {(ultimaMudancaAutomatica(op) || op.paciente.optOut || op.urgente) && (
        <div className="flex flex-wrap gap-1">
          {ultimaMudancaAutomatica(op) && <StatusBadge tone="info">IA</StatusBadge>}
          {op.urgente && <StatusBadge tone="danger">Urgente</StatusBadge>}
          {op.paciente.optOut && <StatusBadge tone="neutral">Opt-out</StatusBadge>}
        </div>
      )}
    </article>
  )
}
```

- [x] **Passo 4: implementar `components/crm/faixa-do-funil.tsx`**

```tsx
import Link from "next/link"
import type { Faixa } from "@/lib/crm/metricas"
import { ETAPAS_ABERTAS, ROTULO_DA_ETAPA, type EtapaAberta } from "@/lib/crm/tipos"
import { formatarMoeda, formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { cn } from "@/lib/utils"

/**
 * A faixa do funil: no desktop, uma barra única dividida pelas quatro etapas
 * abertas, que é também o cabeçalho das colunas (mesma grade de quatro). No
 * celular, vira o seletor da etapa mostrada. Ganho e Perdido ficam ao lado,
 * como contagem do período, com link para as encerradas.
 */
export function FaixaDoFunil({
  faixa,
  etapaNoCelular,
  aoEscolher,
  hrefDasEncerradas,
}: {
  faixa: Faixa
  etapaNoCelular: EtapaAberta
  aoEscolher: (etapa: EtapaAberta) => void
  hrefDasEncerradas: { ganho: string; perdido: string }
}) {
  return (
    <section aria-label="Funil" className="grid gap-2">
      <ol className="hidden grid-cols-4 overflow-hidden rounded-card border border-hairline bg-surface-1 md:grid">
        {faixa.etapas.map((e, i) => (
          <li key={e.etapa} className={cn("relative grid gap-0.5 px-4 py-3", i > 0 && "border-l border-hairline")}>
            <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">{ROTULO_DA_ETAPA[e.etapa]}</span>
            <span className="text-2xl font-semibold text-ink-1 tabular-nums">{formatarNumero(e.contagem)}</span>
            <span className="text-xs text-ink-2 tabular-nums">{formatarMoeda(e.valorCentavos)}</span>
            {e.passagem !== null && (
              <span
                className="absolute top-3 right-3 rounded-pill border border-hairline bg-surface-0 px-1.5 text-xs text-ink-2 tabular-nums"
                title={`Das abertas no período que chegaram a ${ROTULO_DA_ETAPA[e.etapa]}, quantas chegaram a ${ROTULO_DA_ETAPA[ETAPAS_ABERTAS[i + 1]]}`}
              >
                <span className="sr-only">Passagem para a etapa seguinte: </span>→ {formatarPercentual(e.passagem)}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div role="group" aria-label="Etapa mostrada" className="grid grid-cols-4 gap-1 md:hidden">
        {faixa.etapas.map((e) => (
          <button
            key={e.etapa}
            type="button"
            aria-pressed={e.etapa === etapaNoCelular}
            onClick={() => aoEscolher(e.etapa)}
            className="grid rounded-control border border-hairline bg-surface-1 px-1 py-2 text-center text-ink-2 aria-pressed:border-ink-1 aria-pressed:text-ink-1"
          >
            <span className="truncate text-[11px]">{ROTULO_DA_ETAPA[e.etapa]}</span>
            <span className="font-semibold tabular-nums">{formatarNumero(e.contagem)}</span>
          </button>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <Link href={hrefDasEncerradas.ganho} className="hover:underline">
          <span className="font-semibold text-brand tabular-nums">{formatarNumero(faixa.ganhas)}</span> ganhas
        </Link>
        <Link href={hrefDasEncerradas.perdido} className="hover:underline">
          <span className="font-semibold text-ink-1 tabular-nums">{formatarNumero(faixa.perdidas)}</span> perdidas
        </Link>
        <span className="text-ink-3">no período</span>
      </p>
    </section>
  )
}
```

- [x] **Passo 5: implementar `components/crm/resumo-do-periodo.tsx`**

> Correção na execução: o KpiCard do kit tem a prop `pendente` (traço + explicação), que é o que "sem base" pede; conversão e tempo médio usam `pendente` em vez de `detail`.

```tsx
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { KpiCard } from "@/components/patterns/kpi-card"
import { PERIODOS, type PeriodoEmDias, type ResumoDoCrm } from "@/lib/crm/metricas"
import { formatarMoeda, formatarPercentual } from "@/lib/formatters/numero"

const SEM_BASE = "Nenhuma oportunidade aberta no período"
const SEM_GANHO = "Nenhuma oportunidade ganha no período"

function dias(n: number): string {
  return `${String(n).replace(".", ",")} ${n === 1 ? "dia" : "dias"}`
}

/** O que o dono olha: quanto ganhou, quanto converteu e quanto demora (spec crm-v1, "Resumo"). */
export function ResumoDoPeriodo({
  resumo,
  periodo,
  hrefDoPeriodo,
}: {
  resumo: ResumoDoCrm
  periodo: PeriodoEmDias
  hrefDoPeriodo: Record<PeriodoEmDias, string>
}) {
  return (
    <section aria-label="Resumo do período" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Período"
        atual={String(periodo)}
        segmentos={PERIODOS.map((p) => ({ valor: String(p), rotulo: `${p} dias`, href: hrefDoPeriodo[p] }))}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Valor ganho" value={formatarMoeda(resumo.valorGanhoCentavos)} />
        <KpiCard
          label="Conversão de Novo até Ganho"
          value={resumo.conversao === null ? "—" : formatarPercentual(resumo.conversao)}
          detail={resumo.conversao === null ? SEM_BASE : undefined}
        />
        <KpiCard
          label="Tempo médio até fechar"
          value={resumo.diasAteFechar === null ? "—" : dias(resumo.diasAteFechar)}
          detail={resumo.diasAteFechar === null ? SEM_GANHO : undefined}
        />
      </div>
    </section>
  )
}
```

- [x] **Passo 6: implementar `components/crm/mover-para.tsx`**

```tsx
import { etapasDeDestino } from "@/lib/crm/movimento"
import { ROTULO_DA_ETAPA, ehEtapa, type Etapa, type Oportunidade } from "@/lib/crm/tipos"

/**
 * "Mover para…", o caminho que não depende de arrastar (celular, leitor de
 * tela). Um select nativo: escolher dispara e volta ao rótulo. Ganho e
 * Perdido passam pelo pedido de fechamento, que é de quem recebe `aoMover`.
 */
export function MoverPara({ op, aoMover }: { op: Oportunidade; aoMover: (op: Oportunidade, para: Etapa) => void }) {
  const destinos = etapasDeDestino(op)
  if (destinos.length === 0) return null
  return (
    <select
      aria-label={`Mover ${op.paciente.nome ?? "oportunidade"} para…`}
      value=""
      onChange={(e) => {
        if (ehEtapa(e.target.value)) aoMover(op, e.target.value)
      }}
      className="h-8 rounded-control border border-hairline bg-surface-0 px-2 text-xs text-ink-2"
    >
      <option value="" disabled>
        Mover para…
      </option>
      {destinos.map((d) => (
        <option key={d} value={d}>
          {ROTULO_DA_ETAPA[d]}
        </option>
      ))}
    </select>
  )
}
```

- [x] **Passo 7: implementar `components/crm/painel-da-oportunidade.tsx`**

```tsx
import Link from "next/link"
import { X } from "lucide-react"
import { LinhaDoTempo, type EventoDaLinha } from "@/components/patterns/linha-do-tempo"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { StatusBadge } from "@/components/patterns/status-badge"
import { nomeDoPaciente, tituloDoEvento } from "@/lib/crm/cartao"
import { ROTULO_DA_ETAPA, ROTULO_DO_MOTIVO, type Etapa, type Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { MoverPara } from "./mover-para"

const quando = (em: string) => `${formatarDataCurta(em)}, ${formatarHora(em)}`

/**
 * O painel lateral do cartão (tela cheia no celular). Na parte 1, os campos
 * são leitura: editar procedimento, valor, responsável, próxima ação e nota
 * chega com as server actions da parte 2.
 */
export function PainelDaOportunidade({
  op,
  aoFechar,
  aoMover,
}: {
  op: Oportunidade
  aoFechar: () => void
  aoMover: (op: Oportunidade, para: Etapa) => void
}) {
  const eventos: EventoDaLinha[] = [...op.eventos].reverse().map((ev) => ({
    id: ev.id,
    instante: ev.em,
    quando: quando(ev.em),
    titulo: tituloDoEvento(ev),
    tom: ev.para === "ganho" ? "success" : ev.para === "perdido" ? "danger" : ev.autor ? "neutral" : "info",
  }))
  const encerrada = op.encerradaEm !== null

  return (
    <aside
      aria-label={`Oportunidade de ${nomeDoPaciente(op)}`}
      className="fixed inset-0 z-40 grid content-start gap-5 overflow-y-auto bg-surface-0 p-4 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:border-l md:border-hairline md:shadow-xl"
    >
      <header className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="truncate text-lg font-semibold text-ink-1">{nomeDoPaciente(op)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={op.etapa === "ganho" ? "success" : op.etapa === "perdido" ? "danger" : "neutral"}>
              {ROTULO_DA_ETAPA[op.etapa]}
            </StatusBadge>
            {!encerrada && <MoverPara op={op} aoMover={aoMover} />}
          </div>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-control p-1.5 text-ink-3 hover:bg-surface-1 hover:text-ink-1">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <ListaDeDados
        itens={[
          { termo: "Procedimento", valor: op.procedimento?.nome ?? "Não informado" },
          { termo: "Valor", valor: op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : "Não informado" },
          { termo: "Responsável", valor: op.responsavel?.nome ?? "Sem responsável" },
          { termo: "Próxima ação", valor: op.proximaAcao ? quando(op.proximaAcao) : "Nenhuma" },
          ...(op.motivoDePerda ? [{ termo: "Motivo da perda", valor: ROTULO_DO_MOTIVO[op.motivoDePerda] }] : []),
          { termo: "Aberta em", valor: quando(op.abertaEm) },
        ]}
      />

      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium text-ink-1">Nota</h3>
        <p className="text-sm whitespace-pre-line text-ink-2">{op.nota ?? "Sem nota."}</p>
      </section>

      <button
        type="button"
        disabled
        title="Protótipo: a edição chega com o backend do CRM"
        className="justify-self-start rounded-control border border-hairline px-3 py-1.5 text-sm text-ink-3"
      >
        Editar campos
      </button>

      {op.conversaId && (
        <Link href={`/dashboard/conversations?c=${op.conversaId}`} className="justify-self-start text-sm font-medium text-ink-1 underline underline-offset-2">
          Abrir conversa
        </Link>
      )}

      <LinhaDoTempo rotulo="Histórico da oportunidade" eventos={eventos} />
    </aside>
  )
}
```

- [x] **Passo 8: implementar `components/crm/lista-de-encerradas.tsx`**

```tsx
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import type { FiltroDeEncerradas } from "@/lib/crm/filtros"
import { MOTIVOS_DE_PERDA, ROTULO_DO_MOTIVO, type Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"

/** As encerradas, fora do quadro, com filtro por resultado e, em Perdidas, por motivo. */
export function ListaDeEncerradas({
  ops,
  filtro,
  hrefDe,
  aoAbrir,
}: {
  ops: readonly Oportunidade[]
  filtro: FiltroDeEncerradas
  hrefDe: (f: FiltroDeEncerradas) => string
  aoAbrir: (id: string) => void
}) {
  return (
    <section aria-label="Encerradas" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Resultado"
        atual={filtro.resultado}
        segmentos={[
          { valor: "todas", rotulo: "Todas", href: hrefDe({ resultado: "todas", motivo: null }) },
          { valor: "ganho", rotulo: "Ganhas", href: hrefDe({ resultado: "ganho", motivo: null }) },
          { valor: "perdido", rotulo: "Perdidas", href: hrefDe({ resultado: "perdido", motivo: null }) },
        ]}
      />
      {filtro.resultado === "perdido" && (
        <FiltroSegmentado
          rotulo="Motivo da perda"
          quebrar
          atual={filtro.motivo ?? "todos"}
          segmentos={[
            { valor: "todos", rotulo: "Todos", href: hrefDe({ resultado: "perdido", motivo: null }) },
            ...MOTIVOS_DE_PERDA.map((m) => ({ valor: m, rotulo: ROTULO_DO_MOTIVO[m], href: hrefDe({ resultado: "perdido", motivo: m }) })),
          ]}
        />
      )}
      {ops.length === 0 ? (
        <Vazio>Nenhuma oportunidade encerrada neste recorte.</Vazio>
      ) : (
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface-1">
          {ops.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <button type="button" onClick={() => aoAbrir(o.id)} className="min-w-0 flex-1 truncate text-left font-medium text-ink-1 hover:underline">
                {nomeDoPaciente(o)}
              </button>
              <StatusBadge tone={o.etapa === "ganho" ? "success" : "danger"}>{o.etapa === "ganho" ? "Ganho" : "Perdido"}</StatusBadge>
              <span className="text-ink-2">
                {o.etapa === "ganho"
                  ? `${o.procedimento?.nome ?? "Sem procedimento"} · ${o.valorCentavos !== null ? formatarMoeda(o.valorCentavos) : "Sem valor"}`
                  : o.motivoDePerda
                    ? ROTULO_DO_MOTIVO[o.motivoDePerda]
                    : ""}
              </span>
              <span className="text-xs text-ink-3 tabular-nums">{formatarDataCurta(o.encerradaEm!)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

Confira a prop de `Vazio` em `components/patterns/vazio.tsx`. O exemplo usa `children`, como em `busca-da-fila.tsx`.

- [x] **Passo 9: rodar** `npx vitest run components/crm`. Esperado: PASSA. Se o `title` dentro da faixa (Passo 4) quebrar o teste do `100%`, procure o texto da passagem fora do `title`.

- [x] **Passo 10: commit**

```bash
git add components/crm
git commit -m "feat(crm): cartão, faixa do funil, resumo, painel e encerradas"
```

---

### Tarefa 5: O quadro interativo — arrastar, mover, fechar e buscar

**Arquivos:**
- Modificar: `package.json` e `package-lock.json` (`@dnd-kit/core`)
- Criar: `components/crm/estado.ts`, `components/crm/pedido-de-fechamento.tsx`, `components/crm/busca-do-crm.tsx`, `components/crm/quadro.tsx` e `components/crm/tela-do-crm.tsx`
- Teste: `components/crm/estado.test.ts`, `components/crm/tela-do-crm.test.tsx`

**Interfaces:**
- Consome: as tarefas 1, 2 e 4.
- Produz:
  - `reduzirCrm(estado, evento)`, com `EstadoDoCrm = { oportunidades: Oportunidade[]; aviso: string | null }` e `EventoDoCrm = { tipo: "mover"; pedido: PedidoDeMovimento; em: string; autor: Referencia } | { tipo: "fechar-aviso" }`;
  - `ResultadoDaBuscaDoCrm = { ids: string[]; erro: string | null }`;
  - `TelaDoCrm(props: PropsDaTelaDoCrm)`, um componente cliente, com:

```ts
export type PropsDaTelaDoCrm = {
  oportunidades: Oportunidade[]
  agora: string
  eu: Referencia
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  encerradas: FiltroDeEncerradas
  procedimentos: Referencia[]
  caminho: string
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
}
```

- [x] **Passo 1: instalar a dependência**

Rode: `npm i @dnd-kit/core@6.3.1`
Esperado: `package.json` com `"@dnd-kit/core": "^6.3.1"` e nenhum aviso de peer dependency do React 19. Se o npm acusar conflito de peer, pare e relate. Não use `--force`.

- [x] **Passo 2: escrever o teste que falha**, em `components/crm/estado.test.ts`

```ts
import { describe, expect, it } from "vitest"
import type { Oportunidade } from "@/lib/crm/tipos"
import { reduzirCrm, type EstadoDoCrm } from "./estado"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

const op = (id: string, etapa: Oportunidade["etapa"]): Oportunidade => ({
  id,
  paciente: { id: `pac-${id}`, nome: id, telefone: "+5581900000001", optOut: false },
  conversaId: null,
  etapa,
  etapaDesde: AGORA,
  ultimaAtividade: AGORA,
  abertaEm: AGORA,
  encerradaEm: null,
  procedimento: null,
  valorCentavos: null,
  responsavel: null,
  proximaAcao: null,
  motivoDePerda: null,
  nota: null,
  urgente: false,
  eventos: [{ id: `${id}-e1`, de: null, para: etapa, em: AGORA, autor: null }],
})

const inicial: EstadoDoCrm = { oportunidades: [op("a", "novo"), op("b", "agendado")], aviso: "antigo" }

describe("reduzirCrm", () => {
  it("move a oportunidade pela regra da lib e limpa o aviso", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "a", de: "novo", para: "qualificado" }, em: AGORA, autor: ANA })
    expect(e.oportunidades.find((o) => o.id === "a")!.etapa).toBe("qualificado")
    expect(e.oportunidades.find((o) => o.id === "b")).toBe(inicial.oportunidades[1])
    expect(e.aviso).toBeNull()
  })

  it("etapa vista diferente: não move e avisa", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "b", de: "novo", para: "qualificado" }, em: AGORA, autor: ANA })
    expect(e.oportunidades).toBe(inicial.oportunidades)
    expect(e.aviso).toBe("Este cartão mudou de etapa antes. O quadro foi atualizado.")
  })

  it("pedido inválido: não move e avisa o motivo", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "a", de: "novo", para: "perdido" }, em: AGORA, autor: ANA })
    expect(e.oportunidades).toBe(inicial.oportunidades)
    expect(e.aviso).toBe("Escolha o motivo da perda.")
  })

  it("fechar o aviso", () => {
    expect(reduzirCrm(inicial, { tipo: "fechar-aviso" }).aviso).toBeNull()
  })
})
```

- [x] **Passo 3: implementar `components/crm/estado.ts`**

```ts
import { aplicarMovimento, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import type { Oportunidade, Referencia } from "@/lib/crm/tipos"

/**
 * O quadro no navegador. Na parte 1 é a única fonte: mover no protótipo não
 * grava nada e some ao recarregar. Na parte 2, o mesmo redutor aplica o
 * resultado da RPC.
 */
export type EstadoDoCrm = { oportunidades: Oportunidade[]; aviso: string | null }

export type EventoDoCrm =
  | { tipo: "mover"; pedido: PedidoDeMovimento; em: string; autor: Referencia }
  | { tipo: "fechar-aviso" }

export function reduzirCrm(e: EstadoDoCrm, ev: EventoDoCrm): EstadoDoCrm {
  if (ev.tipo === "fechar-aviso") return { ...e, aviso: null }
  const alvo = e.oportunidades.find((o) => o.id === ev.pedido.oportunidadeId)
  const r = validarMovimento(alvo, ev.pedido)
  if (r.status !== "ok") return { ...e, aviso: mensagemDoMovimento(r) }
  return {
    oportunidades: e.oportunidades.map((o) => (o === alvo ? aplicarMovimento(o, ev.pedido, ev.em, ev.autor) : o)),
    aviso: null,
  }
}
```

- [x] **Passo 4: rodar** `npx vitest run components/crm/estado.test.ts`. Esperado: PASSA.

- [x] **Passo 5: implementar `components/crm/pedido-de-fechamento.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Botao, Campo, Input, Select } from "@/components/patterns/formulario"
import { lerValorEmCentavos, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import { MOTIVOS_DE_PERDA, ROTULO_DO_MOTIVO, ehMotivoDePerda, type Oportunidade, type Referencia } from "@/lib/crm/tipos"

/**
 * Ganho pede procedimento e valor; Perdido pede o motivo da lista. É um
 * <dialog> nativo: foco preso, Esc fecha, nada de alert(). O pedido só sai
 * se a regra da lib aceita.
 */
export function PedidoDeFechamento({
  op,
  para,
  procedimentos,
  aoConfirmar,
  aoCancelar,
}: {
  op: Oportunidade
  para: "ganho" | "perdido"
  procedimentos: readonly Referencia[]
  aoConfirmar: (pedido: PedidoDeMovimento) => void
  aoCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    const pedido: PedidoDeMovimento = { oportunidadeId: op.id, de: op.etapa, para }
    if (para === "ganho") {
      pedido.procedimento = procedimentos.find((p) => p.id === dados.get("procedimento")) ?? null
      pedido.valorCentavos = lerValorEmCentavos(String(dados.get("valor") ?? ""))
    } else {
      const motivo = dados.get("motivo")
      pedido.motivo = ehMotivoDePerda(motivo) ? motivo : null
    }
    const r = validarMovimento(op, pedido)
    if (r.status !== "ok") return setErro(mensagemDoMovimento(r))
    aoConfirmar(pedido)
  }

  return (
    <dialog
      ref={ref}
      onClose={aoCancelar}
      aria-labelledby="fechamento-titulo"
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-panel border border-hairline bg-surface-0 p-0 text-ink-1 backdrop:bg-black/40"
    >
      <form onSubmit={confirmar} className="grid gap-4 p-5">
        <h2 id="fechamento-titulo" className="text-base font-semibold">
          {para === "ganho" ? "Marcar como Ganho" : "Marcar como Perdido"}: {nomeDoPaciente(op)}
        </h2>
        {para === "ganho" ? (
          <>
            <Campo label="Procedimento fechado">
              <Select name="procedimento" defaultValue={op.procedimento?.id ?? ""} required>
                <option value="" disabled>
                  Escolha
                </option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Valor fechado (R$)" hint="Ex.: 1.200,00">
              <Input
                name="valor"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={op.valorCentavos !== null ? (op.valorCentavos / 100).toFixed(2).replace(".", ",") : ""}
                required
              />
            </Campo>
          </>
        ) : (
          <Campo label="Motivo da perda">
            <Select name="motivo" defaultValue="" required>
              <option value="" disabled>
                Escolha
              </option>
              {MOTIVOS_DE_PERDA.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_DO_MOTIVO[m]}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        {erro && (
          <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => ref.current?.close()}>
            Cancelar
          </Botao>
          <Botao type="submit">Confirmar</Botao>
        </div>
      </form>
    </dialog>
  )
}
```

Confira em `components/patterns/formulario.tsx` o nome das variantes do `Botao`: `"secundario"` já é usado em `busca-da-fila.tsx`, e o padrão sem variante é o primário.

- [x] **Passo 6: implementar `components/crm/busca-do-crm.tsx`**

```tsx
"use client"

import { useRef, useState, type FormEvent } from "react"
import { Search } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"

export type ResultadoDaBuscaDoCrm = { ids: string[]; erro: string | null }

/**
 * A busca por paciente. O termo fica só no estado desta tela e vai ao
 * servidor no corpo de um POST (server action): o campo não tem `name`, e
 * nem um envio sem JavaScript o leva para a URL (lgpd-security, regra 1).
 * Devolve os ids que casam, ou null para "sem busca".
 */
export function BuscaDoCrm({
  buscar,
  aoResultado,
}: {
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
  aoResultado: (r: ResultadoDaBuscaDoCrm | null) => void
}) {
  const [termo, setTermo] = useState("")
  const [ativa, setAtiva] = useState(false)
  const ultimo = useRef(0)

  async function procurar(e: FormEvent) {
    e.preventDefault()
    const t = termo.trim()
    if (!t) return limpar()
    const pedido = ++ultimo.current
    const r = await buscar(t).catch(() => ({ ids: [], erro: "Não foi possível buscar. Tente de novo." }))
    // Só a resposta da última busca pedida conta.
    if (pedido !== ultimo.current) return
    setAtiva(true)
    aoResultado(r)
  }

  function limpar() {
    ultimo.current++
    setTermo("")
    setAtiva(false)
    aoResultado(null)
  }

  return (
    <form role="search" onSubmit={procurar} className="flex items-center gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar paciente por nome ou telefone</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            if (!e.target.value.trim() && ativa) limpar()
          }}
          placeholder="Buscar paciente"
          autoComplete="off"
          maxLength={80}
          className="h-9 w-full rounded-control border border-hairline bg-surface-0/60 pr-3 pl-9 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20"
        />
      </label>
      {ativa && (
        <Botao type="button" variante="secundario" onClick={limpar} className="h-9">
          Limpar
        </Botao>
      )}
    </form>
  )
}
```

- [x] **Passo 7: implementar `components/crm/quadro.tsx`**

```tsx
"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVertical } from "lucide-react"
import { Vazio } from "@/components/patterns/vazio"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import { ETAPAS_ABERTAS, ROTULO_DA_ETAPA, ehEtapaAberta, type Etapa, type EtapaAberta, type Oportunidade } from "@/lib/crm/tipos"
import { cn } from "@/lib/utils"
import { CartaoDaOportunidade } from "./cartao-da-oportunidade"
import { MoverPara } from "./mover-para"

const COLUNA = "coluna:"

/** O que o leitor de tela ouve ao arrastar pelo teclado, em português. */
function anuncios(ops: readonly Oportunidade[]): Announcements {
  const nome = (id: string | number) => {
    const o = ops.find((x) => x.id === id)
    return o ? nomeDoPaciente(o) : "Oportunidade"
  }
  const etapa = (id: string | number | undefined) => {
    const e = String(id ?? "").replace(COLUNA, "")
    return ehEtapaAberta(e) ? ROTULO_DA_ETAPA[e] : "fora do quadro"
  }
  return {
    onDragStart: ({ active }) => `${nome(active.id)} pega. Use as setas para escolher a coluna, espaço para soltar, Esc para cancelar.`,
    onDragOver: ({ active, over }) => `${nome(active.id)} sobre ${etapa(over?.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `${nome(active.id)} solta em ${etapa(over.id)}.` : `${nome(active.id)} solta fora do quadro.`),
    onDragCancel: ({ active }) => `Movimento de ${nome(active.id)} cancelado.`,
  }
}

const INSTRUCOES =
  "Para mover um cartão, foque a alça e aperte espaço. Use as setas para trocar de coluna e espaço de novo para soltar. Esc cancela."

function Arrastavel({ op, children }: { op: Oportunidade; children: (alca: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: op.id })
  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastar ${nomeDoPaciente(op)}`}
      className="hidden cursor-grab rounded-control p-0.5 text-ink-3 hover:text-ink-1 md:block"
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("list-none", isDragging && "relative z-10 opacity-80")}
    >
      {children(alca)}
    </li>
  )
}

function Coluna({ etapa, visivelNoCelular, children, vazia }: { etapa: EtapaAberta; visivelNoCelular: boolean; children: React.ReactNode; vazia: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUNA}${etapa}` })
  return (
    <section
      ref={setNodeRef}
      aria-label={ROTULO_DA_ETAPA[etapa]}
      className={cn(
        "min-h-40 flex-col gap-2 rounded-card border border-transparent p-1",
        visivelNoCelular ? "flex" : "hidden md:flex",
        isOver && "border-dashed border-hairline bg-surface-1/60",
      )}
    >
      <h2 className="sr-only">{ROTULO_DA_ETAPA[etapa]}</h2>
      {vazia ? <Vazio>Nenhuma oportunidade aqui.</Vazio> : <ul className="grid gap-2">{children}</ul>}
    </section>
  )
}

/**
 * As quatro colunas abertas (spec crm-v1, "Quadro" e "Mover"). Arrastar no
 * desktop, pelo mouse ou pelo teclado (KeyboardSensor); no celular, uma
 * coluna por vez e o "Mover para…" do cartão.
 */
export function Quadro({
  ops,
  agora,
  etapaNoCelular,
  aoAbrir,
  aoMover,
}: {
  ops: readonly Oportunidade[]
  agora: string
  etapaNoCelular: EtapaAberta
  aoAbrir: (id: string) => void
  aoMover: (op: Oportunidade, para: Etapa) => void
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  function soltar({ active, over }: DragEndEvent) {
    if (!over) return
    const para = String(over.id).replace(COLUNA, "")
    const op = ops.find((o) => o.id === active.id)
    if (!op || !ehEtapaAberta(para) || para === op.etapa) return
    aoMover(op, para)
  }

  return (
    <DndContext
      sensors={sensores}
      onDragEnd={soltar}
      accessibility={{ announcements: anuncios(ops), screenReaderInstructions: { draggable: INSTRUCOES } }}
    >
      <div className="grid gap-3 md:grid-cols-4">
        {ETAPAS_ABERTAS.map((etapa) => {
          const nela = ops.filter((o) => o.etapa === etapa)
          return (
            <Coluna key={etapa} etapa={etapa} visivelNoCelular={etapa === etapaNoCelular} vazia={nela.length === 0}>
              {nela.map((op) => (
                <Arrastavel key={op.id} op={op}>
                  {(alca) => (
                    <div className="grid gap-1">
                      <CartaoDaOportunidade op={op} agora={agora} aoAbrir={aoAbrir} alca={alca} />
                      <MoverPara op={op} aoMover={aoMover} />
                    </div>
                  )}
                </Arrastavel>
              ))}
            </Coluna>
          )
        })}
      </div>
    </DndContext>
  )
}
```

- [x] **Passo 8: implementar `components/crm/tela-do-crm.tsx`**

```tsx
"use client"

import { useMemo, useReducer, useState } from "react"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { PageHeader } from "@/components/patterns/page-header"
import { filtrarEncerradas, filtrarPorResponsavel, hrefDoCrm, type FiltroDeEncerradas, type FiltroDeResponsavel, type Vista } from "@/lib/crm/filtros"
import { faixaDoFunil, PERIODOS, resumoDoPeriodo, type PeriodoEmDias } from "@/lib/crm/metricas"
import type { PedidoDeMovimento } from "@/lib/crm/movimento"
import type { Etapa, EtapaAberta, Oportunidade, Referencia } from "@/lib/crm/tipos"
import { BuscaDoCrm, type ResultadoDaBuscaDoCrm } from "./busca-do-crm"
import { reduzirCrm } from "./estado"
import { FaixaDoFunil } from "./faixa-do-funil"
import { ListaDeEncerradas } from "./lista-de-encerradas"
import { PainelDaOportunidade } from "./painel-da-oportunidade"
import { PedidoDeFechamento } from "./pedido-de-fechamento"
import { Quadro } from "./quadro"
import { ResumoDoPeriodo } from "./resumo-do-periodo"

export type PropsDaTelaDoCrm = {
  oportunidades: Oportunidade[]
  agora: string
  eu: Referencia
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  encerradas: FiltroDeEncerradas
  procedimentos: Referencia[]
  caminho: string
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
}

/**
 * A tela do CRM (spec crm-v1, "A tela"). Responde primeiro quantos estão em
 * cada etapa, quanto isso vale e o que está parado. Os números saem do
 * estado do navegador: mover um cartão atualiza a faixa na hora.
 */
export function TelaDoCrm(p: PropsDaTelaDoCrm) {
  const [estado, despachar] = useReducer(reduzirCrm, { oportunidades: p.oportunidades, aviso: null })
  const [aberta, setAberta] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{ op: Oportunidade; para: "ganho" | "perdido" } | null>(null)
  const [etapaNoCelular, setEtapaNoCelular] = useState<EtapaAberta>("novo")
  const [busca, setBusca] = useState<ResultadoDaBuscaDoCrm | null>(null)

  const doResponsavel = useMemo(
    () => filtrarPorResponsavel(estado.oportunidades, p.responsavel, p.eu.id),
    [estado.oportunidades, p.responsavel, p.eu.id],
  )
  const visiveis = busca && !busca.erro ? doResponsavel.filter((o) => busca.ids.includes(o.id)) : doResponsavel
  const faixa = faixaDoFunil(doResponsavel, p.agora, p.periodo)
  const resumo = resumoDoPeriodo(doResponsavel, p.agora, p.periodo)
  const base = { periodo: p.periodo, responsavel: p.responsavel, vista: p.vista, resultado: p.encerradas.resultado, motivo: p.encerradas.motivo }
  const opAberta = estado.oportunidades.find((o) => o.id === aberta) ?? null

  function mover(pedido: PedidoDeMovimento) {
    despachar({ tipo: "mover", pedido, em: p.agora, autor: p.eu })
  }

  function aoMover(op: Oportunidade, para: Etapa) {
    if (para === "ganho" || para === "perdido") return setFechando({ op, para })
    mover({ oportunidadeId: op.id, de: op.etapa, para })
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="CRM" description="O funil comercial da clínica: de quem escreveu até quem fechou." />

      <ResumoDoPeriodo
        resumo={resumo}
        periodo={p.periodo}
        hrefDoPeriodo={Object.fromEntries(PERIODOS.map((d) => [d, hrefDoCrm(p.caminho, { ...base, periodo: d })])) as Record<PeriodoEmDias, string>}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
        <BuscaDoCrm buscar={p.buscar} aoResultado={setBusca} />
        <FiltroSegmentado
          rotulo="Responsável"
          atual={p.responsavel}
          segmentos={(["todos", "meus", "sem"] as const).map((r) => ({
            valor: r,
            rotulo: r === "todos" ? "Todos" : r === "meus" ? "Meus" : "Sem responsável",
            href: hrefDoCrm(p.caminho, { ...base, responsavel: r }),
          }))}
        />
        <FiltroSegmentado
          rotulo="Vista"
          atual={p.vista}
          segmentos={[
            { valor: "quadro", rotulo: "Quadro", href: hrefDoCrm(p.caminho, { ...base, vista: "quadro" }) },
            { valor: "encerradas", rotulo: "Encerradas", href: hrefDoCrm(p.caminho, { ...base, vista: "encerradas" }) },
          ]}
        />
      </div>

      {busca?.erro && (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {busca.erro}
        </p>
      )}

      {estado.aviso && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          {estado.aviso}
          <button type="button" onClick={() => despachar({ tipo: "fechar-aviso" })} className="font-medium underline">
            Fechar
          </button>
        </p>
      )}

      {p.vista === "quadro" ? (
        <>
          <FaixaDoFunil
            faixa={faixa}
            etapaNoCelular={etapaNoCelular}
            aoEscolher={setEtapaNoCelular}
            hrefDasEncerradas={{
              ganho: hrefDoCrm(p.caminho, { ...base, vista: "encerradas", resultado: "ganho", motivo: null }),
              perdido: hrefDoCrm(p.caminho, { ...base, vista: "encerradas", resultado: "perdido", motivo: null }),
            }}
          />
          <Quadro ops={visiveis.filter((o) => o.encerradaEm === null)} agora={p.agora} etapaNoCelular={etapaNoCelular} aoAbrir={setAberta} aoMover={aoMover} />
        </>
      ) : (
        <ListaDeEncerradas
          ops={filtrarEncerradas(visiveis, p.encerradas)}
          filtro={p.encerradas}
          hrefDe={(f) => hrefDoCrm(p.caminho, { ...base, vista: "encerradas", ...f })}
          aoAbrir={setAberta}
        />
      )}

      {opAberta && <PainelDaOportunidade op={opAberta} aoFechar={() => setAberta(null)} aoMover={aoMover} />}

      {fechando && (
        <PedidoDeFechamento
          op={fechando.op}
          para={fechando.para}
          procedimentos={p.procedimentos}
          aoCancelar={() => setFechando(null)}
          aoConfirmar={(pedido) => {
            mover(pedido)
            setFechando(null)
          }}
        />
      )}
    </div>
  )
}
```

- [x] **Passo 9: escrever `components/crm/tela-do-crm.test.tsx`**

```tsx
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Oportunidade } from "@/lib/crm/tipos"
import { TelaDoCrm, type PropsDaTelaDoCrm } from "./tela-do-crm"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

function op(id: string, nome: string, etapa: Oportunidade["etapa"], p: Partial<Oportunidade> = {}): Oportunidade {
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome, telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa,
    etapaDesde: AGORA,
    ultimaAtividade: AGORA,
    abertaEm: AGORA,
    encerradaEm: final ? AGORA : null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: etapa === "perdido" ? "preco" : null,
    nota: null,
    urgente: false,
    eventos: [{ id: `${id}-e1`, de: null, para: etapa, em: AGORA, autor: null }],
    ...p,
  }
}

const props = (p: Partial<PropsDaTelaDoCrm> = {}): PropsDaTelaDoCrm => ({
  oportunidades: [
    op("a", "Ana Aberta", "novo", { responsavel: ANA }),
    op("b", "Bruno Agendado", "agendado"),
    op("g", "Gabi Ganha", "ganho", { procedimento: { id: "p", nome: "Clareamento dental" }, valorCentavos: 120000 }),
  ],
  agora: AGORA,
  eu: ANA,
  periodo: 30,
  responsavel: "todos",
  vista: "quadro",
  encerradas: { resultado: "todas", motivo: null },
  procedimentos: [],
  caminho: "/dashboard/crm",
  buscar: async () => ({ ids: [], erro: null }),
  ...p,
})

describe("TelaDoCrm", () => {
  it("quadro: as abertas nas colunas, a encerrada fora; filtros na URL sem termo de busca", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} />)
    expect(h).toContain("Ana Aberta")
    expect(h).toContain("Bruno Agendado")
    expect(h).not.toContain("Gabi Ganha")
    expect(h).toContain('href="/dashboard/crm?periodo=7"')
    expect(h).toContain('href="/dashboard/crm?responsavel=meus"')
    expect(h).toContain('href="/dashboard/crm?vista=encerradas&amp;resultado=ganho"')
    expect(h).not.toMatch(/[?&]q=/)
    // O campo de busca não tem name: um envio sem JS não o leva para a URL.
    expect(h).not.toMatch(/<input[^>]*type="search"[^>]*name=/)
  })

  it("meus: só as do usuário", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props({ responsavel: "meus" })} />)
    expect(h).toContain("Ana Aberta")
    expect(h).not.toContain("Bruno Agendado")
  })

  it("encerradas: a lista no lugar do quadro", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props({ vista: "encerradas" })} />)
    expect(h).toContain("Gabi Ganha")
    expect(h).not.toContain("Ana Aberta")
  })

  it("no celular, só a coluna Novo aparece de início", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} />)
    expect(h).toMatch(/aria-label="Novo" class="(?![^"]*hidden)[^"]*"/)
    expect(h).toMatch(/aria-label="Agendado" class="[^"]*hidden md:flex/)
  })
})
```

- [x] **Passo 10: rodar** `npx vitest run components/crm`. Esperado: PASSA. Se o `DndContext` reclamar de `document` no ambiente `node`, envolva só o `renderToStaticMarkup` deste arquivo com `// @vitest-environment jsdom` **somente se** `jsdom` já for dependência. Senão, relate: não instale o `jsdom` sem decidir.

> Correção na execução: o `PainelDaOportunidade` (T4) virou um `<dialog>` nativo aberto com `showModal()` (Esc, foco preso, fundo inerte, devolução de foco). Na revisão da T5: `DndContext` ganhou `id="crm-quadro"` (hidratação), o `KeyboardSensor` usa `pularDeColuna` (setas trocam de coluna) e `PedidoDeFechamento` fecha o diálogo antes de confirmar.

- [x] **Passo 11: commit**

```bash
git add package.json package-lock.json components/crm
git commit -m "feat(crm): quadro com arrastar, mover para, fechamento e busca"
```

---

### Tarefa 6: Menu, página e busca da demonstração

**Arquivos:**
- Modificar: `lib/navigation/dashboard-nav.ts` (item "CRM" em Operação, depois de Conversas) e `lib/navigation/navigation.test.ts`
- Criar: `app/(dashboard)/dashboard/crm/page.tsx`, `app/(dashboard)/dashboard/crm/acoes.ts`, `app/(dashboard)/dashboard/crm/loading.tsx`
- Teste: `app/(dashboard)/dashboard/crm/acoes.test.ts`

**Interfaces:**
- Consome: `TelaDoCrm`, `ResultadoDaBuscaDoCrm` (tarefa 5); `OPORTUNIDADES` e `PROCEDIMENTOS_DO_CRM` (tarefa 3); `MEMBROS` (`app/_fixtures/equipe.ts`); `requireClinicContext()` → `{ role, isDemo, clinicId }`; `podeAcessar(role, rota)`; `relogioDaDemonstracao(AGORA)`; `PermissaoNegada({ titulo, rota, role, demo })`.
- Produz: a rota `/dashboard/crm` e a action `buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm>`.

- [x] **Passo 1: escrever o teste do menu que falha.** Em `lib/navigation/navigation.test.ts`, num `describe` novo no fim do arquivo:

```ts
describe("CRM no menu (spec crm-v1)", () => {
  it("em Operação, logo abaixo de Conversas, para owner e staff, ainda em breve", () => {
    const operacao = DASHBOARD_NAV.find((g) => g.label === "Operação")!
    const hrefs = operacao.items.map((i) => i.href)
    expect(hrefs.indexOf("/dashboard/crm")).toBe(hrefs.indexOf("/dashboard/conversations") + 1)
    const crm = operacao.items.find((i) => i.href === "/dashboard/crm")!
    expect(crm).toMatchObject({ label: "CRM", status: "em-breve", roles: ["owner", "staff"] })
  })

  it("o profissional não vê o item; na demonstração ele abre", () => {
    const itens = (role: "owner" | "staff" | "professional", demo: boolean) =>
      resolveDashboardNav(role, "/dashboard", { demo }).flatMap((g) => g.items)
    expect(itens("professional", true).some((i) => i.href === "/dashboard/crm")).toBe(false)
    expect(itens("staff", true).find((i) => i.href === "/dashboard/crm")?.status).toBe("pronto")
    expect(itens("staff", false).find((i) => i.href === "/dashboard/crm")?.status).toBe("em-breve")
  })
})
```

Rode `npx vitest run lib/navigation/navigation.test.ts`. Esperado: FALHA nos dois testes novos.

> Correção na execução: três testes existentes de `navigation.test.ts` contavam os itens de Operação sem o CRM (Operação do owner, staff e "em breve" fora da demonstração); atualizados para incluir "CRM" depois de Conversas, como o passo 2 do plano já previa.

- [x] **Passo 2: acrescentar o item** em `lib/navigation/dashboard-nav.ts`, no grupo "Operação", logo depois de Conversas:

```ts
      {
        // spec crm-v1. Parte 1 só na demonstração; a tela real chega na parte 2.
        label: "CRM",
        href: "/dashboard/crm",
        status: "em-breve",
        roles: ["owner", "staff"],
      },
```

Rode `npx vitest run lib/navigation`. Esperado: PASSA. Se outro teste do menu contar itens de Operação, atualize o número e anote no commit.

- [x] **Passo 3: escrever o teste da action que falha**, em `app/(dashboard)/dashboard/crm/acoes.test.ts`

```ts
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: { role: "staff", isDemo: true, clinicId: "c" } as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))

import { requireClinicContext } from "@/lib/auth/context"
import { buscar } from "./acoes"

beforeEach(() => {
  ctx.valor = { role: "staff", isDemo: true, clinicId: "c" }
  vi.mocked(requireClinicContext).mockClear()
})

describe("buscar (CRM, demonstração)", () => {
  it("acha pelo nome, nas oportunidades de exemplo", async () => {
    const r = await buscar("mariana")
    expect(r.erro).toBeNull()
    expect(r.ids).toEqual(expect.arrayContaining(["op-08", "op-12"]))
  })

  it("fora da demonstração não há fixture", async () => {
    ctx.valor = { role: "owner", isDemo: false, clinicId: "c" }
    expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
  })

  it("o profissional não busca", async () => {
    ctx.valor = { role: "professional", isDemo: true, clinicId: "c" }
    expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
  })

  it("termo inválido não chega a ler a sessão", async () => {
    for (const termo of [42, "", "   ", "x".repeat(81)]) {
      expect((await buscar(termo)).erro).toBe("Busque por um nome ou por parte do telefone.")
    }
    expect(requireClinicContext).not.toHaveBeenCalled()
  })

  it("a falha não leva o termo para o log", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(requireClinicContext).mockRejectedValueOnce(new Error("sessão caiu"))
    const r = await buscar("Mariana Araújo")
    expect(r).toEqual({ ids: [], erro: "Não foi possível buscar. Tente de novo." })
    expect(JSON.stringify(espiao.mock.calls)).not.toContain("Mariana")
    espiao.mockRestore()
  })
})

describe("página do CRM", () => {
  const pagina = readFileSync("app/(dashboard)/dashboard/crm/page.tsx", "utf8")
  it("nunca lê ?q=", () => {
    expect(pagina).not.toMatch(/\.q\b|\[["']q["']\]/)
  })
})
```

Rode `npx vitest run "app/(dashboard)/dashboard/crm/acoes.test.ts"`. Esperado: FALHA, por faltar o `./acoes`.

- [x] **Passo 4: implementar `app/(dashboard)/dashboard/crm/acoes.ts`**

```ts
"use server"

import { z } from "zod"
import type { ResultadoDaBuscaDoCrm } from "@/components/crm/busca-do-crm"
import { requireClinicContext } from "@/lib/auth/context"
import { idsQueCasam } from "@/lib/crm/busca"
import { podeAcessar } from "@/lib/navigation/acesso"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { OPORTUNIDADES } from "@/app/_fixtures/crm"

const ROTA = "/dashboard/crm"
const TERMO = z.string().trim().min(1).max(80)

/**
 * A busca do CRM por nome ou telefone. O termo chega no corpo deste POST e
 * não vai a URL, log nem mensagem de erro (lgpd-security, regra 1).
 *
 * Parte 1: só a conta de demonstração tem oportunidades, as de exemplo.
 * A action é um POST público, então o desvio da demonstração e a trava de
 * papel ficam aqui, e não só na página.
 */
export async function buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm> {
  const t = TERMO.safeParse(termo)
  if (!t.success) return { ids: [], erro: "Busque por um nome ou por parte do telefone." }

  try {
    const { role, isDemo } = await requireClinicContext()
    if (!isDemo || !podeAcessar(role, ROTA)) return { ids: [], erro: null }
    return { ids: idsQueCasam(OPORTUNIDADES, t.data), erro: null }
  } catch (erro) {
    console.error("Falha na busca do CRM", erroParaLog(erro))
    return { ids: [], erro: "Não foi possível buscar. Tente de novo." }
  }
}
```

Se `" ".repeat(81)` passasse pelo `trim()` e virasse vazio, o `min(1)` recusaria do mesmo jeito. O teste com 81 `x` cobre o máximo.

- [x] **Passo 5: implementar `app/(dashboard)/dashboard/crm/page.tsx`**

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { requireClinicContext } from "@/lib/auth/context"
import { lerFiltroDeEncerradas, lerPeriodo, lerResponsavel, lerVista } from "@/lib/crm/filtros"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { AGORA } from "@/app/_fixtures/agora"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "@/app/_fixtures/crm"
import { MEMBROS } from "@/app/_fixtures/equipe"
import { buscar } from "./acoes"

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/crm"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * O funil comercial (spec crm-v1). Parte 1: só na conta de demonstração,
 * com as oportunidades de exemplo trazidas para hoje. A tela real chega na
 * parte 2. A busca é por POST (`buscar`): `?q=` nunca é lido.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="CRM" rota={ROTA} role={role} demo />
  }

  const params = await searchParams
  const relogio = relogioDaDemonstracao(AGORA)
  // "Meus" na demonstração é o membro marcado como "você" na equipe de exemplo.
  const eu = MEMBROS.find((m) => m.voce) ?? MEMBROS[0]

  return (
    <TelaDoCrm
      oportunidades={relogio.deslocar(OPORTUNIDADES)}
      agora={relogio.agora}
      eu={{ id: eu.id, nome: eu.nome }}
      periodo={lerPeriodo(texto(params.periodo))}
      responsavel={lerResponsavel(texto(params.responsavel))}
      vista={lerVista(texto(params.vista))}
      encerradas={lerFiltroDeEncerradas(texto(params.resultado), texto(params.motivo))}
      procedimentos={PROCEDIMENTOS_DO_CRM}
      caminho={ROTA}
      buscar={buscar}
    />
  )
}
```

- [x] **Passo 6: `loading.tsx`.** Copie `app/(dashboard)/dashboard/sequences/loading.tsx` para `app/(dashboard)/dashboard/crm/loading.tsx`. Se ele não existir, use o de `conversations`. Troque só o título e o rótulo para "CRM".

- [x] **Passo 7: rodar** `npx vitest run "app/(dashboard)/dashboard/crm" lib/navigation tests/architecture tests/demo`. Esperado: PASSA. A trava `rotas.test.ts` exige o `if (!isDemo) notFound()` na página, e a `prototipos.test.ts` exige `isDemo` na página e na action que importam fixture.

- [x] **Passo 8: `npx tsc --noEmit`.** Esperado: sem erro.

- [x] **Passo 9: commit**

```bash
git add lib/navigation "app/(dashboard)/dashboard/crm"
git commit -m "feat(crm): rota /dashboard/crm na conta de demonstração, com busca por POST"
```

---

### Tarefa 7: Revisão visual no navegador

Carregue `ui-ux` e `frontend-design` antes.

- **Servidor:** `npm run build` e depois `npx next start -p 3100`. Antes, confira se não há um `next start` antigo na porta 3100.
- **Captura:** copie `docs/design/shot-referencia.mjs` para o scratchpad e rode `npm i playwright-core@1` lá. Use o papel `clinica` (conta de demonstração) e `BASE=http://localhost:3100`. Telas:
  - `/dashboard/crm`, `/dashboard/crm?periodo=7`, `/dashboard/crm?vista=encerradas` e `/dashboard/crm?vista=encerradas&resultado=perdido`;
  - nos dois temas, em 1440 e 390 px.
- **Conferir:**
  - a faixa alinhada às quatro colunas no desktop, e no celular o seletor de etapa trocando a coluna;
  - nenhuma rolagem horizontal em 390 px (`document.documentElement.scrollWidth <= 390`);
  - verde só em Ganho, e o alerta de "parado" legível nos dois temas;
  - o painel lateral aberto (clique no nome de `op-08`), com a linha do tempo e "Abrir conversa" levando à conversa `c-humano`;
  - mover `op-01` de Novo para Qualificado, pelo menu e arrastando, e a faixa atualizando;
  - **teclado:** Tab até a alça de `op-01`, espaço, seta para a direita, espaço; o cartão muda de coluna e o anúncio sai em português;
  - "Mover para… → Ganho" abre o diálogo, recusa valor vazio e aceita "1.200,00"; "Perdido" pede o motivo;
  - a busca por "mariana" filtra o quadro, e a URL continua sem o termo.
- **Fora da demonstração:** com uma conta de clínica comum, `/dashboard/crm` dá 404 e o menu mostra "CRM" como "em breve". Se não houver credencial de clínica comum no script, este ponto fica coberto por `tests/architecture/rotas.test.ts` e pela página, e isso tem de ficar anotado como não conferido no navegador.
- Se o login da demonstração não funcionar, a revisão fica **pendente com o Jhones**, como na parte 5b, e isso entra no relatório e no `docs/status.md`.
- [ ] Corrigir o que a captura mostrar, rodar `npx vitest run components/crm lib/crm` e fazer o commit `fix(crm): ajustes da revisão visual`, se houver.

---

### Tarefa 8: Documentação e verificação final

**Arquivos:**
- Modificar: `docs/status.md`, `docs/specs/crm-v1.md` (marcar o critério da parte 1), `docs/specs/demo-account-v1.md` (tela nova na tabela), `docs/roadmap.md` (CRM próprio antes da fase 6, se ainda não estiver lá) e `.claude/skills/architecture/SKILL.md` (módulo `lib/crm`, uma linha)

- [ ] **Passo 1: verificação completa**, nesta ordem e lendo cada saída:
  - `npx vitest run` inteiro, em segundo plano e com timeout longo, gravando num arquivo do scratchpad com o commit no topo e `echo exit=$?` no fim;
  - `npx tsc --noEmit`;
  - `npm run lint`, se existir no `package.json`;
  - `npm run build`.
- [ ] **Passo 2: pedir a revisão do `qa-reviewer`** sobre o diff desde o início da sessão, e corrigir com teste o que ele achar. O `security-reviewer` só é necessário se a revisão de QA apontar dado de paciente fora da fixture. A parte 1 não toca banco nem dado real.
- [ ] **Passo 3: atualizar a documentação:**
  - `docs/status.md`: CRM próprio com "parte 1 pronta (protótipo na demonstração)"; próxima sessão = plano da parte 2 (backend); pendências da tarefa 7 que ficaram com o Jhones;
  - `docs/specs/crm-v1.md`: marcar `[x]` nos critérios da parte 1 que foram conferidos e deixar `[ ]`, com a razão ao lado, os que ficaram pendentes;
  - `docs/specs/demo-account-v1.md`: a linha do CRM na tabela de telas da demonstração;
  - `.claude/skills/architecture/SKILL.md`: `lib/crm/` (regras puras do funil, compartilhadas entre protótipo e backend).
- [ ] **Passo 4: commit e push da `staging`**

```bash
git add docs .claude/skills/architecture/SKILL.md
git commit -m "docs(crm): parte 1 pronta, status e specs atualizados"
git push origin staging
```

- [ ] **Passo 5:** abrir um PR de `staging` para `main` com o resumo da parte 1, as pendências e a lista de commits, **sem merge**.

---

## Autorrevisão (feita ao escrever o plano)

- **Cobertura da spec (parte 1):**
  - menu Operação/abaixo de Conversas/owner+staff/profissional negado → T6;
  - 404 fora da demonstração e "em breve" → T6 (+ travas existentes);
  - faixa com contagem, valor e passagem → T2 e T4;
  - resumo do período → T2 e T4;
  - cartão com selos → T2 e T4;
  - arrastar, "Mover para…", Ganho e Perdido com os campos, transições como regra pura → T1 e T5;
  - painel → T4;
  - busca por POST → T5 e T6;
  - fixtures nas travas → T3;
  - capturas e teclado → T7;
  - encerradas com filtro → T2 e T4;
  - filtros na URL → T2 e T5;
  - celular → T4, T5 e T7;
  - datas por `lib/formatters` → T4.
- **Fora desta parte, de propósito:**
  - selo "Pro" no Starter e trava de plano (a demonstração é HealthTech; entra na parte 2 com a trava na lib);
  - edição de procedimento, valor, responsável, próxima ação e nota (server actions e cifragem da parte 2; aqui os campos são leitura, com o botão desabilitado);
  - o tempo real.
- **Arrastar para Ganho e Perdido:** a spec põe só as quatro etapas abertas como colunas, e então fechar é sempre pelo "Mover para…", que abre o diálogo. Arrastar para a contagem de Ganho e Perdido fica de fora.
