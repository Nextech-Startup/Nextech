# Motor de conversa, parte 2 (decisão e resposta da IA): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. Carregue `supabase-postgres-best-practices` antes da tarefa 6. Os passos usam checkbox (`- [ ]`).

## Status da execução: ⬜ não iniciado

**Objetivo:** a mensagem do paciente que a parte 1 grava passa a ter resposta. A IA decide se responde (agente no ar, urgência, janela, humano atendendo, retomada em 24h), agrupa mensagens seguidas, gera a resposta pelo OpenRouter, envia pela Cloud API (contra mock), registra o custo e conta o atendimento. Falha da IA ou do envio passa a conversa para a equipe, sem mandar nada ao paciente. Entra também a prova de posse do número na conexão, a raiz do achado S1 da parte 1.

**Arquitetura:**
- **Regras puras**, cada uma com teste e sem banco nem relógio:
  - `lib/conversations/`: decisão, custo e entrega;
  - `lib/agent-config/prompt.ts`: o que o modelo recebe;
  - `lib/ai/retentativa.ts`: a política de novas tentativas.
- **Clients HTTP** em `lib/ai/client.ts` (OpenRouter) e `lib/whatsapp/client.ts` (Cloud API). Cada um recebe `fetch` por opção, para o teste, e nunca põe prompt, texto, telefone nem token numa mensagem de erro.
- **Gravação atômica** em funções SQL: reservar a resposta, confirmar o envio (com a contagem da sessão) e registrar a falha.
- **Orquestração** em `lib/conversations/resposta.ts`, com as dependências externas (gerar, enviar, dormir e agora) injetáveis.
- **Rota:** agenda a resposta com `after()` e lê os status de entrega.

**Tecnologias:** Next.js 16.3 (`after()` em route handler e `maxDuration`), Supabase (RPC), OpenRouter (chat completions, com a política de dados por requisição), Cloud API da Meta (`/messages` e `/phone_numbers`) e Vitest.

**Specs:**
- `docs/specs/conversation-engine-v1.md`: comportamentos 3 (retomada), 5 (geração) e 7 (falha da IA); edge cases de agrupamento e de janela; instrumentação de custo.
- `docs/specs/atendimento-billing-v1.md`: contagem de respostas da IA e fechamento por contagem.
- Parte 1: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md` (contrato `ResultadoDaRecepcao` e tarefa 7b).

## Decisões deste plano

O Jhones autorizou seguir com a alternativa recomendada. Cada decisão abaixo fica para a revisão dele no PR.

1. **Agrupamento no `after()` da própria rota, "a mais recente vence".**
   - Cada mensagem nova do paciente agenda uma resposta, que espera `JANELA_DE_AGRUPAMENTO_MS` (10 s) e só segue se a mensagem ainda for a última do paciente na conversa. Senão, a mais nova responde por todas.
   - Alternativas descartadas:
     - fila externa (QStash, Vercel Queues): infra nova, sem aprovação;
     - cron: o intervalo mínimo é de 1 min, lento demais para uma conversa.
2. **Reservar, enviar, confirmar.**
   - A resposta é gravada como `pending` antes do envio, com `reply_to_message_id` único. Isso é a trava contra resposta dupla (dois `after()` para a mesma mensagem, reenvio).
   - Depois do envio, `confirm_ai_reply` grava o id da Meta e conta o atendimento, numa transação.
   - Ordem inversa (enviar e depois gravar) perderia o histórico e a contagem se a gravação falhasse depois do envio.
3. **`ai_failed_at` em `conversations`.**
   - Falha da IA ou do envio: `handled_by = human`, e `ai_failed_at` vira o marco do alerta do painel (parte 4).
   - A retomada em 24h conta a partir do mais recente entre `human_took_over_at` e `ai_failed_at`. Assim, uma conversa que falhou e ninguém assumiu volta para a IA no dia seguinte, em vez de ficar presa.
4. **Política de dados do OpenRouter fixa no código:** `provider: { data_collection: "deny", zdr: true }` em toda chamada.
   - É dado de saúde (`lgpd-security`: revisar o que sai da infraestrutura). O Gemini tem endpoint com retenção zero pelo Vertex (documentação do OpenRouter, conferida em 2026-09-27).
   - Não é escolha de modelo, e por isso não vai para a env. O modelo continua em `OPENROUTER_MODEL`.
5. **O que vai para o modelo:**
   - vai: o system prompt da clínica e as últimas `TAMANHO_DO_HISTORICO` (20) mensagens;
   - não vai: telefone nem nome do paciente;
   - resposta humana (eco) entra como `assistant`, marcada como da equipe;
   - áudio, imagem sem legenda e outros tipos entram como marcador, e o conteúdo apagado a pedido do paciente também.
6. **Novas tentativas:**
   - **IA:** 1 s e 4 s (comportamento 7), só para erro repetível (429, 5xx, rede, resposta vazia).
   - **Envio:** repete só limite de taxa (429 ou código `130429`), o único caso em que é certo que a mensagem não saiu. Repetir um 5xx poderia mandar a mesma resposta duas vezes ao paciente.
   - **Limite de 20 msg/s da coexistência (comportamento 5):** sem fila de vazão nesta parte. Cada mensagem do paciente gera no máximo uma resposta, depois de 10 s de agrupamento, e uma clínica não chega perto de 20 por segundo. Se chegar, o `130429` é repetido uma vez. Uma fila de vazão entra com as sequências (fase 4), que disparam em lote.
7. **Custo:** `category = SERVICE`, `within_24h_window` e `billable` gravados na reserva.
   - `billable` segue a data de 1º/out/2026, em UTC (skill `integrations`).
   - Conferir com o `pricing` que a Meta manda no status fica em aberto até haver tráfego real.
8. **Status de entrega:** só avança (`sent` → `delivered` → `read`). `failed` só vale antes da entrega. A condição vai no próprio `update`, e resolve status fora de ordem e simultâneos.
9. **Falha transitória num evento pula os seguintes da mesma conversa** no mesmo POST. É o achado da conferência de segurança da parte 1: sem isso, a mensagem N+1 seria respondida antes da N, que a Meta vai reenviar.
10. **Prova de posse na conexão.**
    - `connectWhatsapp` confere, pela Graph API e com o token informado, que o número pertence ao WABA antes de gravar.
    - Consequência: conectar com credenciais inventadas deixa de funcionar também em staging. É o comportamento certo, porque um agente com credencial falsa não envia nada.

## Fora desta parte

- **Parte 3:**
  - urgência, com o `protocol_message` e `is_urgent`;
  - opt-out;
  - qualificação (`qualified_at`);
  - o cron de timeout da sessão.

  Até lá, o agente responde sem triagem de urgência. Como o webhook da Meta não está assinado, isso não chega a paciente real. **A parte 3 é pré-requisito do go-live.**
- **Parte 4:** tela de Conversas, alerta de falha e devolver para a IA pelo painel.
- **Parte 5:** áudio (transcrição) e preview do agente.
- **Fase 7:** limite de atendimentos do plano.
- **Não entram:**
  - cache de prompt (em aberto na spec);
  - handoff pedido pelo paciente;
  - `handoff_enabled`/`handoff_message` do agente.

## Restrições globais

- **Banco:**
  - migration aditiva em `supabase/migrations/`;
  - as funções novas só para `service_role`, com teste de negação para membro e anônimo contra o banco real.
- **LGPD:**
  - nenhum log com conteúdo, prompt, resposta, telefone ou token, só `erroParaLog`;
  - a resposta da IA é cifrada como a mensagem do paciente (`cifrarConteudo`).
- **Integrações:**
  - os clients ficam em `lib/*`;
  - o modelo vem de `OPENROUTER_MODEL` e a versão da Graph API de `WHATSAPP_API_VERSION`, sem valor padrão no código;
  - o token da clínica só é decifrado dentro de `lib/whatsapp/client.ts`.
- **Mock da Meta e do OpenRouter:** nenhum teste chama rede. Os clients recebem `fetch` falso, e a orquestração recebe `gerar` e `enviar` falsos.
- **Sem tela nesta parte:**
  - nenhuma rota do painel muda;
  - nenhum item do menu sai de "em breve";
  - os testes de `tests/architecture/` não mudam.
- **Git:** commits pequenos na `staging`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem PR.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/whatsapp/webhook.ts` (+ teste) | Também lê os status de entrega |
| `lib/conversations/entrega.ts` (+ teste) | De quais estados um status avança |
| `lib/conversations/decisao.ts` (+ teste) | Se a IA responde, e se retoma a conversa |
| `lib/conversations/custo.ts` (+ teste) | Categoria, janela e cobrança da resposta |
| `lib/agent-config/prompt.ts` (+ teste) | O que o modelo recebe |
| `lib/ai/retentativa.ts` (+ teste) | Novas tentativas com espera |
| `lib/ai/client.ts` (+ teste) | OpenRouter |
| `lib/whatsapp/client.ts` (+ teste) | Envio de texto e posse do número |
| `supabase/migrations/20260927150000_ai_replies.sql` | Colunas de resposta, custo e entrega; `ai_failed_at`; funções |
| `tests/rls/ai-replies.test.ts` | Funções novas contra o banco real |
| `lib/conversations/resposta.ts` | Orquestração da resposta |
| `lib/conversations/status.ts` | Status de entrega → mensagem |
| `tests/conversations/resposta.test.ts` | Resposta de ponta a ponta contra o banco real |
| `app/api/whatsapp/webhook/route.ts` | `after()`, status e o pulo depois de falha transitória |
| `lib/agent-config/mutations.ts` (+ teste) | Posse do número na conexão |

---

### Tarefa 1: Status de entrega

**Arquivos:**
- Alterar: `lib/whatsapp/webhook.ts`, `lib/whatsapp/webhook.test.ts` e `tests/fixtures/meta-webhook.ts`.
- Criar: `lib/conversations/entrega.ts` e `lib/conversations/entrega.test.ts`.

**Interfaces:**
- Produz:
  - `StatusDeEntrega`;
  - `EventoDeStatusDoWebhook`, que entra na união `EventoDoWebhook`;
  - `estadosQueAvancamPara(novo)`.

- [ ] **Passo 1: fixture** (`tests/fixtures/meta-webhook.ts`)

```ts
export type StatusBruto = {
  id: string
  status: string
  timestamp: number
  errors?: Array<Record<string, unknown>>
}

/** Status de entrega: chegam no campo `messages`, em `statuses`. */
export function webhookDeStatus(p: { wabaId?: string; phoneNumberId: string; statuses: StatusBruto[] }) {
  return envelope(p.wabaId ?? WABA_ID, "messages", {
    messaging_product: "whatsapp",
    metadata: metadata(p.phoneNumberId),
    statuses: p.statuses.map((s) => ({ recipient_id: "5500000000000", ...s, timestamp: String(s.timestamp) })),
  })
}
```

- [ ] **Passo 2: testes que falham.**

Em `lib/whatsapp/webhook.test.ts`, o caso "ignora status de entrega" sai e entram estes, importando `webhookDeStatus`:

```ts
describe("status de entrega", () => {
  it("lê status com o id da Meta, e o código só na falha", () => {
    const eventos = interpretarWebhook(
      webhookDeStatus({
        phoneNumberId: PHONE,
        statuses: [
          { id: "wamid.1", status: "delivered", timestamp: T },
          { id: "wamid.2", status: "failed", timestamp: T, errors: [{ code: 131047, title: "Re-engagement message" }] },
        ],
      }),
    )
    const base = { tipo: "status", wabaId: WABA_ID, phoneNumberId: PHONE, ocorridoEm: "2026-09-21T14:13:20.000Z" }
    expect(eventos).toEqual([
      { ...base, waMessageId: "wamid.1", status: "delivered", codigoDoErro: null },
      { ...base, waMessageId: "wamid.2", status: "failed", codigoDoErro: "131047" },
    ])
  })

  it("ignora status desconhecido e o que vem sem id ou sem carimbo", () => {
    const payload = webhookDeStatus({
      phoneNumberId: PHONE,
      statuses: [
        { id: "wamid.1", status: "deleted", timestamp: T },
        { id: "", status: "read", timestamp: T },
        { id: "wamid.3", status: "read", timestamp: T },
      ],
    })
    const statuses = payload.entry[0].changes[0].value.statuses as Array<Record<string, unknown>>
    statuses[2].timestamp = "ontem"
    expect(interpretarWebhook(payload)).toEqual([])
  })

  it("mensagens e status no mesmo change viram os dois eventos", () => {
    const payload = webhookDeMensagens({ phoneNumberId: PHONE, waId: WA_ID, mensagens: [mensagem("wamid.m", T, "oi")] })
    const value = payload.entry[0].changes[0].value as Record<string, unknown>
    value.statuses = [{ id: "wamid.s", status: "read", timestamp: String(T), recipient_id: WA_ID }]
    expect(interpretarWebhook(payload).map((e) => e.tipo)).toEqual(["mensagem", "status"])
  })
})
```

`lib/conversations/entrega.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { estadosQueAvancamPara } from "./entrega"

describe("estadosQueAvancamPara", () => {
  it("cada status avança só a partir dos anteriores", () => {
    expect(estadosQueAvancamPara("sent")).toEqual(["pending"])
    expect(estadosQueAvancamPara("delivered")).toEqual(["pending", "sent"])
    expect(estadosQueAvancamPara("read")).toEqual(["pending", "sent", "delivered"])
  })

  it("um status atrasado não desfaz o mais novo", () => {
    expect(estadosQueAvancamPara("delivered")).not.toContain("read")
    expect(estadosQueAvancamPara("sent")).not.toContain("delivered")
  })

  it("falha só vale antes da entrega, e nada sai da falha", () => {
    expect(estadosQueAvancamPara("failed")).toEqual(["pending", "sent"])
    for (const s of ["sent", "delivered", "read", "failed"] as const) {
      expect(estadosQueAvancamPara(s)).not.toContain("failed")
    }
  })
})
```

- [ ] **Passo 3:** `npx vitest run lib/whatsapp/webhook.test.ts lib/conversations/entrega.test.ts`. Esperado: FALHA.
- [ ] **Passo 4: implementação.**

`lib/whatsapp/webhook.ts`:

```ts
export type StatusDeEntrega = "sent" | "delivered" | "read" | "failed"

export type EventoDeStatusDoWebhook = {
  tipo: "status"
  wabaId: string
  phoneNumberId: string
  waMessageId: string
  status: StatusDeEntrega
  ocorridoEm: string
  /** Código da Meta, só em `failed`. Nunca o título nem a mensagem do erro, que podem citar o número. */
  codigoDoErro: string | null
}

export type EventoDoWebhook = MensagemDoWebhook | EventoDeContaDoWebhook | EventoDeStatusDoWebhook

const STATUS_DE_ENTREGA: readonly string[] = ["sent", "delivered", "read", "failed"]

function statuses(wabaId: string, value: Bruto): EventoDeStatusDoWebhook[] {
  const phoneNumberId = texto(objeto(value.metadata)?.phone_number_id)
  if (!phoneNumberId) return []

  const saida: EventoDeStatusDoWebhook[] = []
  for (const bruto of lista(value.statuses)) {
    const s = objeto(bruto)
    const waMessageId = texto(s?.id)
    const status = texto(s?.status)
    const ocorridoEm = instante(s?.timestamp)
    if (!s || !waMessageId || !status || !STATUS_DE_ENTREGA.includes(status) || !ocorridoEm) continue
    const codigo = objeto(lista(s.errors)[0])?.code
    saida.push({
      tipo: "status",
      wabaId,
      phoneNumberId,
      waMessageId,
      status: status as StatusDeEntrega,
      ocorridoEm,
      codigoDoErro:
        status === "failed" && (typeof codigo === "number" || typeof codigo === "string") ? String(codigo) : null,
    })
  }
  return saida
}
```

No `interpretarWebhook`, o ramo `messages` passa a ser:

```ts
      if (change.field === "messages" && wabaId) {
        eventos.push(...mensagens(wabaId, value, "messages", "patient"), ...statuses(wabaId, value))
      }
```

`lib/conversations/entrega.ts`:

```ts
import type { StatusDeEntrega } from "@/lib/whatsapp/webhook"

/** Estado da entrega de uma mensagem que o Nextech enviou. `pending`: reservada, ainda sem resposta da Meta. */
export type EstadoDaEntrega = "pending" | StatusDeEntrega

const ANTERIORES: Record<StatusDeEntrega, EstadoDaEntrega[]> = {
  sent: ["pending"],
  delivered: ["pending", "sent"],
  read: ["pending", "sent", "delivered"],
  failed: ["pending", "sent"],
}

/**
 * De quais estados o status `novo` é um avanço. A Meta não garante a
 * ordem: "read" pode chegar antes de "delivered", e o "delivered" atrasado
 * não pode desfazer o "read". A lista vai como condição do `update`, o que
 * também resolve dois status chegando ao mesmo tempo. Uma mensagem entregue
 * não falha depois, e nada sai da falha.
 */
export function estadosQueAvancamPara(novo: StatusDeEntrega): EstadoDaEntrega[] {
  return ANTERIORES[novo]
}
```

- [ ] **Passo 5:** rodar de novo. Esperado: PASSA. O `route.ts` ainda não trata `tipo: "status"`: acrescentar, por ora, `else if (evento.tipo === "conta")` no laço, para o `tsc` passar sem mudar o comportamento. A tarefa 8 liga o status.
- [ ] **Passo 6:** commit `feat(whatsapp): leitura do status de entrega e a ordem em que ele avança`.

---

### Tarefa 2: Decisão de responder e custo da resposta

**Arquivos:** criar `lib/conversations/decisao.ts`, `lib/conversations/custo.ts` e os testes.

- [ ] **Passo 1: testes que falham.**

`lib/conversations/decisao.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { decidirResposta, type EstadoDaConversa } from "./decisao"

const AGORA = "2026-09-28T15:00:00.000Z"
const horasAntes = (h: number) => new Date(Date.parse(AGORA) - h * 3_600_000).toISOString()

const conversa = (p: Partial<EstadoDaConversa> = {}): EstadoDaConversa => ({
  handledBy: "ai",
  isUrgent: false,
  humanTookOverAt: null,
  aiFailedAt: null,
  lastInboundAt: horasAntes(0.01),
  ...p,
})

const decidir = (c: EstadoDaConversa, agenteAtivo = true) =>
  decidirResposta({ agenteAtivo, conversa: c, agora: AGORA })

describe("decidirResposta (conversation-engine-v1, comportamentos 3 e 4)", () => {
  it("conversa com a IA: responde, sem retomar nada", () => {
    expect(decidir(conversa())).toEqual({ responde: true, retoma: false })
  })

  it("agente fora do ar não responde, antes de qualquer outra regra", () => {
    expect(decidir(conversa({ isUrgent: true }), false)).toEqual({ responde: false, motivo: "agente-fora-do-ar" })
  })

  it("urgente nunca é retomada, mesmo com a última ação humana há dias", () => {
    const c = conversa({ handledBy: "human", isUrgent: true, humanTookOverAt: horasAntes(72) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "urgente" })
  })

  it("fora da janela de 24h não sai texto livre", () => {
    expect(decidir(conversa({ lastInboundAt: horasAntes(25) }))).toEqual({ responde: false, motivo: "fora-da-janela" })
    expect(decidir(conversa({ lastInboundAt: null }))).toEqual({ responde: false, motivo: "fora-da-janela" })
  })

  it("humano respondeu há menos de 24h: a IA fica calada", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(23) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "humano-atendendo" })
  })

  it("24h exatas depois da última ação humana: a IA retoma", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(24) })
    expect(decidir(c)).toEqual({ responde: true, retoma: true })
  })

  it("falha da IA sem ninguém assumir: retoma 24h depois da falha", () => {
    const c = conversa({ handledBy: "human", aiFailedAt: horasAntes(25) })
    expect(decidir(c)).toEqual({ responde: true, retoma: true })
  })

  it("vale o marco mais recente entre a ação humana e a falha", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(30), aiFailedAt: horasAntes(1) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "humano-atendendo" })
  })

  it("humano sem marco nenhum: a IA fica calada", () => {
    expect(decidir(conversa({ handledBy: "human" }))).toEqual({ responde: false, motivo: "humano-atendendo" })
  })
})
```

`lib/conversations/custo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { custoDaResposta } from "./custo"

const umaHoraAntes = (iso: string) => new Date(Date.parse(iso) - 3_600_000).toISOString()

describe("custoDaResposta (conversation-engine-v1, instrumentação de custo)", () => {
  it("serviço dentro da janela antes de 1º de outubro de 2026: não cobrado", () => {
    const enviadaEm = "2026-09-30T23:59:59.000Z"
    expect(custoDaResposta({ enviadaEm, ultimaDoPaciente: umaHoraAntes(enviadaEm) })).toEqual({
      category: "SERVICE",
      withinWindow: true,
      billable: false,
    })
  })

  it("a partir de 1º de outubro, o serviço dentro da janela passa a ser cobrado", () => {
    const enviadaEm = "2026-10-01T00:00:00.000Z"
    expect(custoDaResposta({ enviadaEm, ultimaDoPaciente: umaHoraAntes(enviadaEm) })).toMatchObject({
      withinWindow: true,
      billable: true,
    })
  })

  it("fora da janela é sempre cobrado", () => {
    expect(
      custoDaResposta({ enviadaEm: "2026-09-10T12:00:00.000Z", ultimaDoPaciente: "2026-09-09T11:00:00.000Z" }),
    ).toEqual({ category: "SERVICE", withinWindow: false, billable: true })
  })
})
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3: implementação.**

`lib/conversations/decisao.ts`:

```ts
import { janelaDeAtendimento } from "./janela"

/**
 * A IA volta a responder 24h depois da última ação humana (conversation-engine-v1, comportamento 3).
 * O prazo espelha a janela da Meta: depois dele, a conversa já exigiria template de qualquer forma.
 */
export const RETOMADA_DA_IA_MS = 24 * 60 * 60 * 1000

export type EstadoDaConversa = {
  handledBy: "ai" | "human"
  isUrgent: boolean
  /** Última resposta humana pelo app (eco). */
  humanTookOverAt: string | null
  /** Última falha da IA ou do envio, que passou a conversa para a equipe. */
  aiFailedAt: string | null
  lastInboundAt: string | null
}

export type MotivoDoSilencio = "agente-fora-do-ar" | "urgente" | "fora-da-janela" | "humano-atendendo"

export type Decisao = { responde: true; retoma: boolean } | { responde: false; motivo: MotivoDoSilencio }

function maisRecente(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * Se a IA responde à mensagem do paciente agora. A ordem é a de gravidade:
 * agente fora do ar, urgência (que só a equipe desfaz), janela da Meta
 * (fora dela, texto livre nem sai) e, por fim, quem está atendendo.
 * `retoma`: a conversa estava com a equipe e volta para a IA.
 */
export function decidirResposta(p: { agenteAtivo: boolean; conversa: EstadoDaConversa; agora: string }): Decisao {
  const { conversa } = p
  if (!p.agenteAtivo) return { responde: false, motivo: "agente-fora-do-ar" }
  if (conversa.isUrgent) return { responde: false, motivo: "urgente" }
  if (!janelaDeAtendimento(conversa.lastInboundAt, p.agora).aberta) {
    return { responde: false, motivo: "fora-da-janela" }
  }
  if (conversa.handledBy === "ai") return { responde: true, retoma: false }

  const marco = maisRecente(conversa.humanTookOverAt, conversa.aiFailedAt)
  if (marco && Date.parse(p.agora) - Date.parse(marco) >= RETOMADA_DA_IA_MS) {
    return { responde: true, retoma: true }
  }
  return { responde: false, motivo: "humano-atendendo" }
}
```

`lib/conversations/custo.ts`:

```ts
import { janelaDeAtendimento } from "./janela"

/**
 * A partir desta data a Meta cobra também a mensagem de serviço dentro da
 * janela de 24h (skill `integrations`). Em UTC: a data do anúncio, sem hora.
 */
export const INICIO_DA_COBRANCA_DE_SERVICO = "2026-10-01T00:00:00.000Z"

export type CustoDaMensagem = { category: "SERVICE"; withinWindow: boolean; billable: boolean }

/**
 * Custo de uma resposta de texto livre (conversation-engine-v1, instrumentação
 * de custo). Gravado no envio, e não calculado na leitura, porque a regra
 * muda de data: recalcular depois exigiria saber qual valia em cada mensagem.
 */
export function custoDaResposta(p: { enviadaEm: string; ultimaDoPaciente: string | null }): CustoDaMensagem {
  const withinWindow = janelaDeAtendimento(p.ultimaDoPaciente, p.enviadaEm).aberta
  const billable = !withinWindow || Date.parse(p.enviadaEm) >= Date.parse(INICIO_DA_COBRANCA_DE_SERVICO)
  return { category: "SERVICE", withinWindow, billable }
}
```

- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(conversations): decisão de responder, retomada em 24h e custo da resposta como regra pura`.

---

### Tarefa 3: O que o modelo recebe

**Arquivos:** criar `lib/agent-config/prompt.ts` e `lib/agent-config/prompt.test.ts`.

- [ ] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { HORARIO_PADRAO } from "./schema"
import { montarConversa, TAMANHO_DO_HISTORICO, type ContextoDoAgente, type ItemDoHistorico } from "./prompt"

// Segunda-feira, 14:30 em Brasília.
const AGORA = "2026-09-28T17:30:00.000Z"

const contexto = (p: Partial<ContextoDoAgente> = {}): ContextoDoAgente => ({
  nomeDaClinica: "Clínica Sorriso Recife",
  especialidade: "odontologia",
  persona: "Seja acolhedor e chame o paciente de você.",
  saudacao: "Olá! Aqui é a recepção da Sorriso Recife.",
  horario: HORARIO_PADRAO,
  procedimentos: [
    { nome: "Limpeza", duracaoMinutos: 40, preco: 180 },
    { nome: "Avaliação", duracaoMinutos: 30, preco: null },
  ],
  convenios: ["Amil", "Bradesco Saúde"],
  ...p,
})

const doPaciente = (texto: string): ItemDoHistorico => ({ autor: "patient", midia: "text", texto, redigida: false })
const daIa = (texto: string): ItemDoHistorico => ({ autor: "ai", midia: "text", texto, redigida: false })

describe("montarConversa", () => {
  it("o system prompt tem a clínica, a hora, o horário, os procedimentos e os convênios", () => {
    const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(sistema.role).toBe("system")
    expect(sistema.content).toContain("Clínica Sorriso Recife")
    expect(sistema.content).toContain("segunda, 28 de setembro, 14:30")
    expect(sistema.content).toContain("- Limpeza (40 min), R$ 180,00")
    expect(sistema.content).toContain("- Avaliação (30 min), preço sob consulta")
    expect(sistema.content).toContain("Amil, Bradesco Saúde")
    expect(sistema.content).toMatch(/Domingo: fechado/)
  })

  it("as regras de segurança vêm antes das instruções da clínica", () => {
    const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(sistema.content.indexOf("Nunca dê diagnóstico")).toBeLessThan(sistema.content.indexOf("Seja acolhedor"))
  })

  it("sem procedimento nem convênio, diz ao modelo que não há o que citar", () => {
    const [sistema] = montarConversa(contexto({ procedimentos: [], convenios: [] }), [doPaciente("oi")], AGORA)
    expect(sistema.content).toContain("Nenhum cadastrado. Não cite procedimento nem preço.")
    expect(sistema.content).toContain("Convênios aceitos: nenhum; atendimento particular.")
  })

  it("a saudação só entra na primeira resposta da conversa", () => {
    const [primeira] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(primeira.content).toContain("Olá! Aqui é a recepção da Sorriso Recife.")
    const [depois] = montarConversa(contexto(), [doPaciente("oi"), daIa("Olá!"), doPaciente("tudo bem?")], AGORA)
    expect(depois.content).not.toContain("Olá! Aqui é a recepção da Sorriso Recife.")
  })

  it("paciente vira user, IA e equipe viram assistant, e mensagens seguidas do mesmo lado se juntam", () => {
    const historico: ItemDoHistorico[] = [
      doPaciente("oi"),
      doPaciente("tem horário amanhã?"),
      { autor: "human", midia: "text", texto: "Temos às 15h", redigida: false },
      daIa("Posso reservar?"),
    ]
    expect(montarConversa(contexto(), historico, AGORA).slice(1)).toEqual([
      { role: "user", content: "oi\ntem horário amanhã?" },
      { role: "assistant", content: "[resposta da equipe da clínica] Temos às 15h\nPosso reservar?" },
    ])
  })

  it("mídia vira marcador, com a legenda quando há, e o conteúdo apagado não volta", () => {
    const historico: ItemDoHistorico[] = [
      { autor: "patient", midia: "audio", texto: null, redigida: false },
      { autor: "patient", midia: "image", texto: "pedido médico", redigida: false },
      { autor: "patient", midia: "other", texto: null, redigida: false },
      { autor: "patient", midia: "text", texto: null, redigida: true },
    ]
    expect(montarConversa(contexto(), historico, AGORA)[1].content).toBe(
      [
        "[áudio, que ainda não pode ser ouvido]",
        "[imagem] pedido médico",
        "[mensagem de um tipo que não pode ser lido]",
        "[conteúdo apagado a pedido do paciente]",
      ].join("\n"),
    )
  })

  it("só as últimas mensagens vão para o modelo", () => {
    const historico = Array.from({ length: TAMANHO_DO_HISTORICO + 5 }, (_, i) =>
      i % 2 === 0 ? doPaciente(`p${i}`) : daIa(`a${i}`),
    )
    const conversa = montarConversa(contexto(), historico, AGORA).slice(1)
    expect(conversa.map((m) => m.content).join(" ")).not.toContain("p0")
    expect(conversa.at(-1)!.content).toBe(`p${TAMANHO_DO_HISTORICO + 4}`)
  })
})
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3: implementação**

```ts
import { chaveDoDia, descreverDia, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { DIAS, ROTULO_DA_ESPECIALIDADE, ROTULO_DO_DIA, type BusinessHours, type MedicalSpecialty } from "./schema"

/**
 * Quantas mensagens da conversa vão para o modelo. Em aberto na spec: afeta
 * custo e qualidade, e só dá para fixar medindo com conversa real.
 */
export const TAMANHO_DO_HISTORICO = 20

export type MensagemDoModelo = { role: "system" | "user" | "assistant"; content: string }

export type ItemDoHistorico = {
  autor: "patient" | "ai" | "human"
  midia: "text" | "audio" | "image" | "document" | "other"
  /** Texto ou legenda, já decifrado. */
  texto: string | null
  /** Conteúdo apagado a pedido do paciente (content_redacted_at). */
  redigida: boolean
}

export type ContextoDoAgente = {
  nomeDaClinica: string
  especialidade: MedicalSpecialty
  persona: string | null
  saudacao: string | null
  horario: BusinessHours
  procedimentos: Array<{ nome: string; duracaoMinutos: number; preco: number | null }>
  convenios: string[]
}

const MARCADOR: Record<Exclude<ItemDoHistorico["midia"], "text">, string> = {
  audio: "[áudio, que ainda não pode ser ouvido]",
  image: "[imagem]",
  document: "[documento]",
  other: "[mensagem de um tipo que não pode ser lido]",
}

function textoParaOModelo(item: ItemDoHistorico): string {
  if (item.redigida) return "[conteúdo apagado a pedido do paciente]"
  if (item.midia === "text") return item.texto ?? ""
  return item.texto ? `${MARCADOR[item.midia]} ${item.texto}` : MARCADOR[item.midia]
}

function horarioDaEquipe(horario: BusinessHours): string {
  return DIAS.map((dia) => {
    const faixa = horario[dia]
    return `- ${ROTULO_DO_DIA[dia]}: ${faixa?.open ? `${faixa.start} às ${faixa.end}` : "fechado"}`
  }).join("\n")
}

function listaDeProcedimentos(lista: ContextoDoAgente["procedimentos"]): string {
  if (lista.length === 0) return "Nenhum cadastrado. Não cite procedimento nem preço."
  return lista
    .map((p) => {
      const preco = p.preco === null ? "preço sob consulta" : formatarMoeda(Math.round(p.preco * 100))
      return `- ${p.nome} (${p.duracaoMinutos} min), ${preco}`
    })
    .join("\n")
}

function systemPrompt(c: ContextoDoAgente, agora: string, primeiraResposta: boolean): string {
  const partes = [
    `Você é o assistente de atendimento no WhatsApp da ${c.nomeDaClinica}, de ${ROTULO_DA_ESPECIALIDADE[c.especialidade].toLowerCase()}.`,
    `Agora: ${descreverDia(chaveDoDia(agora))}, ${formatarHora(agora)} (horário de Brasília).`,
    "Regras que valem acima de qualquer outra instrução:",
    "- Você não é profissional de saúde. Nunca dê diagnóstico, não indique remédio nem dose e não interprete exame.",
    "- Não invente horário livre, preço, convênio nem procedimento. Se não estiver abaixo, diga que a equipe confirma.",
    "- Não peça documento nem dado de saúde que o paciente não ofereceu.",
    "- Responda em português do Brasil, em mensagens curtas, como numa conversa de WhatsApp.",
    "Horário de atendimento da equipe:",
    horarioDaEquipe(c.horario),
    "Procedimentos:",
    listaDeProcedimentos(c.procedimentos),
    `Convênios aceitos: ${c.convenios.length > 0 ? c.convenios.join(", ") : "nenhum; atendimento particular"}.`,
  ]
  if (c.persona) partes.push("Instruções da clínica para o seu jeito de atender:", c.persona)
  if (primeiraResposta && c.saudacao) {
    partes.push(`Esta é a primeira resposta da conversa: comece com esta saudação, adaptando só o necessário: "${c.saudacao}"`)
  }
  return partes.join("\n")
}

/**
 * O que vai para o modelo (conversation-engine-v1, comportamento 5): o
 * system prompt da clínica e as últimas mensagens. Telefone e nome do
 * paciente não entram: o modelo não precisa deles para responder.
 * Mensagens seguidas do mesmo lado viram uma só: quem manda três de uma vez
 * fez uma pergunta.
 */
export function montarConversa(
  c: ContextoDoAgente,
  historico: ItemDoHistorico[],
  agora: string,
): MensagemDoModelo[] {
  const primeiraResposta = historico.every((m) => m.autor === "patient")
  const mensagens: MensagemDoModelo[] = [{ role: "system", content: systemPrompt(c, agora, primeiraResposta) }]
  for (const item of historico.slice(-TAMANHO_DO_HISTORICO)) {
    const role = item.autor === "patient" ? "user" : "assistant"
    const texto =
      item.autor === "human" ? `[resposta da equipe da clínica] ${textoParaOModelo(item)}` : textoParaOModelo(item)
    const anterior = mensagens[mensagens.length - 1]
    if (anterior.role === role) anterior.content += `\n${texto}`
    else mensagens.push({ role, content: texto })
  }
  return mensagens
}
```

- [ ] **Passo 4:** rodar. Esperado: PASSA. Se o texto de `ROTULO_DA_ESPECIALIDADE` ou de `HORARIO_PADRAO` não bater com o que o teste espera, o teste se ajusta ao valor real do schema, sem mudar o schema.
- [ ] **Passo 5:** commit `feat(agent-config): system prompt e histórico da conversa para o modelo`.

---

### Tarefa 4: Client do OpenRouter e novas tentativas

**Arquivos:** criar `lib/ai/retentativa.ts`, `lib/ai/client.ts` e os testes.

**Interfaces:**
- Produz:
  - `ESPERAS_DA_IA_MS` e `comRetentativas(tentar, { esperas, repetivel, dormir })`;
  - `IaError` (`name = "IaError"`, `code`, `repetivel`);
  - `gerarResposta(mensagens, { fetch? }) → { texto, modelo, tokensDeEntrada, tokensDeSaida }`.

- [ ] **Passo 1: testes que falham.**

`lib/ai/retentativa.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { comRetentativas, ESPERAS_DA_IA_MS } from "./retentativa"

const falha = (repetivel = true) => Object.assign(new Error("falhou"), { repetivel })
const opcoes = () => ({
  esperas: ESPERAS_DA_IA_MS,
  repetivel: (e: unknown) => (e as { repetivel?: boolean }).repetivel === true,
  dormir: vi.fn(async () => {}),
})

describe("comRetentativas (conversation-engine-v1, comportamento 7)", () => {
  it("dá certo na primeira: não espera", async () => {
    const o = opcoes()
    await expect(comRetentativas(async () => "ok", o)).resolves.toBe("ok")
    expect(o.dormir).not.toHaveBeenCalled()
  })

  it("falha duas vezes e acerta na terceira, esperando 1 s e 4 s", async () => {
    const o = opcoes()
    const tentar = vi.fn().mockRejectedValueOnce(falha()).mockRejectedValueOnce(falha()).mockResolvedValue("ok")
    await expect(comRetentativas(tentar, o)).resolves.toBe("ok")
    expect(o.dormir.mock.calls).toEqual([[1000], [4000]])
  })

  it("três falhas: desiste com o último erro", async () => {
    const o = opcoes()
    const ultimo = falha()
    const tentar = vi.fn().mockRejectedValueOnce(falha()).mockRejectedValueOnce(falha()).mockRejectedValueOnce(ultimo)
    await expect(comRetentativas(tentar, o)).rejects.toBe(ultimo)
    expect(tentar).toHaveBeenCalledTimes(3)
  })

  it("erro que não se resolve repetindo sobe na hora", async () => {
    const o = opcoes()
    const erro = falha(false)
    await expect(comRetentativas(vi.fn().mockRejectedValue(erro), o)).rejects.toBe(erro)
    expect(o.dormir).not.toHaveBeenCalled()
  })
})
```

`lib/ai/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { gerarResposta } from "./client"
import type { MensagemDoModelo } from "@/lib/agent-config/prompt"

const MENSAGENS: MensagemDoModelo[] = [
  { role: "system", content: "sistema" },
  { role: "user", content: "Tenho uma dor de dente forte" },
]
const original = { chave: process.env.OPENROUTER_API_KEY, modelo: process.env.OPENROUTER_MODEL }

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "chave-de-teste"
  process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
})
afterEach(() => {
  restaurar("OPENROUTER_API_KEY", original.chave)
  restaurar("OPENROUTER_MODEL", original.modelo)
})

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

describe("gerarResposta (OpenRouter)", () => {
  it("manda o modelo da env, a política de dados e a chave, e devolve o texto", async () => {
    const fetch = vi.fn(async () =>
      json(200, {
        model: "provedor/modelo-de-teste",
        choices: [{ message: { role: "assistant", content: "  Olá! Temos horário.  " } }],
        usage: { prompt_tokens: 120, completion_tokens: 9 },
      }),
    )
    await expect(gerarResposta(MENSAGENS, { fetch })).resolves.toEqual({
      texto: "Olá! Temos horário.",
      modelo: "provedor/modelo-de-teste",
      tokensDeEntrada: 120,
      tokensDeSaida: 9,
    })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer chave-de-teste")
    const corpo = JSON.parse(init.body as string)
    expect(corpo.model).toBe("provedor/modelo-de-teste")
    expect(corpo.messages).toEqual(MENSAGENS)
    expect(corpo.provider).toEqual({ data_collection: "deny", zdr: true })
  })

  it("sem chave ou sem modelo na env: erro de configuração, sem chamar a rede", async () => {
    const fetch = vi.fn()
    delete process.env.OPENROUTER_MODEL
    await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({
      name: "IaError",
      code: "configuracao",
      repetivel: false,
    })
    process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
    delete process.env.OPENROUTER_API_KEY
    await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({ code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("429 e 5xx se resolvem repetindo; 4xx não", async () => {
    for (const [status, repetivel] of [[429, true], [503, true], [400, false], [401, false]] as const) {
      const fetch = vi.fn(async () => json(status, { error: { message: "x" } }))
      await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({
        code: `http-${status}`,
        repetivel,
      })
    }
  })

  it("erro de rede e resposta sem texto se resolvem repetindo", async () => {
    const rede = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(gerarResposta(MENSAGENS, { fetch: rede })).rejects.toMatchObject({ code: "rede", repetivel: true })
    const vazia = vi.fn(async () => json(200, { choices: [{ message: { content: "   " } }] }))
    await expect(gerarResposta(MENSAGENS, { fetch: vazia })).rejects.toMatchObject({
      code: "resposta-vazia",
      repetivel: true,
    })
  })

  it("o erro nunca carrega o prompt, a resposta do provedor nem a chave", async () => {
    const fetch = vi.fn(async () => json(400, { error: { message: "entrada inválida: Tenho uma dor de dente forte" } }))
    const erro = await gerarResposta(MENSAGENS, { fetch }).catch((e: unknown) => e)
    const texto = inspect(erro)
    expect(texto).not.toContain("dor de dente")
    expect(texto).not.toContain("chave-de-teste")
  })
})
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3: implementação.**

`lib/ai/retentativa.ts`:

```ts
/** Esperas entre as tentativas (conversation-engine-v1, comportamento 7): três tentativas no total. */
export const ESPERAS_DA_IA_MS = [1000, 4000] as const

/**
 * Tenta de novo depois de cada espera, só para o erro que repetir resolve.
 * O `dormir` é injetado: o teste não espera 5 s de verdade.
 */
export async function comRetentativas<T>(
  tentar: () => Promise<T>,
  p: { esperas: readonly number[]; repetivel: (erro: unknown) => boolean; dormir: (ms: number) => Promise<void> },
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await tentar()
    } catch (erro) {
      if (tentativa >= p.esperas.length || !p.repetivel(erro)) throw erro
      await p.dormir(p.esperas[tentativa])
    }
  }
}
```

`lib/ai/client.ts`, descrito:
- `IaError extends Error`, com `name = "IaError"`, `code: string` e `repetivel: boolean`. A mensagem é fixa por código ("Falha ao gerar a resposta da IA."), sem nada do provedor.
- `gerarResposta(mensagens, opcoes: { fetch?: typeof fetch } = {})`:
  1. Lê `OPENROUTER_API_KEY` e `OPENROUTER_MODEL`. Se faltar uma: `IaError("configuracao", false)`.
  2. Faz `POST https://openrouter.ai/api/v1/chat/completions`:
     - headers como objeto simples: `Authorization: Bearer <chave>`, `Content-Type: application/json` e `X-Title: Nextech`;
     - corpo `{ model, messages, max_tokens: 600, provider: { data_collection: "deny", zdr: true } }`;
     - `signal: AbortSignal.timeout(20_000)`.
  3. Se o `fetch` lançar (rede ou timeout): `IaError("rede", true)`. Se a resposta não for ok: `IaError("http-<status>", status === 429 || status >= 500)`. O corpo da resposta de erro nunca é lido para a mensagem.
  4. `choices[0].message.content` com `trim`. Se vier vazio: `IaError("resposta-vazia", true)`.
  5. Devolve `{ texto, modelo: json.model ?? model, tokensDeEntrada: usage?.prompt_tokens ?? null, tokensDeSaida: usage?.completion_tokens ?? null }`.
- O `code` é o campo que `erroParaLog` lê, e por isso aparece no log.

- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(ai): client do OpenRouter com política de dados e novas tentativas`.

---

### Tarefa 5: Client da Cloud API

**Arquivos:** criar `lib/whatsapp/client.ts` e `lib/whatsapp/client.test.ts`.

**Interfaces:**
- Produz:
  - `MetaError` (`name = "MetaError"`, `code`, `status` e `repetivel`);
  - `enviarTexto({ phoneNumberId, tokenCifrado, para, texto }, { fetch? }) → { waMessageId }`;
  - `numeroPertenceAoWaba({ wabaId, phoneNumberId, token }, { fetch? }) → boolean`.

- [ ] **Passo 1: teste que falha**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { enviarTexto, numeroPertenceAoWaba } from "./client"

const TOKEN = "token-da-clinica-de-teste"
const PARA = "5500123456789"
const versaoOriginal = process.env.WHATSAPP_API_VERSION

beforeEach(() => {
  process.env.WHATSAPP_API_VERSION = "v99.0"
})
afterEach(() => {
  if (versaoOriginal === undefined) delete process.env.WHATSAPP_API_VERSION
  else process.env.WHATSAPP_API_VERSION = versaoOriginal
})

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })
type Chamada = [string, RequestInit & { headers: Record<string, string> }]

describe("enviarTexto (Cloud API)", () => {
  it("envia com o token decifrado e devolve o id da Meta", async () => {
    const fetch = vi.fn(async () =>
      json(200, { messaging_product: "whatsapp", contacts: [{ input: PARA, wa_id: PARA }], messages: [{ id: "wamid.resposta" }] }),
    )
    await expect(
      enviarTexto({ phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, texto: "Olá!" }, { fetch }),
    ).resolves.toEqual({ waMessageId: "wamid.resposta" })

    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe("https://graph.facebook.com/v99.0/123/messages")
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: PARA,
      type: "text",
      text: { preview_url: false, body: "Olá!" },
    })
  })

  it("erro da Meta vira MetaError com o código, sem o texto, o número nem o token", async () => {
    const fetch = vi.fn(async () =>
      json(400, { error: { message: `(#131047) Re-engagement message to ${PARA}`, type: "OAuthException", code: 131047 } }),
    )
    const erro = await enviarTexto(
      { phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, texto: "Sua consulta" },
      { fetch },
    ).catch((e: unknown) => e)
    expect(erro).toMatchObject({ name: "MetaError", code: "131047", status: 400, repetivel: false })
    const texto = inspect(erro)
    for (const segredo of [TOKEN, PARA, "Sua consulta"]) expect(texto).not.toContain(segredo)
  })

  it("limite de taxa é o único erro repetível", async () => {
    const porStatus = vi.fn(async () => json(429, { error: { code: 4 } }))
    const porCodigo = vi.fn(async () => json(400, { error: { code: 130429 } }))
    const servidor = vi.fn(async () => json(500, { error: { code: 1 } }))
    const base = { phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, texto: "oi" }
    await expect(enviarTexto(base, { fetch: porStatus })).rejects.toMatchObject({ repetivel: true })
    await expect(enviarTexto(base, { fetch: porCodigo })).rejects.toMatchObject({ repetivel: true })
    // Um 5xx pode ter enviado: repetir mandaria a resposta duas vezes.
    await expect(enviarTexto(base, { fetch: servidor })).rejects.toMatchObject({ repetivel: false })
  })

  it("sem a versão da API na env: erro de configuração, sem chamar a rede", async () => {
    delete process.env.WHATSAPP_API_VERSION
    const fetch = vi.fn()
    await expect(
      enviarTexto({ phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, texto: "oi" }, { fetch }),
    ).rejects.toMatchObject({ name: "MetaError", code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("numeroPertenceAoWaba (prova de posse na conexão)", () => {
  it("confere o número na lista do WABA, com o token informado", async () => {
    const fetch = vi.fn(async () => json(200, { data: [{ id: "111" }, { id: "123" }] }))
    await expect(numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch })).resolves.toBe(true)
    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe("https://graph.facebook.com/v99.0/waba1/phone_numbers?fields=id&limit=100")
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)

    const outro = vi.fn(async () => json(200, { data: [{ id: "111" }] }))
    await expect(numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch: outro })).resolves.toBe(false)
  })

  it("token recusado vira MetaError", async () => {
    const fetch = vi.fn(async () => json(401, { error: { code: 190, message: "Invalid OAuth access token" } }))
    await expect(
      numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch }),
    ).rejects.toMatchObject({ name: "MetaError", code: "190", status: 401 })
  })
})
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3: implementação** (`lib/whatsapp/client.ts`), descrita:
- `MetaError extends Error`, com `name = "MetaError"`, `code: string`, `status: number | null` e `repetivel: boolean`, e mensagem fixa.
- Uma função interna `chamar(url, init, fetch)`:
  - lança `MetaError("rede", null, false)` quando o `fetch` lança;
  - com resposta não ok, lê só `error.code` do JSON e ignora `message`, que cita o número. O código vira string, ou `http-<status>` quando não vem.
  - `repetivel = status === 429 || code === "130429"`.
- A versão sai de `WHATSAPP_API_VERSION`. Se faltar: `MetaError("configuracao", null, false)`.
- `enviarTexto`:
  - `decifrarSegredo(tokenCifrado)` aqui dentro, e em nenhum outro lugar;
  - `POST https://graph.facebook.com/<v>/<phoneNumberId>/messages` com o corpo do teste e `signal: AbortSignal.timeout(15_000)`;
  - devolve `messages[0].id`. Sem id: `MetaError("resposta-sem-id", status, false)`.
- `numeroPertenceAoWaba`: `GET .../<wabaId>/phone_numbers?fields=id&limit=100` e `data.some((n) => n.id === phoneNumberId)`.

- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `feat(whatsapp): client da Cloud API com envio de texto e prova de posse do número`.

---

### Tarefa 6: Migration das respostas da IA

Carregue `supabase-postgres-best-practices` antes. O estilo é o das migrations da parte 1.

**Arquivos:** criar `supabase/migrations/20260927150000_ai_replies.sql` e `tests/rls/ai-replies.test.ts`.

**Conteúdo da migration:**

1. **Enums:**
   - `message_delivery_status` (`pending`, `sent`, `delivered`, `read`, `failed`);
   - `message_category` (`SERVICE`, `MARKETING`, `UTILITY`).
2. **`messages`, colunas novas:**
   - `delivery_status`, `delivery_updated_at` e `delivery_error_code text`;
   - `category`, `within_24h_window boolean` e `billable boolean`;
   - `reply_to_message_id uuid`.
3. **`messages`, constraints:**
   - `unique (id, clinic_id)`;
   - FK `(reply_to_message_id, clinic_id)` → `messages(id, clinic_id)` `on delete cascade`;
   - índice único parcial `on (reply_to_message_id) where reply_to_message_id is not null`: uma resposta por mensagem do paciente, e a trava contra resposta dupla;
   - `check (author <> 'ai' or (delivery_status, category, within_24h_window, billable e reply_to_message_id todos não nulos))`;
   - `check (delivery_error_code is null or delivery_status = 'failed')`.
4. **`conversations.ai_failed_at timestamptz`**, com comentário: o marco da falha que passou a conversa para a equipe, e da retomada em 24h.
5. **Funções**, todas `plpgsql`, `security invoker` e `set search_path = ''`. O `execute` é revogado de `public, anon, authenticated` e concedido só a `service_role`.
   - **`reserve_ai_reply(p_clinic_id, p_conversation_id, p_reply_to_message_id, p_content_encrypted, p_occurred_at, p_within_window, p_billable) returns uuid`:**
     - recusa com `22023` se `p_reply_to_message_id` não for uma mensagem do paciente daquela conversa e clínica;
     - insere a mensagem `outbound`/`ai`/`text` com `delivery_status = pending` e `category = SERVICE`, `on conflict (reply_to_message_id) where reply_to_message_id is not null do nothing`;
     - devolve o id, ou nulo quando já havia resposta.
   - **`confirm_ai_reply(p_clinic_id, p_message_id, p_wa_message_id, p_sent_at) returns table (ai_response_count int, session_closed boolean)`:**
     - `update messages set wa_message_id, delivery_status = 'sent', delivery_updated_at = p_sent_at, occurred_at = p_sent_at where id and clinic_id and delivery_status = 'pending'`;
     - sem linha, devolve vazio, porque a confirmação é idempotente;
     - na sessão `open` da conversa (`for update`): `ai_response_count + 1`, `last_message_at = greatest(...)` e, ao chegar a 5, `closed_by_count` com `closed_at = p_sent_at` (atendimento-billing-v1, regra 2). Sem sessão aberta, não mexe em sessão;
     - `conversations.last_message_at = greatest(...)`.
   - **`fail_ai_reply(p_clinic_id, p_conversation_id, p_message_id uuid, p_error_code text)`:**
     - com `p_message_id`: `delivery_status = failed`, `delivery_error_code` e `delivery_updated_at = now()`, só se ainda `pending`;
     - sempre: `conversations set handled_by = 'human', ai_failed_at = now()`, filtrado por id e clínica.

**Casos do teste** (`tests/rls/ai-replies.test.ts`, no padrão de `tests/rls/conversations.test.ts`, com um login por usuário):
- **Cenário:**
  - clínica A com agente e paciente, e uma mensagem do paciente registrada pela `register_whatsapp_message`;
  - clínica B com uma conversa também;
  - um membro de A.
- **Casos:**
  1. O membro e o anônimo não executam nenhuma das três funções (`42501`).
  2. A reserva devolve o id, e a segunda reserva para a mesma mensagem devolve nulo.
  3. Reservar respondendo a mensagem de outra conversa, ou de outra clínica, dá `22023`.
  4. Confirmar grava `wa_message_id` e `sent`, soma 1 na sessão aberta e atualiza `last_message_at` da conversa. A segunda confirmação não soma de novo.
  5. Cinco respostas confirmadas fecham a sessão (`closed_by_count`, `closed_at` = envio da quinta). A sexta não abre sessão.
  6. A falha com mensagem marca `failed` e o código. A conversa passa a `human`, com `ai_failed_at`. Sem mensagem, só a conversa muda.
  7. O check recusa (`23514`):
     - mensagem da IA sem instrumentação, inserida direto;
     - código de erro sem `failed`.

- [ ] **Passo 1:** escrever o teste. **Passo 2:** rodar (FALHA). **Passo 3:** escrever a migration. **Passo 4:** `supabase db push --dry-run`, conferir que só ela entra, e aplicar. **Passo 5:** rodar este teste e `tests/rls/conversations.test.ts` (PASSA).
- [ ] **Passo 6:** commit `feat(conversations): reserva, confirmação e falha da resposta da IA, com custo e entrega`.

---

### Tarefa 7: Orquestração da resposta

**Arquivos:**
- Criar: `lib/conversations/resposta.ts`, `lib/conversations/status.ts` e `tests/conversations/resposta.test.ts`.
- Alterar: `lib/conversations/recepcao.ts`, que ganha `clinicId` no `ResultadoDaRecepcao`, e o caso de contrato em `tests/whatsapp/webhook.test.ts`.

**Interfaces:**
- Consome as tarefas 1 a 6, `decifrarConteudo`/`cifrarConteudo` e `erroParaLog`.
- Produz:
  - `JANELA_DE_AGRUPAMENTO_MS = 10_000`;
  - `DesfechoDaResposta`: `"respondida" | "agrupada" | "ja-respondida" | MotivoDoSilencio | "falha-da-ia" | "falha-no-envio"`;
  - `responderConversa(r, deps?)`;
  - `receberStatus(e: EventoDeStatusDoWebhook): Promise<void>`.

**`responderConversa(r: ResultadoDaRecepcao, deps: Dependencias = padrao)`:**
- `Dependencias`:
  - `gerar(mensagens) → Promise<string>`, que por padrão é `comRetentativas(() => gerarResposta(m), { esperas: ESPERAS_DA_IA_MS, repetivel: IaError repetível, dormir })` e devolve o `.texto`;
  - `enviar(p) → Promise<{ waMessageId }>`, que por padrão é `comRetentativas(() => enviarTexto(p), { esperas: [1000], repetivel: MetaError repetível, dormir })`;
  - `dormir(ms)` e `agora()`.
- Tudo pelo `serviceContext`, e toda query filtra `clinic_id = r.clinicId`. Os passos:
  1. `await deps.dormir(JANELA_DE_AGRUPAMENTO_MS)`.
  2. Lê a conversa (`handled_by`, `is_urgent`, `human_took_over_at`, `ai_failed_at`, `last_inbound_at`, `agent_id` e `patient_id`).
  3. Lê a última mensagem do paciente na conversa (`order occurred_at desc, created_at desc limit 1`). Se não for `r.messageId`: `"agrupada"`.
  4. Lê o agente, com `status`, `whatsapp_phone_number_id`, `whatsapp_access_token_encrypted`, `specialty`, `persona_instructions`, `greeting_message` e `business_hours` (parse com `businessHoursSchema`, e `{}` quando falhar). `agenteAtivo = status === "active"` e número e token presentes.
  5. `decidirResposta`. Sem resposta, devolve o motivo e não loga nada: é caminho normal.
  6. Com `retoma`: `update conversations set handled_by = 'ai' where id, clinic_id, handled_by = 'human' and is_urgent = false`.
  7. Monta o contexto:
     - o histórico, com as últimas `TAMANHO_DO_HISTORICO` mensagens (`author`, `media_type`, `content_encrypted` e `content_redacted_at`, decifradas);
     - `clinics.legal_name`;
     - os procedimentos ativos (`name`, `duration_minutes` e `price`);
     - os convênios ativos (`name`).
  8. `deps.gerar(montarConversa(...))`. Se falhar: `fail_ai_reply(clinic, conversa, null, code)`, log `{ etapa: "ia", ...erroParaLog }` e `"falha-da-ia"`.
  9. `custoDaResposta({ enviadaEm: deps.agora(), ultimaDoPaciente: last_inbound_at })`, depois `reserve_ai_reply` com `cifrarConteudo(clinicId, texto)`. Se vier nulo: `"ja-respondida"`.
  10. Lê o telefone do paciente (`patients.whatsapp_phone_number`, sem o `+`) e chama `deps.enviar`. Se falhar: `fail_ai_reply(clinic, conversa, reserva, code)`, log `{ etapa: "envio", ...erroParaLog }` e `"falha-no-envio"`.
  11. `confirm_ai_reply(clinic, reserva, waMessageId, deps.agora())` e `"respondida"`.
- Os erros inesperados (banco fora do ar) sobem, e quem agendou loga.

**`receberStatus(e)`:**
- Agente pelo `phoneNumberId`, com o WABA conferido como na recepção. Sem agente ou com WABA divergente, devolve.
- Depois, `update messages set delivery_status = e.status, delivery_updated_at = e.ocorridoEm, delivery_error_code = e.codigoDoErro where clinic_id, wa_message_id = e.waMessageId and delivery_status in estadosQueAvancamPara(e.status)`.
- Status de mensagem que não é nossa (eco, ou de antes do Nextech) não acha linha, e está tudo bem.

**Casos do teste** (`tests/conversations/resposta.test.ts`):
- **Como roda:**
  - contra o banco real;
  - a clínica em `healthtech`, com agente `active` e o token `cifrarSegredo("token-de-teste")`, e procedimento e convênio cadastrados;
  - mensagens criadas por `receberMensagem(interpretarWebhook(fixture)[0])`;
  - `deps` falso: `dormir` não espera, `gerar` e `enviar` são `vi.fn` que capturam os argumentos, e `agora` é fixo, dentro da janela e depois de 1º/out.
- **Casos:**
  1. **Responde:**
     - a mensagem `ai`/`outbound` decifra para o texto gerado, com `sent`, o `wa_message_id` do `enviar`, `SERVICE`, `within_24h_window` e `billable`;
     - a sessão fica com `ai_response_count = 1`;
     - o `enviar` recebe o `wa_id` sem `+` e o token cifrado do agente;
     - o `gerar` recebe o nome da clínica no system prompt e o texto do paciente, e nenhuma mensagem enviada ao modelo contém o telefone.
  2. **Agrupamento:** duas mensagens seguidas. A resposta pela primeira devolve `"agrupada"` sem chamar `gerar`, e a pela segunda responde. O `gerar` recebe as duas numa mensagem `user` só.
  3. **Resposta dupla:** duas chamadas simultâneas pela mesma mensagem dão um `"respondida"` e um `"ja-respondida"`, com `enviar` chamado uma vez.
  4. **Humano atendendo:** eco há 1 h dá `"humano-atendendo"`, sem `gerar`.
  5. **Retomada:** com o eco há 25 h e uma mensagem nova do paciente, responde, e a conversa volta para `ai`.
  6. **Urgente**, com `is_urgent` e `human` via `service_role`: `"urgente"`.
  7. **Agente pausado:** `"agente-fora-do-ar"`.
  8. **Fora da janela**, com `agora` 25 h depois: `"fora-da-janela"`.
  9. **Falha da IA** (`gerar` lança `IaError("http-503", true)`):
     - devolve `"falha-da-ia"`, sem mensagem da IA e sem `enviar`;
     - a conversa passa a `human`, com `ai_failed_at`;
     - com `console.error` espionado, o log passa pelo `logPermitido` e não contém o texto do paciente.
  10. **Falha no envio** (`enviar` lança `MetaError`): a mensagem fica `failed`, com o código, e a conversa passa a `human`.
  11. **Cinco respostas** fecham a sessão por contagem.
  12. **Status:** `receberStatus` avança `sent` → `read`. O `delivered` atrasado não volta, e o `failed` depois de `read` é ignorado.

- [ ] **Passo 1:** escrever o teste. **Passo 2:** rodar (FALHA). **Passo 3:** implementar. **Passo 4:** rodar (PASSA), e rodar `tests/whatsapp` (o contrato ganhou `clinicId`).
- [ ] **Passo 5:** commit `feat(conversations): resposta da IA com agrupamento, retomada, falha e contagem`.

---

### Tarefa 8: A rota agenda a resposta e lê o status

**Arquivos:**
- Alterar: `app/api/whatsapp/webhook/route.ts`, `tests/whatsapp/webhook-log.test.ts` e `tests/whatsapp/webhook.test.ts`, que passa a fazer `vi.mock("next/server")` de `after`.

**Rota:**
- `export const maxDuration = 120`. O pior caso é o agrupamento (10 s), três tentativas de IA (20 s cada, mais 5 s de espera) e o envio.
- No laço:
  - `mensagem`: com `r = await receberMensagem(evento)` e `r` sendo paciente, nova e com agente ativo, agenda `after(() => responderEmSegundoPlano(r))`. Esse callback captura qualquer erro e loga `{ etapa: "resposta", ...erroParaLog }`;
  - `status`: `await receberStatus(evento)`;
  - `conta`: como está.
- **Falha transitória pula a mesma conversa** (decisão 9). Depois de uma falha transitória numa mensagem, as mensagens seguintes com o mesmo `phoneNumberId` e `waIdDoPaciente` no mesmo POST são puladas e contam como transitórias. O 500 faz a Meta reenviar o lote, e a ordem se mantém.

**Casos do teste:**
- **Com a recepção simulada** (`webhook-log.test.ts`, com `vi.mock("next/server")` guardando os callbacks do `after`):
  1. Paciente, nova e agente ativo agenda uma resposta. Eco, reenvio (`nova: false`) e agente pausado não agendam.
  2. Uma falha transitória na primeira mensagem de um paciente pula a segunda do mesmo paciente, mas não a de outro paciente. Resposta 500.
  3. Um erro dentro do callback do `after` é logado só com metadado e não derruba nada.
- **De ponta a ponta:** um status `read` pelo POST avança a mensagem da IA que a tarefa 7 gravou.

- [ ] **Passo 1:** testes. **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** `npx vitest run tests/whatsapp tests/architecture` (PASSA).
- [ ] **Passo 5:** commit `feat(whatsapp): webhook agenda a resposta da IA e registra o status de entrega`.

---

### Tarefa 9: Prova de posse do número na conexão

**Arquivos:**
- Alterar: `lib/agent-config/mutations.ts`.
- Criar: `lib/agent-config/conexao.test.ts`, com o contexto simulado como em `lib/patients/anonimizacao.test.ts` e o `fetch` simulado com `vi.stubGlobal`.

**`connectWhatsapp`:** depois do parse e antes de gravar, `numeroPertenceAoWaba({ wabaId, phoneNumberId, token })`.
- Se vier `false`: `AgentMutationError` com "Este número não pertence a esta conta do WhatsApp Business."
- Se vier `MetaError`: `AgentMutationError` com "A Meta não confirmou estas credenciais. Confira o token e os IDs."
- Em nenhum dos dois a mensagem leva o token.

**Casos:**
1. Número que pertence ao WABA: grava, como hoje.
2. Número de outro WABA: recusa, sem nenhum `update`.
3. Token recusado pela Meta: recusa, sem `update`, e o erro não contém o token.

- [ ] **Passo 1:** teste. **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA, e rodar `lib/agent-config`.
- [ ] **Passo 5:** commit `fix(agent-config): conexão do WhatsApp exige prova de posse do número (achado S1)`.

---

### Tarefa 10: Documentação

- [ ] **Passo 1:** `docs/specs/conversation-engine-v1.md`:
  - na seção de implementação, a parte 2 e as decisões 1 a 10;
  - nos critérios de aceite, marcar o que esta parte cumpre, que é resposta, duplicidade, eco que silencia, retomada e falha do OpenRouter;
  - em "Em aberto", a conferência de `billable` com o `pricing` da Meta.
- [ ] **Passo 2:** `docs/specs/atendimento-billing-v1.md`: fechamento por contagem implementado.
- [ ] **Passo 3:** `docs/infra-setup.md`:
  - OpenRouter: `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` na Vercel, e o toggle de ZDR do grupo Google na conta, como segunda camada;
  - Meta: `WHATSAPP_API_VERSION` na Vercel;
  - a conexão agora confere o número na Graph API.
- [ ] **Passo 4:** `docs/status.md` e `docs/roadmap.md`, com a parte 2 de 5. Riscar o bloqueio de go-live da posse do número e deixar a parte 3 como pré-requisito do go-live. Neste plano, o status da execução.
- [ ] **Passo 5:** memória `nextech-arquitetura-decisoes`, com as decisões 1, 2 e 4.
- [ ] **Passo 6:** commit `docs: fecha a parte 2 do motor de conversa no plano, specs, roadmap e status`.

---

## Verificação final (antes da tarefa 10)

- [ ] `npx vitest run` inteiro (a saída inteira gravada em arquivo e lida, sem `| tail` mascarando o código de saída), `npx tsc --noEmit` e `npm run build`.
- [ ] Revisão pelos subagentes `qa-reviewer` e `security-reviewer`, com os achados tratados. Esta parte manda dado de paciente para fora da infraestrutura, ao OpenRouter.
- [ ] Sem tela nesta parte. Antes de trocar de branch, `git checkout -- CLAUDE.md`.
