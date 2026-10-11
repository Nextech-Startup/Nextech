# Motor de conversa, parte 4 (tela de Conversas): plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. Carregue `supabase-postgres-best-practices` antes das tarefas 2 e 3, e `frontend-design` com `ui-ux` antes das tarefas 4, 5 e 6. Os passos usam checkbox (`- [ ]`).

## Status da execução: ⬜ não iniciado

**Objetivo:** a clínica comum passa a ter a tela real de Conversas, com a fila e a conversa decifradas no servidor, atualização em tempo real, as ações de assumir, devolver e resolver urgência, e o aviso de desconexão do WhatsApp. A equipe Nextech ganha o acesso de suporte com justificativa e trilha. A conta de demonstração continua com a fixture.

**Arquitetura:**
- **Leitura:** pelo client da sessão, com RLS e com o filtro explícito de `clinic_id`. O conteúdo é decifrado só no servidor, e a conversão das linhas na forma da tela é função pura.
- **Escrita do painel:** três RPCs `security definer`, cada uma com um único `update … where <estado esperado>` e o evento em `conversation_events` na mesma transação. O papel é conferido no banco.
- **Tempo real:** `conversations` entra na publicação `supabase_realtime`. O navegador só escuta, e cada mudança dispara `router.refresh()`, para que o servidor redesenhe já decifrado. Nenhum conteúdo passa pelo Realtime.
- **Suporte:** lê pelo `service_role` do contexto de admin, com o filtro de clínica explícito. Abrir a lista exige justificativa (`conversation.list`), e cada conversa aberta grava `conversation.view` antes de aparecer.

**Tecnologias:** Next 16 (App Router, RSC, server actions), Supabase (Postgres, PostgREST, Realtime, Auth), Zod 3.25, Vitest, playwright-core na revisão visual.

**Specs:**
- `docs/specs/conversation-engine-v1.md`: comportamentos 2, 3, 4 e 7, o edge case `ACCOUNT_OFFBOARDED` e o critério de aceite;
- `docs/specs/demo-account-v1.md`: a demonstração continua com a fixture;
- desenho do acesso de suporte: `lib/admin/acesso-de-suporte.ts` e o protótipo `components/admin/tela-de-suporte.tsx`.

## Decisões deste plano

As decisões 1 a 3 são do Jhones (2026-10-11). As demais seguem o desenho que ele aprovou na mesma data.

1. **O achado alto da posse do WhatsApp fica para a sessão seguinte, numa sessão própria.** O `authenticated` grava número, WABA e token em `agents` sem o `conferirPosse`. É outro módulo, muda grant de tabela existente e pede revisão própria. Esta tela aumenta o impacto, porque decifra para o invasor o que ele desviar. Por isso a correção vem antes de qualquer número real.
2. **Responder e nota interna pelo painel ficam fora.** A spec assume a coexistência: a equipe responde pelo WhatsApp Business no celular, e o eco aparece na tela em tempo real. No lugar do compositor, a tela real diz como responder. A demonstração mantém o protótipo.
3. **As ações do painel deixam trilha** em `conversation_events`, com quem agiu e quando. Os eventos do motor (falha da IA, qualificado) saem das colunas que já existem, sem tocar no webhook.
4. **A RPC trava só a linha da conversa.** Um `update` com a condição de estado é atômico, porque o Postgres reavalia o `where` na versão travada. Ela não trava paciente nem agente, então não entra na ordem de trava paciente → agente → conversa e não forma ciclo com a reserva da IA.
5. **A resposta da RPC é `ok`, `sem-mudanca` ou `nao-encontrada`.** Sem permissão também volta `nao-encontrada`, para que a resposta não diga se a conversa existe em outra clínica.
6. **O papel fica no banco, igual ao menu:** owner e staff, os mesmos `roles` de Conversas no `DASHBOARD_NAV`. O teste de RLS prova que o profissional recebe `nao-encontrada`.
7. **Devolver para a IA não responde a mensagem pendente.** A IA responde a partir da próxima mensagem do paciente, como diz o comportamento 3. A tela avisa isso.
8. **A fila traz as 100 conversas mais recentes e todas as urgentes**, para nenhuma urgência ficar de fora. A busca por nome ou telefone também roda no banco, para achar conversa fora das 100. A busca por nome no banco não ignora acento: é limitação conhecida.
9. **A conversa aberta mostra as 200 mensagens mais recentes**, com um aviso quando o histórico foi cortado.
10. **Resposta da IA que não chegou** (`failed`) aparece na conversa marcada como "não chegou ao paciente" e não conta como última mensagem, nem na fila nem no estado. Se contasse, a conversa com falha apareceria como "a clínica respondeu".
11. **Estado de suporte sem ler mensagem:** "o paciente falou por último" é `last_inbound_at >= last_message_at`. As duas colunas são atualizadas na mesma transação de cada mensagem, então a comparação é exata, e a contagem por clínica não precisa decifrar nem buscar mensagem.
12. **O Realtime só leva estado.** O payload de `conversations` não tem conteúdo nem telefone. A assinatura não usa filtro de clínica para se proteger: quem isola é a RLS, e o teste prova isso assinando sem filtro.
13. **O client do navegador** fica em `lib/supabase/browser.ts`. A trava de fronteira passa a aceitar esse arquivo, e só ele, e exige que só `lib/conversations/ao-vivo.ts` o importe.
14. **No suporte, a trilha vem antes do conteúdo.** A conversa só é devolvida depois que `conversation.view` foi gravado. Se a gravação falhar, nada aparece. `registrarAcao` passa a devolver `boolean`, e os chamadores antigos continuam ignorando o retorno.
15. **Os links do suporte para abrir conversa não fazem prefetch** (`prefetch={false}`): um prefetch gravaria uma abertura que ninguém fez.

## Fora desta parte

- **Sessão seguinte:** a correção da posse do WhatsApp (decisão 1).
- **Responder e nota interna pelo painel; envio de template** (fase 4).
- **Contagem de não lidas:** precisa de estado de leitura por pessoa. A tela real manda `naoLidas: 0`.
- **Alertas na Visão geral** (fase 10). Nesta parte, o alerta é a ordem da fila (urgente primeiro, depois "aguardando", que inclui a falha) e o aviso de desconexão na tela de Conversas.
- **Encerrar o acesso de suporte antes dos 30 min:** o botão some na tela real.
- **Parte 5:** áudio (transcrição e triagem) e preview do agente.

## Restrições globais

- **Banco:**
  - migration aditiva em `supabase/migrations/`, com `--dry-run` antes, aplicada uma de cada vez. Migration e o código que a usa no mesmo commit. O banco é compartilhado com a landing em produção.
  - Função nova: `revoke execute … from public, anon` e `grant` só a quem chama, com teste de negação contra o banco real.
  - Mudar grant de tabela existente pede confirmação do Jhones. Este plano não muda.
- **Dado de paciente:** conteúdo sempre cifrado. Nunca logar conteúdo nem objeto de erro cru: só `erroParaLog`. RLS por `clinic_id`, com teste de isolamento contra o banco real para toda leitura nova, inclusive pelo Realtime.
- **Testes de banco:** um login por usuário por arquivo, e arquivos de banco um de cada vez. Datas no futuro, calculadas na execução, por causa do pg_cron. No fim do arquivo, apagar a clínica antes do usuário: `conversation_events.actor_user_id` é `on delete restrict`.
- **Dado de exemplo:** só na conta de demonstração. Componente e lib não importam nada de `app/`, e lib não importa nada de `components/`.
- **Datas:** formatação só por `lib/formatters`. O "agora" é calculado na página e desce por prop, nunca com `new Date()` dentro de componente.
- **Vitest:** ler o resultado antes de cada commit, com o código de saída real (`; echo exit=$?`, sem `| tail`).
- **`next dev` reescreve o `CLAUDE.md`:** `git checkout -- CLAUDE.md` antes de cada commit e do push.
- **Git:** commits pequenos na `staging`. Nada na `main`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conversations/tipos-da-tela.ts` (novo) | os tipos que a tela consome, vindos de `components/conversations/tipos.ts` |
| `lib/conversations/tela.ts` (novo) | linhas do banco → `ConversaResumo` e `ConversaAberta` (puro) |
| `lib/conversations/busca.ts` (novo) | padrão de busca no banco (puro) |
| `lib/conversations/acoes-do-painel.ts` (novo) | ações, resultado da RPC e mensagem para a tela (puro) |
| `lib/conversations/leitura.ts` (novo) | carrega fila, conversa e avisos com um client e um `clinicId` |
| `lib/conversations/queries.ts` (novo) | a leitura com `requireClinicContext()` |
| `lib/conversations/mutations.ts` (novo) | chama as RPCs do painel |
| `lib/conversations/ao-vivo.ts` (novo) | assinatura do Realtime, estado e agrupamento das chamadas |
| `lib/supabase/browser.ts` (novo) | client do navegador, só para o Realtime |
| `lib/whatsapp/conexao.ts` | `agentesDesconectados` |
| `lib/conversations/decisao.ts` | exporta `marcoDaRetomada` |
| `lib/admin/estado-de-suporte.ts` (novo) | estado e contagens do suporte (puro) |
| `lib/admin/suporte.ts` (novo) | carrega e libera o acesso de suporte, com a trilha |
| `lib/admin/acesso-de-suporte.ts` | `acessosDaTrilha` |
| `lib/admin/audit.ts` | `AdminAction` inclui `AcaoDeSuporte`; `registrarAcao` devolve `boolean` |
| `components/conversations/*` | modos da conversa (protótipo, clínica, suporte), `AoVivo`, `AvisoDeDesconexao` |
| `components/admin/tela-de-suporte.tsx`, `estado.ts`, `tipos.ts` | modo real e o estado `urgente` |
| `app/(dashboard)/dashboard/conversations/page.tsx`, `acoes.ts` | tela real e server action |
| `app/(admin)/admin/conversations/**` | as três rotas do suporte, `acoes.ts` e os `loading.tsx` |
| `lib/navigation/dashboard-nav.ts`, `admin-nav.ts` | Conversas vira `pronto` nos dois menus |
| `supabase/migrations/20261011120000_conversation_panel.sql` | eventos, RPCs e prévia |
| `supabase/migrations/20261011130000_conversations_realtime.sql` | publicação do Realtime |

---

### Tarefa 1: Mapeamento puro da tela

**Arquivos:**
- Criar: `lib/conversations/tipos-da-tela.ts`, `tela.ts`, `tela.test.ts`, `busca.ts`, `busca.test.ts`, `acoes-do-painel.ts` e `acoes-do-painel.test.ts`.
- Alterar: `components/conversations/tipos.ts`, `lib/conversations/decisao.ts` (e o teste), `lib/whatsapp/conexao.ts` (e o teste).

**Interfaces:**
- Produz:
  - `paraResumo(c: LinhaDaConversa, ultima: LinhaDaMensagem | null): ConversaResumo`;
  - `paraConversaAberta(c, mensagens, eventos, opcoes?: { historicoCortado?: boolean }): ConversaAberta`;
  - `textoDaMensagem`, `entregaDaMensagem`, `ultimaVisivel` e os tipos `LinhaDaConversa`, `LinhaDaMensagem`, `LinhaDoEvento`;
  - `padraoDeBusca(q: string): { nome: string | null; telefone: string | null } | null`;
  - `AcaoDoPainel`, `ehAcaoDoPainel`, `RPC_DA_ACAO`, `ResultadoDaAcao`, `lerResultadoDaAcao` e `mensagemDaAcao`;
  - `marcoDaRetomada(humano: string | null, falha: string | null): string | null`;
  - `agentesDesconectados(agentes, eventos): AvisoDeDesconexao[]`.

**Tipos:**
- O conteúdo de `components/conversations/tipos.ts` vai para `lib/conversations/tipos-da-tela.ts`. O arquivo antigo vira `export type { … } from "@/lib/conversations/tipos-da-tela"`, e os componentes e as fixtures não mudam de import.
- Acréscimos:
  - no item `mensagem`, `midia?: "audio" | "image" | "document" | "other"` e `entrega?: "enviando" | "nao-entregue"`;
  - em `ConversaAberta`, `historicoCortado?: boolean`;
  - o comentário de `humanoAssumiuEm` passa a dizer "marco da retomada: o mais recente entre a última ação humana e a falha da IA".

**`lib/conversations/decisao.ts`:** `maisRecente` vira `export function marcoDaRetomada(humano: string | null, falha: string | null): string | null`, com o mesmo corpo, e `decidirResposta` passa a usá-la. Teste novo em `decisao.test.ts`:

```ts
describe("marcoDaRetomada", () => {
  it("é o mais recente dos dois", () => {
    expect(marcoDaRetomada("2026-10-11T10:00:00Z", "2026-10-11T11:00:00Z")).toBe("2026-10-11T11:00:00Z")
    expect(marcoDaRetomada("2026-10-11T12:00:00Z", "2026-10-11T11:00:00Z")).toBe("2026-10-11T12:00:00Z")
  })
  it("com um só, é ele; sem nenhum, null", () => {
    expect(marcoDaRetomada(null, "2026-10-11T11:00:00Z")).toBe("2026-10-11T11:00:00Z")
    expect(marcoDaRetomada("2026-10-11T10:00:00Z", null)).toBe("2026-10-11T10:00:00Z")
    expect(marcoDaRetomada(null, null)).toBeNull()
  })
})
```

**Lógica pura** (`lib/conversations/tela.ts`):

```ts
import { marcoDaRetomada } from "./decisao"
import type { Autor, ConversaAberta, ConversaResumo, ItemDaConversa, PacienteDaConversa } from "./tipos-da-tela"

export type TipoDeMidia = "text" | "audio" | "image" | "document" | "other"
export type StatusDeEntrega = "pending" | "sent" | "delivered" | "read" | "failed"
export type EventoDoPainel = "assumed" | "returned_to_ai" | "urgency_resolved"

/** Uma conversa como a leitura a monta, com agente e paciente já resolvidos. */
export type LinhaDaConversa = {
  id: string
  handled_by: "ai" | "human"
  is_urgent: boolean
  human_took_over_at: string | null
  ai_failed_at: string | null
  qualified_at: string | null
  last_inbound_at: string | null
  last_message_at: string
  agente: string
  paciente: {
    id: string
    name: string | null
    whatsapp_phone_number: string
    consent_given_at: string | null
    opted_out: boolean
    created_at: string
    convenio: string | null
  }
}

/** Uma mensagem com o conteúdo já decifrado no servidor. */
export type LinhaDaMensagem = {
  id: string
  author: Autor
  media_type: TipoDeMidia
  /** `null`: mídia sem legenda, conteúdo apagado ou decifra que falhou. */
  texto: string | null
  /** Apagada pela exclusão LGPD do paciente (`content_redacted_at`). */
  redigida: boolean
  /** A decifra falhou: chave, clínica ou dado não conferem. */
  ilegivel: boolean
  occurred_at: string
  delivery_status: StatusDeEntrega | null
}

export type LinhaDoEvento = {
  id: string
  event: EventoDoPainel
  actor_email: string | null
  occurred_at: string
}

export const ROTULO_DA_MIDIA: Record<Exclude<TipoDeMidia, "text">, string> = {
  audio: "Áudio",
  image: "Imagem",
  document: "Documento",
  other: "Mensagem sem texto (vídeo, figurinha, localização ou contato)",
}

export const TEXTO_REDIGIDO = "Conteúdo apagado a pedido do paciente."
export const TEXTO_ILEGIVEL = "Não foi possível mostrar esta mensagem."

export function textoDaMensagem(
  m: Pick<LinhaDaMensagem, "media_type" | "texto" | "redigida" | "ilegivel">,
): string {
  if (m.redigida) return TEXTO_REDIGIDO
  if (m.ilegivel) return TEXTO_ILEGIVEL
  if (m.texto) return m.texto
  // Texto sem conteúdo e sem redação não deveria existir (o banco recusa):
  // se aparecer, a tela não inventa.
  return m.media_type === "text" ? TEXTO_ILEGIVEL : ROTULO_DA_MIDIA[m.media_type]
}

/** Só o que o Nextech enviou tem entrega a mostrar: o paciente e o eco do celular não. */
export function entregaDaMensagem(
  m: Pick<LinhaDaMensagem, "author" | "delivery_status">,
): "enviando" | "nao-entregue" | undefined {
  if (m.author === "patient") return undefined
  if (m.delivery_status === "pending") return "enviando"
  if (m.delivery_status === "failed") return "nao-entregue"
  return undefined
}

/**
 * A última mensagem que o paciente pode ter visto. A resposta que não
 * chegou fica fora: contada, a conversa com falha pareceria respondida
 * pela clínica.
 */
export function ultimaVisivel(mensagens: readonly LinhaDaMensagem[]): LinhaDaMensagem | null {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    if (entregaDaMensagem(mensagens[i]) !== "nao-entregue") return mensagens[i]
  }
  return null
}

const EVENTO_NA_TELA = {
  assumed: "humano_assumiu",
  returned_to_ai: "devolvida_para_ia",
  urgency_resolved: "urgencia_resolvida",
} as const satisfies Record<EventoDoPainel, string>

function paraPaciente(p: LinhaDaConversa["paciente"]): PacienteDaConversa {
  return {
    id: p.id,
    nome: p.name,
    telefone: p.whatsapp_phone_number,
    convenio: p.convenio,
    consentimentoEm: p.consent_given_at,
    optOut: p.opted_out,
    desde: p.created_at,
    // Sequências (fase 4) e agenda (fase 5) ainda não existem.
    sequenciaAtiva: null,
    proximaConsulta: null,
  }
}

export function paraResumo(c: LinhaDaConversa, ultima: LinhaDaMensagem | null): ConversaResumo {
  return {
    id: c.id,
    paciente: paraPaciente(c.paciente),
    agente: c.agente,
    atendidaPor: c.handled_by,
    urgente: c.is_urgent,
    ultimaDoPaciente: c.last_inbound_at,
    ultima: ultima
      ? { autor: ultima.author, previa: textoDaMensagem(ultima), em: ultima.occurred_at }
      : { autor: "patient", previa: "", em: c.last_message_at },
    // Sem estado de leitura por pessoa: fica para quando existir.
    naoLidas: 0,
  }
}

function paraItemDeMensagem(m: LinhaDaMensagem): ItemDaConversa {
  const entrega = entregaDaMensagem(m)
  return {
    tipo: "mensagem",
    id: m.id,
    autor: m.author,
    texto: textoDaMensagem(m),
    em: m.occurred_at,
    ...(m.media_type !== "text" ? { midia: m.media_type } : {}),
    ...(entrega ? { entrega } : {}),
  }
}

function paraItemDeEvento(e: LinhaDoEvento): ItemDaConversa {
  return {
    tipo: "evento",
    id: e.id,
    evento: EVENTO_NA_TELA[e.event],
    em: e.occurred_at,
    ...(e.actor_email ? { detalhe: e.actor_email } : {}),
  }
}

/**
 * A conversa aberta: mensagens, eventos do painel e os eventos que saem
 * das colunas (qualificação e a última falha da IA), em ordem de tempo.
 * No mesmo instante, a mensagem vem antes do evento (o sort é estável).
 */
export function paraConversaAberta(
  c: LinhaDaConversa,
  mensagens: readonly LinhaDaMensagem[],
  eventos: readonly LinhaDoEvento[],
  opcoes: { historicoCortado?: boolean } = {},
): ConversaAberta {
  const dasColunas: ItemDaConversa[] = []
  if (c.qualified_at) dasColunas.push({ tipo: "evento", id: `${c.id}:qualificado`, evento: "qualificado", em: c.qualified_at })
  if (c.ai_failed_at) dasColunas.push({ tipo: "evento", id: `${c.id}:falha`, evento: "falha_da_ia", em: c.ai_failed_at })

  const itens = [...mensagens.map(paraItemDeMensagem), ...eventos.map(paraItemDeEvento), ...dasColunas].sort(
    (a, b) => Date.parse(a.em) - Date.parse(b.em),
  )

  return {
    ...paraResumo(c, ultimaVisivel(mensagens)),
    humanoAssumiuEm: marcoDaRetomada(c.human_took_over_at, c.ai_failed_at),
    itens,
    ...(opcoes.historicoCortado ? { historicoCortado: true } : {}),
  }
}
```

**Teste** (`lib/conversations/tela.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import {
  ROTULO_DA_MIDIA,
  TEXTO_ILEGIVEL,
  TEXTO_REDIGIDO,
  entregaDaMensagem,
  paraConversaAberta,
  paraResumo,
  textoDaMensagem,
  ultimaVisivel,
  type LinhaDaConversa,
  type LinhaDaMensagem,
  type LinhaDoEvento,
} from "./tela"

const d = (hhmm: string) => `2026-10-11T${hhmm}:00.000Z`

function conversa(p: Partial<LinhaDaConversa> = {}): LinhaDaConversa {
  return {
    id: "c1",
    handled_by: "ai",
    is_urgent: false,
    human_took_over_at: null,
    ai_failed_at: null,
    qualified_at: null,
    last_inbound_at: d("10:00"),
    last_message_at: d("10:01"),
    agente: "Recepção",
    paciente: {
      id: "p1",
      name: "Paciente Teste",
      whatsapp_phone_number: "+5581900000001",
      consent_given_at: null,
      opted_out: false,
      created_at: d("09:00"),
      convenio: null,
    },
    ...p,
  }
}

function mensagem(p: Partial<LinhaDaMensagem> & { id: string }): LinhaDaMensagem {
  return {
    author: "patient",
    media_type: "text",
    texto: "Oi",
    redigida: false,
    ilegivel: false,
    occurred_at: d("10:00"),
    delivery_status: null,
    ...p,
  }
}

describe("textoDaMensagem", () => {
  it("mostra o texto decifrado", () => {
    expect(textoDaMensagem(mensagem({ id: "1", texto: "Quero marcar" }))).toBe("Quero marcar")
  })

  it("mídia sem legenda vira o rótulo do tipo", () => {
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "audio", texto: null }))).toBe(ROTULO_DA_MIDIA.audio)
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "other", texto: null }))).toBe(ROTULO_DA_MIDIA.other)
  })

  it("mídia com legenda mostra a legenda", () => {
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "image", texto: "Meu exame" }))).toBe("Meu exame")
  })

  it("redigida e ilegível nunca mostram o que veio", () => {
    expect(textoDaMensagem(mensagem({ id: "1", redigida: true, texto: null }))).toBe(TEXTO_REDIGIDO)
    expect(textoDaMensagem(mensagem({ id: "1", ilegivel: true, texto: null }))).toBe(TEXTO_ILEGIVEL)
  })

  it("texto vazio sem redação não inventa conteúdo", () => {
    expect(textoDaMensagem(mensagem({ id: "1", texto: null }))).toBe(TEXTO_ILEGIVEL)
  })
})

describe("entregaDaMensagem", () => {
  it.each([
    ["patient", null, undefined],
    ["human", null, undefined],
    ["ai", "pending", "enviando"],
    ["ai", "failed", "nao-entregue"],
    ["ai", "sent", undefined],
    ["ai", "read", undefined],
  ] as const)("%s com %s → %s", (author, status, esperado) => {
    expect(entregaDaMensagem({ author, delivery_status: status })).toBe(esperado)
  })
})

describe("ultimaVisivel", () => {
  it("pula a resposta que não chegou", () => {
    const ms = [
      mensagem({ id: "1" }),
      mensagem({ id: "2", author: "ai", delivery_status: "failed" }),
    ]
    expect(ultimaVisivel(ms)?.id).toBe("1")
  })

  it("sem mensagem, null", () => {
    expect(ultimaVisivel([])).toBeNull()
  })
})

describe("paraResumo", () => {
  it("leva estado, paciente e a última mensagem", () => {
    const r = paraResumo(
      conversa({ handled_by: "human", is_urgent: true }),
      mensagem({ id: "m", texto: "Socorro", occurred_at: d("10:05") }),
    )
    expect(r).toMatchObject({
      id: "c1",
      agente: "Recepção",
      atendidaPor: "human",
      urgente: true,
      ultimaDoPaciente: d("10:00"),
      ultima: { autor: "patient", previa: "Socorro", em: d("10:05") },
      naoLidas: 0,
    })
    expect(r.paciente).toEqual({
      id: "p1",
      nome: "Paciente Teste",
      telefone: "+5581900000001",
      convenio: null,
      consentimentoEm: null,
      optOut: false,
      desde: d("09:00"),
      sequenciaAtiva: null,
      proximaConsulta: null,
    })
  })

  it("sem mensagem visível, usa a última atividade da conversa", () => {
    expect(paraResumo(conversa(), null).ultima).toEqual({ autor: "patient", previa: "", em: d("10:01") })
  })
})

describe("paraConversaAberta", () => {
  const mensagens = [
    mensagem({ id: "m1", texto: "Quero marcar", occurred_at: d("10:00") }),
    mensagem({ id: "m2", author: "ai", texto: "Claro!", occurred_at: d("10:01"), delivery_status: "read" }),
    mensagem({ id: "m3", author: "ai", texto: "Temos às 15h", occurred_at: d("10:03"), delivery_status: "failed" }),
  ]
  const eventos: LinhaDoEvento[] = [
    { id: "e1", event: "assumed", actor_email: "ana@exemplo.test", occurred_at: d("10:04") },
  ]
  const c = conversa({
    handled_by: "human",
    qualified_at: d("10:00"),
    ai_failed_at: d("10:03"),
    human_took_over_at: d("10:04"),
  })
  const aberta = paraConversaAberta(c, mensagens, eventos)

  it("junta mensagens, eventos do painel e os das colunas, em ordem", () => {
    expect(aberta.itens.map((i) => i.id)).toEqual(["m1", "c1:qualificado", "m2", "m3", "c1:falha", "e1"])
  })

  it("o evento do painel diz quem agiu", () => {
    expect(aberta.itens.find((i) => i.id === "e1")).toEqual({
      tipo: "evento",
      id: "e1",
      evento: "humano_assumiu",
      em: d("10:04"),
      detalhe: "ana@exemplo.test",
    })
  })

  it("evento sem e-mail não inventa autor", () => {
    const a = paraConversaAberta(c, [], [{ id: "e2", event: "returned_to_ai", actor_email: null, occurred_at: d("11:00") }])
    expect(a.itens.find((i) => i.id === "e2")).not.toHaveProperty("detalhe")
  })

  it("a resposta que não chegou fica marcada e não conta como última", () => {
    expect(aberta.itens.find((i) => i.id === "m3")).toMatchObject({ entrega: "nao-entregue" })
    expect(aberta.ultima).toEqual({ autor: "ai", previa: "Claro!", em: d("10:01") })
  })

  it("o marco da retomada é o mais recente entre a ação humana e a falha", () => {
    expect(aberta.humanoAssumiuEm).toBe(d("10:04"))
    const soFalha = paraConversaAberta(conversa({ handled_by: "human", ai_failed_at: d("10:03") }), mensagens, [])
    expect(soFalha.humanoAssumiuEm).toBe(d("10:03"))
  })

  it("mídia leva o tipo para a tela", () => {
    const a = paraConversaAberta(conversa(), [mensagem({ id: "m", media_type: "audio", texto: null })], [])
    expect(a.itens[0]).toMatchObject({ tipo: "mensagem", midia: "audio", texto: ROTULO_DA_MIDIA.audio })
  })

  it("repassa o histórico cortado só quando houve corte", () => {
    expect(paraConversaAberta(c, mensagens, [], { historicoCortado: true }).historicoCortado).toBe(true)
    expect(aberta).not.toHaveProperty("historicoCortado")
  })
})
```

**Lógica pura** (`lib/conversations/busca.ts`):

```ts
export type PadraoDeBusca = { nome: string | null; telefone: string | null }

/**
 * A busca da fila no banco, para achar conversa fora das 100 mais
 * recentes. Segue a regra de `contemBusca`: com letra, é nome; sem letra,
 * é telefone, só pelos dígitos, e com pelo menos 4 deles ("81" casaria
 * todo DDD 81). `%` e `_` são curingas do LIKE e a barra é o escape: sem
 * escapar, "100%" casaria qualquer nome.
 */
export function padraoDeBusca(q: string): PadraoDeBusca | null {
  const limpo = q.trim().slice(0, 80)
  if (/\p{L}/u.test(limpo)) {
    return { nome: `%${limpo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, telefone: null }
  }
  const digitos = limpo.replace(/\D/g, "")
  return digitos.length >= 4 ? { nome: null, telefone: `%${digitos}%` } : null
}
```

**Teste** (`lib/conversations/busca.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import { padraoDeBusca } from "./busca"

describe("padraoDeBusca", () => {
  it("nome vira ILIKE, sem os espaços das pontas", () => {
    expect(padraoDeBusca(" Maria ")).toEqual({ nome: "%Maria%", telefone: null })
  })

  it("escapa os curingas e a barra", () => {
    expect(padraoDeBusca("100% a_b\\")).toEqual({ nome: "%100\\% a\\_b\\\\%", telefone: null })
  })

  it("sem letra é telefone, só pelos dígitos", () => {
    expect(padraoDeBusca("(81) 9 0000-0001")).toEqual({ nome: null, telefone: "%81900000001%" })
  })

  it("telefone com menos de 4 dígitos, ou vazio, não busca", () => {
    expect(padraoDeBusca("81")).toBeNull()
    expect(padraoDeBusca("   ")).toBeNull()
  })

  it("corta em 80 caracteres", () => {
    expect(padraoDeBusca("a".repeat(200))?.nome).toBe(`%${"a".repeat(80)}%`)
  })
})
```

**Lógica pura** (`lib/conversations/acoes-do-painel.ts`):

```ts
/** O que a equipe faz numa conversa pelo painel (conversation-engine-v1, comportamentos 3 e 4). */
export const ACOES_DO_PAINEL = ["assumir", "devolver", "resolver-urgencia"] as const
export type AcaoDoPainel = (typeof ACOES_DO_PAINEL)[number]

export const RPC_DA_ACAO: Record<AcaoDoPainel, string> = {
  assumir: "assume_conversation",
  devolver: "return_conversation_to_ai",
  "resolver-urgencia": "resolve_conversation_urgency",
}

export const RESULTADOS_DA_ACAO = ["ok", "sem-mudanca", "nao-encontrada"] as const
export type ResultadoDaAcao = (typeof RESULTADOS_DA_ACAO)[number]

export function ehAcaoDoPainel(v: unknown): v is AcaoDoPainel {
  return typeof v === "string" && (ACOES_DO_PAINEL as readonly string[]).includes(v)
}

/** A RPC devolve texto. Fora da lista é defeito nosso, e não decisão do banco. */
export function lerResultadoDaAcao(v: unknown): ResultadoDaAcao {
  if (typeof v === "string" && (RESULTADOS_DA_ACAO as readonly string[]).includes(v)) return v as ResultadoDaAcao
  throw new Error("Resultado desconhecido da ação da conversa.")
}

/** O que a tela diz quando a ação não muda nada. Com `ok`, a tela só atualiza. */
export function mensagemDaAcao(r: ResultadoDaAcao): string | null {
  switch (r) {
    case "ok":
      return null
    case "sem-mudanca":
      return "A conversa já tinha mudado. A tela foi atualizada."
    case "nao-encontrada":
      return "Conversa não encontrada."
  }
}
```

**Teste** (`lib/conversations/acoes-do-painel.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import { ehAcaoDoPainel, lerResultadoDaAcao, mensagemDaAcao } from "./acoes-do-painel"

describe("ações do painel", () => {
  it.each(["assumir", "devolver", "resolver-urgencia"])("%s é ação", (v) => {
    expect(ehAcaoDoPainel(v)).toBe(true)
  })

  it.each(["apagar", "", null, 1])("%j não é", (v) => {
    expect(ehAcaoDoPainel(v)).toBe(false)
  })

  it.each(["ok", "sem-mudanca", "nao-encontrada"])("%s é resultado", (v) => {
    expect(lerResultadoDaAcao(v)).toBe(v)
  })

  it.each([null, "", "OK", 1])("%j lança", (v) => {
    expect(() => lerResultadoDaAcao(v)).toThrow()
  })

  it("ok só atualiza; as outras explicam", () => {
    expect(mensagemDaAcao("ok")).toBeNull()
    expect(mensagemDaAcao("sem-mudanca")).toMatch(/já tinha mudado/)
    expect(mensagemDaAcao("nao-encontrada")).toMatch(/não encontrada/)
  })
})
```

**Lógica pura** (`lib/whatsapp/conexao.ts`, acréscimo):

```ts
export type AvisoDeDesconexao = { agenteId: string; agente: string; desde: string }

/**
 * Os agentes que a Meta desconectou e que ainda não voltaram
 * (conversation-engine-v1, edge case ACCOUNT_OFFBOARDED). O último evento
 * decide, pela hora, e não pela ordem em que a consulta devolveu.
 */
export function agentesDesconectados(
  agentes: readonly { id: string; name: string; temNumero: boolean }[],
  eventos: readonly { agent_id: string; event: EventoDaConta; occurred_at: string }[],
): AvisoDeDesconexao[] {
  return agentes.flatMap((a) => {
    const ultimo = eventos
      .filter((e) => e.agent_id === a.id)
      .reduce<(typeof eventos)[number] | null>(
        (atual, e) => (!atual || Date.parse(e.occurred_at) > Date.parse(atual.occurred_at) ? e : atual),
        null,
      )
    const conexao = conexaoDoWhatsapp({ temNumero: a.temNumero, ultimoEvento: ultimo?.event ?? null })
    return conexao === "desconectado-pela-meta" && ultimo
      ? [{ agenteId: a.id, agente: a.name, desde: ultimo.occurred_at }]
      : []
  })
}
```

**Teste** (`lib/whatsapp/conexao.test.ts`, acréscimo):

```ts
describe("agentesDesconectados", () => {
  const agentes = [
    { id: "a1", name: "Recepção", temNumero: true },
    { id: "a2", name: "Pediatria", temNumero: true },
    { id: "a3", name: "Rascunho", temNumero: false },
  ]

  it("avisa só quem tem a desconexão como último evento e ainda tem número", () => {
    const eventos = [
      { agent_id: "a1", event: "ACCOUNT_OFFBOARDED", occurred_at: "2026-10-10T10:00:00Z" },
      { agent_id: "a2", event: "ACCOUNT_OFFBOARDED", occurred_at: "2026-10-09T10:00:00Z" },
      { agent_id: "a2", event: "ACCOUNT_RECONNECTED", occurred_at: "2026-10-09T12:00:00Z" },
      { agent_id: "a3", event: "ACCOUNT_OFFBOARDED", occurred_at: "2026-10-10T10:00:00Z" },
    ] as const
    expect(agentesDesconectados(agentes, eventos)).toEqual([
      { agenteId: "a1", agente: "Recepção", desde: "2026-10-10T10:00:00Z" },
    ])
  })

  it("decide pela hora, e não pela ordem da lista", () => {
    const eventos = [
      { agent_id: "a2", event: "ACCOUNT_RECONNECTED", occurred_at: "2026-10-09T12:00:00Z" },
      { agent_id: "a2", event: "ACCOUNT_OFFBOARDED", occurred_at: "2026-10-09T10:00:00Z" },
    ] as const
    expect(agentesDesconectados(agentes, eventos)).toEqual([])
  })

  it("sem evento, ninguém está desconectado", () => {
    expect(agentesDesconectados(agentes, [])).toEqual([])
  })
})
```

- [ ] **Passo 1:** testes. **Passo 2:** rodar (FALHA).
- [ ] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) os cinco arquivos de teste, mais `components/conversations/*.test.*` e `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(conversations): mapeamento puro da tela real de Conversas`.

---

### Tarefa 2: Banco do painel, leitura e ações

Carregar `supabase-postgres-best-practices` antes.

**Arquivos:**
- Criar:
  - `supabase/migrations/20261011120000_conversation_panel.sql`;
  - `lib/conversations/leitura.ts`, `queries.ts` e `mutations.ts`;
  - `tests/rls/conversation-panel.test.ts` e `tests/conversations/leitura.test.ts`.

**Interfaces:**
- Consome: tudo da tarefa 1.
- Produz:
  - `type Cliente = ClinicContext["supabase"] | AdminContext["supabase"]`;
  - `carregarFila(supabase, clinicId, opcoes: { busca: string; limite?: number }): Promise<ConversaResumo[]>`, com limite padrão de 100;
  - `carregarConversa(supabase, clinicId, conversaId, opcoes?: { limite?: number }): Promise<ConversaAberta | null>`, com limite padrão de 200;
  - `carregarAvisosDeDesconexao(supabase, clinicId): Promise<AvisoDeDesconexao[]>`;
  - em `queries.ts`, as três com `requireClinicContext()`: `listarConversas({ busca })`, `abrirConversa(id)` e `avisosDeDesconexao()`;
  - em `mutations.ts`, `agirNaConversa(acao: AcaoDoPainel, conversaId: string): Promise<ResultadoDaAcao>`.

**Migration:**
- **Enum** `public.conversation_event`: `assumed`, `returned_to_ai` e `urgency_resolved`.
- **Tabela `public.conversation_events`:**
  - colunas `id`, `clinic_id` (FK `clinics` com `on delete cascade`), `conversation_id`, `event`, `actor_user_id uuid not null references auth.users(id) on delete restrict`, `actor_email text` (e-mail de quem agiu, copiado no momento da ação: é da equipe, e não do paciente) e `occurred_at timestamptz not null default now()`;
  - FK `(conversation_id, clinic_id)` → `conversations(id, clinic_id)` com `on delete cascade`;
  - índices em `(conversation_id, occurred_at)` e em `(clinic_id)`;
  - `enable` e `force row level security`, `revoke all … from anon, authenticated`, `grant select … to authenticated` e uma policy de select por `clinic_id in (select private.current_clinic_ids())`. Sem policy de escrita: só as RPCs escrevem.
- **`private.can_operate_conversations(target_clinic_id uuid) returns boolean`:** `sql`, `security definer`, `stable` e `search_path = ''`. Responde se `auth.uid()` é owner ou staff da clínica, os mesmos `roles` de Conversas no `DASHBOARD_NAV`. `revoke execute … from public, anon, authenticated`, porque só as RPCs a chamam.
- **Três RPCs `public.*(p_conversation_id uuid) returns text`**, `plpgsql`, `security definer` e `search_path = ''`. Todas seguem o mesmo roteiro:
  1. lê o `clinic_id` da conversa. Sem conversa, ou com `can_operate_conversations` falso, devolve `nao-encontrada`;
  2. faz um `update public.conversations … where id = p_conversation_id and <condição> returning id`. Sem linha, devolve `sem-mudanca`;
  3. insere o evento com `auth.uid()` e o e-mail de `auth.users`, e devolve `ok`.

  | Função | Condição | `set` | Evento |
  |---|---|---|---|
  | `assume_conversation` | `handled_by = 'ai' and not is_urgent` | `handled_by = 'human', human_took_over_at = now()` | `assumed` |
  | `return_conversation_to_ai` | `handled_by = 'human' and not is_urgent` | `handled_by = 'ai'` | `returned_to_ai` |
  | `resolve_conversation_urgency` | `is_urgent` | `is_urgent = false, handled_by = 'human', human_took_over_at = now()` | `urgency_resolved` |

  `revoke execute … from public, anon` e `grant execute … to authenticated`, com `comment on function` dizendo a regra.
- **`public.conversation_previews(p_conversation_ids uuid[])`:**
  - devolve `table (conversation_id uuid, author public.message_author, media_type public.message_media_type, content_encrypted text, content_redacted_at timestamptz, occurred_at timestamptz, delivery_status public.message_delivery_status)`;
  - `sql`, `stable` e `security invoker` (a RLS de `messages` vale), com `search_path = ''`;
  - a consulta é `distinct on (conversation_id) … where conversation_id = any(p_conversation_ids) and not (author = 'ai' and delivery_status = 'failed') order by conversation_id, occurred_at desc, created_at desc`;
  - `revoke … from public, anon` e `grant … to authenticated, service_role`.
- Comentário no topo com as decisões 3 a 6.

**Leitura** (`lib/conversations/leitura.ts`). Todas as consultas levam `.eq("clinic_id", clinicId)`: com o `service_role` do suporte, esse filtro é a proteção, e com a sessão ele soma à RLS.
- **`carregarFila`:**
  - três consultas em paralelo: as `limite` mais recentes por `last_message_at desc`; todas com `is_urgent = true`; e, com `padraoDeBusca(busca)`, as conversas dos pacientes que casam, num `select id` em `patients` com `.ilike("name", nome)` ou `.like("whatsapp_phone_number", telefone)` (limite de 50) seguido de `.in("patient_id", ids)`;
  - colunas: as da `LinhaDaConversa`, com o agente (`agents(name)`) e o paciente (`patients(id, name, whatsapp_phone_number, consent_given_at, opted_out, created_at, insurance:insurances(name))`) embutidos. Se o PostgREST achar o embed ambíguo por causa das FKs compostas, buscar agentes e pacientes em duas consultas pelos ids;
  - junta sem repetir, chama `conversation_previews` uma vez com os ids, decifra a prévia e devolve `paraResumo`.
- **`carregarConversa`:**
  - a conversa, com as mesmas colunas, e as mensagens por `occurred_at desc` com `limit(limite + 1)`. Existir a mensagem `limite + 1` vira `historicoCortado`, e a lista é invertida para a ordem do tempo;
  - os eventos de `conversation_events` (`id, event, actor_email, occurred_at`) e `paraConversaAberta`;
  - outra clínica, ou id inexistente, devolve `null`.
- **Decifra:** `decifrarConteudo(clinicId, blob)` dentro de `try`. A falha vira `ilegivel: true` e `console.error("Falha ao decifrar mensagem", { conversa: conversaId, ...erroParaLog(erro) })`, sem o blob. `content_redacted_at` vira `redigida`.
- **`carregarAvisosDeDesconexao`:** agentes da clínica (`id, name, whatsapp_phone_number_id`) e `whatsapp_account_events` (`agent_id, event, occurred_at`), com `agentesDesconectados`. `temNumero` vem de `whatsapp_phone_number_id !== null`.
- **`queries.ts`:** cada função chama `requireClinicContext()` e repassa `ctx.supabase` e `ctx.clinicId`.

**Ações** (`mutations.ts`): `requireClinicContext()`, `ctx.supabase.rpc(RPC_DA_ACAO[acao], { p_conversation_id })` e `lerResultadoDaAcao(data)`. O erro do PostgREST é relançado como `Error("Falha na ação da conversa")` com `cause`, e nunca chega à tela.

**Casos do teste de RLS** (`tests/rls/conversation-panel.test.ts`), contra o banco real:
- **Cenário:** clínicas A e B, cada uma com agente, paciente e conversa criados por `register_whatsapp_message` pelo `service_role`. A tem owner, staff e profissional; B tem owner. Um login por usuário no arquivo. Datas no futuro.
- **Casos:**
  1. O owner de A assume a conversa da IA: `ok`. Fica `handled_by = human`, com `human_took_over_at` no último minuto, e um evento `assumed` com o id e o e-mail dele.
  2. Assumir de novo: `sem-mudanca`, sem evento novo.
  3. O staff de A devolve: `ok`, `handled_by = ai` e evento `returned_to_ai`.
  4. O profissional de A, nas três RPCs: `nao-encontrada`, e a conversa não muda.
  5. O owner de B, nas três RPCs sobre a conversa de A: `nao-encontrada`, e nada muda.
  6. Id inexistente: `nao-encontrada`.
  7. Conversa urgente (marcada pelo `service_role`):
     - assumir e devolver dão `sem-mudanca`;
     - resolver dá `ok`, com `is_urgent = false`, `handled_by = human`, `human_took_over_at` preenchido e evento `urgency_resolved`;
     - resolver de novo dá `sem-mudanca`.
  8. Anônimo, nas três RPCs e em `conversation_previews`: erro, nunca dado.
  9. **`conversation_events`:**
     - o owner de B não lê os eventos de A, e o de A lê os seus;
     - `insert`, `update` e `delete` diretos do owner de A são recusados;
     - o anônimo não lê nada.
  10. **`conversation_previews`:**
      - o owner de A recebe a última mensagem da sua conversa, e a resposta `failed` da IA não conta;
      - o owner de B, pedindo os ids de A, recebe zero linhas.

**Casos do teste de leitura** (`tests/conversations/leitura.test.ts`), contra o banco real, com o client logado de cada clínica:
- **Cenário:** mensagens gravadas por `register_whatsapp_message` com o conteúdo de `cifrarConteudo(clinicaA, …)`. Uma resposta da IA `failed` e outra `pending`, inseridas pelo `service_role` com as colunas de instrumentação. `qualified_at` e `ai_failed_at` gravados pelo `service_role`.
- **Casos:**
  1. `carregarConversa` decifra o texto, mantém a ordem do tempo, marca a resposta `failed` como `nao-entregue` e a `pending` como `enviando`, e inclui os eventos de qualificação e de falha.
  2. Um evento do painel, gravado pela RPC, aparece com o e-mail.
  3. Um blob trocado (cifrado com o `clinic_id` de B, gravado pelo `service_role` na mensagem de A) vira `TEXTO_ILEGIVEL`, sem lançar. O `console.error` (espionado) não recebe o blob nem o texto.
  4. Com `limite: 2` e 3 mensagens, vêm as 2 mais recentes e `historicoCortado: true`.
  5. `carregarFila` com `limite: 1`: a conversa urgente mais antiga aparece junto da mais recente.
  6. A busca pelo nome e pelos 4 últimos dígitos do telefone acha a conversa fora do limite.
  7. **Isolamento:**
     - o client de B, com o `clinicId` de A, recebe fila vazia e `null` na conversa;
     - com o próprio `clinicId` e o id da conversa de A, também recebe `null`.
  8. `carregarAvisosDeDesconexao`: o agente com `ACCOUNT_OFFBOARDED` (inserido pelo `service_role`) aparece; depois de um `ACCOUNT_RECONNECTED` posterior, some.

- [ ] **Passo 1:** testes. **Passo 2:** `supabase db push --dry-run` (só a migration nova), conferir, aplicar com `echo y |`.
- [ ] **Passo 3:** implementar `leitura.ts`, `queries.ts` e `mutations.ts`. **Passo 4:** rodar (PASSA) `tests/rls/conversation-panel.test.ts`, depois `tests/conversations/leitura.test.ts`, um de cada vez, e `tests/rls/conversations.test.ts` (não pode ter regredido).
- [ ] **Passo 5:** commit `feat(conversations): eventos, ações e leitura do painel de Conversas`, com a migration.

---

### Tarefa 3: Realtime

Carregar `supabase-postgres-best-practices` antes.

**Arquivos:**
- Criar: `supabase/migrations/20261011130000_conversations_realtime.sql`, `lib/supabase/browser.ts`, `lib/conversations/ao-vivo.ts`, `ao-vivo.test.ts` e `tests/rls/conversas-realtime.test.ts`.
- Alterar: `tests/architecture/boundaries.test.ts`.

**Interfaces:**
- Produz:
  - `createBrowserSupabase()`;
  - `assinarConversas(clinicId: string, ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void }): () => void`;
  - `estadoDoAoVivo(status: string): "ao-vivo" | "reconectando"`;
  - `agruparChamadas(fn: () => void, ms: number): (() => void) & { cancelar(): void }`;
  - `ESPERA_DO_REFRESH_MS = 400`.

**Migration:** `alter publication supabase_realtime add table public.conversations;`. O comentário explica a decisão 12: o payload só tem estado, e a RLS de select isola por clínica.

**`lib/supabase/browser.ts`:** `createBrowserClient` de `@supabase/ssr`, com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. O comentário diz que é só para o Realtime: dado se lê no servidor.

**Lógica pura** (`lib/conversations/ao-vivo.ts`, parte testada):

```ts
export type EstadoDoAoVivo = "conectando" | "ao-vivo" | "reconectando"

/** Espera para juntar mudanças seguidas (três mensagens, a resposta da IA) num refresh só. */
export const ESPERA_DO_REFRESH_MS = 400

/** O status do canal do Realtime; o cliente tenta reconectar sozinho. */
export function estadoDoAoVivo(status: string): Exclude<EstadoDoAoVivo, "conectando"> {
  return status === "SUBSCRIBED" ? "ao-vivo" : "reconectando"
}

export function agruparChamadas(fn: () => void, ms: number): (() => void) & { cancelar(): void } {
  let pendente: ReturnType<typeof setTimeout> | null = null
  const chamar = () => {
    if (pendente) clearTimeout(pendente)
    pendente = setTimeout(() => {
      pendente = null
      fn()
    }, ms)
  }
  return Object.assign(chamar, {
    cancelar() {
      if (pendente) clearTimeout(pendente)
      pendente = null
    },
  })
}
```

**`assinarConversas`:**
- canal `conversas:${clinicId}`, com `postgres_changes`, `event: "*"`, `schema: "public"`, `table: "conversations"` e o filtro `clinic_id=eq.${clinicId}`, que só reduz tráfego (decisão 12);
- `aoMudar` passa por `agruparChamadas(…, ESPERA_DO_REFRESH_MS)`, e o status do `subscribe` passa por `estadoDoAoVivo`;
- devolve a função que cancela o agrupamento e chama `removeChannel`.

**Teste** (`lib/conversations/ao-vivo.test.ts`):

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { agruparChamadas, estadoDoAoVivo } from "./ao-vivo"

describe("estadoDoAoVivo", () => {
  it("SUBSCRIBED é ao vivo", () => {
    expect(estadoDoAoVivo("SUBSCRIBED")).toBe("ao-vivo")
  })

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("%s é reconectando", (s) => {
    expect(estadoDoAoVivo(s)).toBe("reconectando")
  })
})

describe("agruparChamadas", () => {
  afterEach(() => vi.useRealTimers())

  it("mudanças seguidas viram uma chamada só, depois da última", () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const agrupada = agruparChamadas(fn, 400)
    agrupada()
    agrupada()
    vi.advanceTimersByTime(399)
    agrupada()
    vi.advanceTimersByTime(399)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("cancelar descarta a chamada pendente", () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const agrupada = agruparChamadas(fn, 400)
    agrupada()
    agrupada.cancelar()
    vi.advanceTimersByTime(400)
    expect(fn).not.toHaveBeenCalled()
  })
})
```

**Trava de fronteira** (`boundaries.test.ts`):
- `FABRICAS_AUTORIZADAS` ganha `lib/supabase/browser.ts`;
- caso novo: "o client do navegador só é importado pela assinatura do Realtime". Todo arquivo de `app`, `lib` e `components` que importa `@/lib/supabase/browser` precisa ser `lib/conversations/ao-vivo.ts`.

**Casos do teste de isolamento pelo Realtime** (`tests/rls/conversas-realtime.test.ts`), contra o banco real:
- **Cenário:** clínicas A e B com uma conversa cada, criadas pelo `service_role`. O owner de A e o owner de B têm um login cada. O WebSocket global do Node 22 é suficiente.
- **Casos:**
  1. O owner de A assina `conversations` **sem filtro** e espera `SUBSCRIBED`. O `service_role` atualiza a conversa de B, depois a de A. O evento de A chega em até 15 s, e nenhum evento recebido tem o id da conversa de B.
  2. O payload recebido não tem nenhuma coluna fora das de `conversations`, e nenhuma com nome de conteúdo (`content`, `text`, `body`).
  3. Um client anônimo assina igual. Depois de atualizar a conversa de A, e de um evento de controle chegar ao owner de A, o anônimo não recebeu nada.
  4. O owner de B, assinando sem filtro, recebe o evento da própria conversa e nenhum de A.
- No `afterAll`, `removeAllChannels()` nos clients, antes de apagar clínicas e usuários.

- [ ] **Passo 1:** testes. **Passo 2:** `--dry-run`, conferir e aplicar a migration.
- [ ] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) `lib/conversations/ao-vivo.test.ts`, `tests/architecture/boundaries.test.ts` e, sozinho, `tests/rls/conversas-realtime.test.ts`.
- [ ] **Passo 5:** commit `feat(conversations): Conversas em tempo real, isoladas por clínica`, com a migration.

---

### Tarefa 4: Tela real de Conversas da clínica

Carregar `frontend-design` e `ui-ux` antes.

**Arquivos:**
- Criar:
  - `components/conversations/ao-vivo.tsx`;
  - `components/conversations/aviso-de-desconexao.tsx`;
  - `app/(dashboard)/dashboard/conversations/acoes.ts`.
- Alterar:
  - `components/conversations/conversa.tsx`, `caixa-de-conversas.tsx` e `conversas.test.tsx`;
  - `app/(dashboard)/dashboard/conversations/page.tsx`;
  - `lib/navigation/dashboard-nav.ts` (e os testes de navegação que listam o status);
  - `tests/architecture/rotas.test.ts`, `tests/architecture/prototipos.test.ts` e `tests/demo/rotas.test.ts`.

**Interfaces:**
- Consome: `listarConversas`, `abrirConversa`, `avisosDeDesconexao`, `agirNaConversa`, `mensagemDaAcao`, `assinarConversas` e `AvisoDeDesconexao`.
- Produz:
  - `export type ModoDaConversa = { tipo: "prototipo" } | { tipo: "clinica"; agir: (acao: AcaoDoPainel, conversaId: string) => Promise<{ erro: string | null }> } | { tipo: "suporte" }`, em `conversa.tsx`;
  - `Conversa` e `CaixaDeConversas` com `modo?: ModoDaConversa` (o padrão é `prototipo`). `CaixaDeConversas` também recebe `aoVivo?: ReactNode` (vai em `actions` do `PageHeader`) e `aviso?: ReactNode` (acima da caixa);
  - `AoVivo({ clinicId })` e `AvisoDeDesconexao({ avisos, podeReconectar, agentesHref })`.

**`Conversa` por modo:**
- **`prototipo`:** como hoje, com estado local e o compositor de Responder e Nota.
- **`clinica` e `suporte`:** o estado vem só das props, sem `useState` espelhando, para que o `router.refresh()` do Realtime atualize a tela.
- **Ações no modo `clinica`:**
  - os botões Assumir, Devolver para a IA e Marcar como resolvida chamam `modo.agir` dentro de `useTransition`, ficam desabilitados enquanto rodam e, com `ok`, chamam `router.refresh()`;
  - o erro aparece em `role="alert"` perto do botão.
- **Rodapé no modo `clinica`:**
  - janela fechada: "A janela de 24h {texto}. Texto livre não chega mais ao paciente. O envio de template chega com as sequências.";
  - IA atendendo: o texto de hoje e "Assumir conversa";
  - equipe atendendo: "Responda pelo WhatsApp Business no celular da clínica: a mensagem aparece aqui.";
  - nunca há textarea.
- **Faixa da equipe:** no modo `clinica`, ela acrescenta "Devolvida, a IA responde a partir da próxima mensagem do paciente." (decisão 7).
- **Modo `suporte`:** faixas sem botão, e o rodapé é uma linha: "Somente leitura: acesso de suporte registrado na auditoria."
- **Item de mensagem:**
  - `midia` mostra o rótulo em `text-ink-3`, com o ícone `Mic` no áudio;
  - `entrega: "enviando"` acrescenta "Enviando…" à hora;
  - `entrega: "nao-entregue"` deixa a bolha com borda de perigo e "Não chegou ao paciente".
- **`historicoCortado`:** uma linha no topo da linha do tempo, "Mensagens anteriores não aparecem aqui."
- **Estado da conversa:** `ultimaMensagem` ignora o item com `entrega: "nao-entregue"` (decisão 10).

**Página** (`page.tsx`):
- **Acesso:** `requireClinicContext()`, depois `podeAcessar`. A `PermissaoNegada` leva `demo` só se for demonstração.
- **Demonstração:** o ramo `if (isDemo)` fica como hoje.
- **Fora dela:**
  - `agora = new Date().toISOString()`;
  - `Promise.all([listarConversas({ busca }), avisosDeDesconexao()])`;
  - o filtro, a contagem e a ordem continuam em memória, com `filtrarConversas` e `contarPorEstado`;
  - a conversa aberta é `abrirConversa(pedida ?? primeira da lista filtrada)`. Um id inválido ou de outra clínica dá `null`, e a tela mostra "Escolha uma conversa na fila.";
  - renderiza `CaixaDeConversas` com `modo={{ tipo: "clinica", agir }}`, `aoVivo={<AoVivo clinicId={clinicId} />}` e `aviso`, só quando há aviso, com `podeReconectar = role === "owner"`;
  - o comentário do topo explica os dois ramos.

**Server action** (`acoes.ts`, `"use server"`):
- `agir(acao: unknown, conversaId: unknown): Promise<{ erro: string | null }>`;
- valida com `ehAcaoDoPainel` e `z.string().uuid()`. Inválido devolve `mensagemDaAcao("nao-encontrada")`;
- chama `agirNaConversa`, e o resultado vira `{ erro: mensagemDaAcao(r) }`;
- exceção: `console.error("Falha na ação da conversa", erroParaLog(erro))` e `{ erro: "Não foi possível concluir. Tente de novo." }`.

**`AvisoDeDesconexao`:**
- faixa de perigo, um parágrafo por agente: "A Meta desconectou o WhatsApp de {agente} {tempoRelativo(desde, agora)}. Até reconectar, a IA não responde e as mensagens novas não chegam aqui.";
- o owner vê o link "Reconectar em Agentes"; o staff vê "Avise o responsável pela conta da clínica.";
- recebe `agora` por prop.

**`AoVivo`:** cliente. Usa `useEffect` com `assinarConversas(clinicId, { aoMudar: () => router.refresh(), aoEstado })` e mostra uma pílula `role="status"`: "Ao vivo" com ponto `bg-brand`, ou "Reconectando…" em `warning`. O estado inicial é "Conectando…".

**Menu:** Conversas passa a `status: "pronto"`.

**Travas, com a regra nova e sem afrouxar:**
- **`rotas.test.ts`:** caso novo, "item pronto não responde 404 fora da demonstração". Nenhuma página de item `pronto` contém `if (!isDemo) notFound()`.
- **`prototipos.test.ts`:** caso novo, "página de item pronto que importa _fixtures só usa a fixture no ramo da demonstração". Ela contém `if (isDemo)`. A contagem ≥ 13 continua.
- **`tests/demo/rotas.test.ts`:**
  - Conversas sai de `NOVAS` e entra em `EXISTENTES`, com a mesma `confere`;
  - `vi.mock("@/lib/conversations/queries")` devolve uma fila de uma conversa, a conversa aberta e um aviso;
  - casos novos em "numa clínica comum":
    - "Conversas mostra a tela real (owner, staff)": `tela.type === CaixaDeConversas`, `props.modo.tipo === "clinica"` e `props.conversas` igual à fila do mock, nunca a fixture;
    - "o profissional vê a permissão negada sem o selo da demonstração".
- **`conversas.test.tsx`, casos novos:**
  - modo `clinica`: sem `textarea`; "Responda pelo WhatsApp Business" com a equipe atendendo; botão "Assumir conversa" com a IA;
  - modo `suporte`: nenhum `button` e o texto "Somente leitura";
  - mensagem `nao-entregue`: "Não chegou ao paciente";
  - `midia: "audio"`: "Áudio";
  - `historicoCortado`: a linha do aviso;
  - modo `prototipo`: continua com "Nota interna";
  - `AvisoDeDesconexao`: o owner vê o link, e o staff vê "Avise o responsável".

- [ ] **Passo 1:** testes. **Passo 2:** rodar (FALHA).
- [ ] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) `components/conversations`, `tests/architecture`, `tests/demo/rotas.test.ts`, `lib/navigation` e `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(conversations): tela real de Conversas na clínica`.

---

### Tarefa 5: Acesso de suporte no painel interno

Carregar `frontend-design` e `ui-ux` antes.

**Arquivos:**
- Criar:
  - `lib/admin/estado-de-suporte.ts` e o teste;
  - `lib/admin/suporte.ts`;
  - `tests/admin/suporte.test.ts`;
  - `app/(admin)/admin/conversations/page.tsx`, `loading.tsx` e `acoes.ts`;
  - `app/(admin)/admin/conversations/[clinica]/page.tsx` e `loading.tsx`;
  - `app/(admin)/admin/conversations/[clinica]/[conversa]/page.tsx` e `loading.tsx`.
- Alterar:
  - `lib/admin/acesso-de-suporte.ts` e o teste;
  - `lib/admin/audit.ts`;
  - `components/admin/tela-de-suporte.tsx`, `estado.ts`, `tipos.ts` e `suporte.test.tsx`;
  - `lib/navigation/admin-nav.ts`.

**Interfaces:**
- Consome: `carregarConversa` (tarefa 2), `Conversa` com `modo: { tipo: "suporte" }` (tarefa 4), `validarJustificativa`, `acessoVigente` e `registroDeSuporte`.
- Produz:
  - `estadoDeSuporte(c: LinhaDeEstado): EstadoDeSuporte`;
  - `resumirParaSuporte(clinicas, linhas): ResumoDeSuporte[]`;
  - `acessosDaTrilha(linhas): AcessoDeSuporte[]`;
  - `registrarAcao(…): Promise<boolean>`;
  - em `lib/admin/suporte.ts`:
    - `listarClinicasParaSuporte(ctx)`;
    - `acessoDeSuporteVigente(ctx, clinicaId, agora)`;
    - `liberarAcessoDeSuporte(ctx, clinicaId, bruto: { motivo: string; chamado: string }): Promise<{ ok: true } | { ok: false; erro: string }>`;
    - `listarConversasParaSuporte(ctx, clinicaId)`;
    - `abrirConversaParaSuporte(ctx, clinicaId, conversaId, justificativa): Promise<ConversaAberta | null>`.

**Lógica pura** (`lib/admin/estado-de-suporte.ts`):

```ts
/**
 * O estado de uma conversa para quem investiga um chamado. Diferente da
 * fila da clínica, a falha da IA tem estado próprio: é o caso que o
 * suporte mais procura.
 */
export type EstadoDeSuporte = "urgente" | "falha" | "aguardando" | "humano" | "ia"

export type LinhaDeEstado = {
  clinic_id: string
  handled_by: "ai" | "human"
  is_urgent: boolean
  human_took_over_at: string | null
  ai_failed_at: string | null
  last_inbound_at: string | null
  last_message_at: string
}

/**
 * As duas colunas mudam na mesma transação de cada mensagem: se a última
 * do paciente é a última de todas, foi ele quem falou por último.
 */
export function pacienteFalouPorUltimo(c: Pick<LinhaDeEstado, "last_inbound_at" | "last_message_at">): boolean {
  return c.last_inbound_at !== null && Date.parse(c.last_inbound_at) >= Date.parse(c.last_message_at)
}

export function estadoDeSuporte(c: LinhaDeEstado): EstadoDeSuporte {
  if (c.is_urgent) return "urgente"
  if (c.handled_by === "ai") return "ia"
  const falhaPorUltimo =
    c.ai_failed_at !== null &&
    (c.human_took_over_at === null || Date.parse(c.ai_failed_at) >= Date.parse(c.human_took_over_at))
  if (falhaPorUltimo) return "falha"
  return pacienteFalouPorUltimo(c) ? "aguardando" : "humano"
}

export function resumirParaSuporte<C extends { id: string }>(
  clinicas: readonly C[],
  linhas: readonly LinhaDeEstado[],
): (C & { abertas: number; aguardando: number; comFalha: number; urgentes: number })[] {
  return clinicas.map((c) => {
    const estados = linhas.filter((l) => l.clinic_id === c.id).map(estadoDeSuporte)
    const contar = (e: EstadoDeSuporte) => estados.filter((x) => x === e).length
    return { ...c, abertas: estados.length, aguardando: contar("aguardando"), comFalha: contar("falha"), urgentes: contar("urgente") }
  })
}
```

**Teste** (`lib/admin/estado-de-suporte.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import { estadoDeSuporte, pacienteFalouPorUltimo, resumirParaSuporte, type LinhaDeEstado } from "./estado-de-suporte"

const h = (hhmm: string) => `2026-10-11T${hhmm}:00.000Z`
const base: LinhaDeEstado = {
  clinic_id: "A",
  handled_by: "human",
  is_urgent: false,
  human_took_over_at: h("09:00"),
  ai_failed_at: null,
  last_inbound_at: h("10:00"),
  last_message_at: h("10:05"),
}

describe("estadoDeSuporte", () => {
  it("urgente vence tudo, até a falha", () => {
    expect(estadoDeSuporte({ ...base, is_urgent: true, ai_failed_at: h("10:00") })).toBe("urgente")
  })

  it("com a IA, é ia", () => {
    expect(estadoDeSuporte({ ...base, handled_by: "ai" })).toBe("ia")
  })

  it("falha depois da ação humana é falha", () => {
    expect(estadoDeSuporte({ ...base, ai_failed_at: h("09:30") })).toBe("falha")
    expect(estadoDeSuporte({ ...base, human_took_over_at: null, ai_failed_at: h("09:30") })).toBe("falha")
  })

  it("ação humana depois da falha não é mais falha", () => {
    expect(estadoDeSuporte({ ...base, ai_failed_at: h("08:00") })).toBe("humano")
  })

  it("paciente falou por último: aguardando", () => {
    expect(estadoDeSuporte({ ...base, last_inbound_at: h("10:05") })).toBe("aguardando")
  })
})

describe("pacienteFalouPorUltimo", () => {
  it("sem mensagem do paciente, não", () => {
    expect(pacienteFalouPorUltimo({ last_inbound_at: null, last_message_at: h("10:00") })).toBe(false)
  })
})

describe("resumirParaSuporte", () => {
  it("conta por clínica, inclusive a que não tem conversa", () => {
    const linhas: LinhaDeEstado[] = [
      { ...base, last_inbound_at: h("10:05") },
      { ...base, ai_failed_at: h("09:30") },
      { ...base, is_urgent: true },
      { ...base, handled_by: "ai" },
      { ...base, clinic_id: "B" },
    ]
    expect(resumirParaSuporte([{ id: "A" }, { id: "B" }, { id: "C" }], linhas)).toEqual([
      { id: "A", abertas: 4, aguardando: 1, comFalha: 1, urgentes: 1 },
      { id: "B", abertas: 1, aguardando: 0, comFalha: 0, urgentes: 0 },
      { id: "C", abertas: 0, aguardando: 0, comFalha: 0, urgentes: 0 },
    ])
  })
})
```

**Lógica pura** (`lib/admin/acesso-de-suporte.ts`, acréscimo):

```ts
/**
 * Os acessos concedidos, a partir dos registros `conversation.list` da
 * trilha. Registro sem clínica ou com justificativa que não valida
 * (gravado à mão, ou por versão antiga) não libera nada.
 */
export function acessosDaTrilha(
  linhas: readonly { clinic_id: string | null; created_at: string; metadata: unknown }[],
): AcessoDeSuporte[] {
  return linhas.flatMap((l) => {
    if (!l.clinic_id || typeof l.metadata !== "object" || l.metadata === null) return []
    const { motivo, chamado } = l.metadata as Record<string, unknown>
    if (typeof motivo !== "string" || typeof chamado !== "string") return []
    const v = validarJustificativa({ motivo, chamado })
    return v.ok ? [{ clinicaId: l.clinic_id, concedidoEm: l.created_at, justificativa: v.justificativa }] : []
  })
}
```

**Teste** (`lib/admin/acesso-de-suporte.test.ts`, acréscimo):

```ts
describe("acessosDaTrilha", () => {
  it("lê motivo e chamado do metadata", () => {
    expect(
      acessosDaTrilha([
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "resposta-errada", chamado: "4821" } },
      ]),
    ).toEqual([
      {
        clinicaId: "A",
        concedidoEm: "2026-10-11T10:00:00Z",
        justificativa: { motivo: "resposta-errada", chamado: "4821" },
      },
    ])
  })

  it("descarta registro sem clínica, sem metadata ou com justificativa inválida", () => {
    expect(
      acessosDaTrilha([
        { clinic_id: null, created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "outro", chamado: "1" } },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: null },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "curiosidade", chamado: "1" } },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "outro", chamado: "Maria" } },
      ]),
    ).toEqual([])
  })
})
```

**`lib/admin/audit.ts`:** `AdminAction` ganha `| AcaoDeSuporte`, e `registrarAcao` devolve `true` quando grava e `false` com erro (decisão 14).

**`lib/admin/suporte.ts`** (com o `ctx` de `requireAdminContext()`):
- **`listarClinicasParaSuporte`:**
  - `clinics` (`id, legal_name, plan`) e `conversations` com `status = active` (só as colunas de `LinhaDeEstado`), em paralelo;
  - `resumirParaSuporte`, com `nome = legal_name`;
  - nenhuma coluna de paciente.
- **`acessoDeSuporteVigente`:**
  - `admin_audit_log` filtrado por `actor_user_id = ctx.userId`, `action = conversation.list`, `clinic_id` e `created_at >= agora − 30 min`;
  - depois, `acessosDaTrilha` e `acessoVigente`.
- **`liberarAcessoDeSuporte`:**
  - `validarJustificativa`, depois confere se a clínica existe;
  - `registrarAcao(ctx, registroDeSuporte({ clinicaId, justificativa }))`. Com `false`, devolve `{ ok: false, erro: "Não foi possível registrar o acesso. Nada foi liberado." }`.
- **`listarConversasParaSuporte`:**
  - conversas da clínica com `.eq("clinic_id")`: as 200 mais recentes e todas as urgentes, com `agents(name)` e `patients(name)`;
  - vira `ConversaDeSuporte` (`paciente` = nome, ou "Sem nome no WhatsApp"; `estado` = `estadoDeSuporte`; `ultimaAtividade` = `last_message_at`).
- **`abrirConversaParaSuporte`:**
  - `carregarConversa(ctx.supabase, clinicaId, conversaId)`. Com `null`, devolve `null` e não registra nada;
  - grava `registroDeSuporte({ clinicaId, justificativa, conversaId })`. Se a gravação devolver `false`, lança `Error("Auditoria indisponível")`, e o conteúdo não é devolvido.

**Componentes:**
- `EstadoDaConversaDeSuporte` passa a ser `EstadoDeSuporte`, com `urgente`. Os mapas de `estado.ts` ganham `urgente` (`ORDEM` 0, `ROTULO` "Urgente", `TOM` `danger`).
- `ResumoDeSuporte` ganha `urgentes`, e `Contagens` mostra "N urgentes" em perigo quando há. As fixtures de `painel-interno.ts` ganham `urgentes: 0`.
- `TelaDeAcessoDeSuporte` ganha `real?: { liberar: (fd: FormData) => Promise<void>; hrefDaConversa: (id: string) => string; erro: string | null }`. Com `real`:
  - o form usa `action={real.liberar}`, e `real.erro` aparece em `role="alert"`;
  - "Abrir conversa" vira `Link` com `prefetch={false}`;
  - "Encerrar acesso" some.

  Sem `real`, o protótipo segue como hoje.

**Rotas:**
- `/admin/conversations`: `ClinicasParaSuporte`, com `hrefDaClinica = (id) => /admin/conversations/${id}`.
- `/admin/conversations/[clinica]`:
  - a clínica precisa existir, senão `notFound()`;
  - lê `acesso`, as conversas (só com acesso) e `?erro`;
  - `liberar = liberarAcesso.bind(null, clinicaId)`.
- `acoes.ts` (`"use server"`): `liberarAcesso(clinicaId, formData)` chama `requireAdminContext()` e `liberarAcessoDeSuporte`. Com sucesso, faz `redirect` para a clínica; com erro, para `?erro=<código>`. A página traduz o código numa mensagem fixa, nunca o texto que veio do usuário.
- `/admin/conversations/[clinica]/[conversa]`:
  - sem acesso vigente, `redirect` para a clínica;
  - `abrirConversaParaSuporte`. Com `null`, `notFound()`;
  - um cabeçalho com o caminho de volta e a faixa do acesso (motivo, chamado e "até HH:MM"), e `Conversa` com `modo={{ tipo: "suporte" }}` numa caixa com a mesma altura da tela da clínica;
  - o `fichaHref` aponta para a própria página, porque o suporte não abre ficha.
- `ADMIN_NAV`: Conversas passa a `status: "pronto"`. A rota cumpre `estados.test.ts` com `loading.tsx` em cada nível.

**Casos do teste de banco** (`tests/admin/suporte.test.ts`):
- **Cenário:** clínicas A e B com uma conversa cada (conteúdo cifrado) e um usuário da equipe criado no arquivo, com `ctx = { userId, name: null, supabase: service client }`.
- **Casos:**
  1. Justificativa inválida (motivo fora da lista, chamado com letra): `ok: false` e nenhum registro novo na trilha.
  2. Justificativa válida para A: um `conversation.list` com `{ motivo, chamado }`. `acessoDeSuporteVigente` vale para A e não para B.
  3. Registro com `created_at` de 31 min atrás (inserido pelo `service_role`): não libera.
  4. `abrirConversaParaSuporte` de A com a conversa de A: devolve o texto decifrado e grava um `conversation.view` com `target_id` igual ao id da conversa.
  5. Com a conversa de B pela clínica A: `null`, e nenhum `conversation.view` gravado.
  6. `listarClinicasParaSuporte` traz A e B com as contagens, e o JSON não contém nome nem telefone de paciente.
  7. `listarConversasParaSuporte(A)` só traz conversas de A.
- **Limpeza:** no fim, apagar os registros da trilha do usuário de teste, as clínicas e o usuário, nessa ordem. A trilha tem `on delete restrict` no autor.

**`suporte.test.tsx`, casos novos:**
- com `real`: o form tem `action`, "Abrir conversa" é link sem prefetch (`data-prefetch` ausente, ou a prop conferida no elemento) e não há "Encerrar acesso";
- `erro` aparece em `role="alert"`;
- o estado `urgente` mostra "Urgente".

- [ ] **Passo 1:** testes. **Passo 2:** rodar (FALHA).
- [ ] **Passo 3:** implementar. **Passo 4:** rodar (PASSA) `lib/admin`, `components/admin`, `tests/architecture`, `lib/navigation` e, sozinho, `tests/admin/suporte.test.ts`.
- [ ] **Passo 5:** commit `feat(admin): acesso de suporte às conversas, com justificativa e trilha`.

---

### Tarefa 6: Revisão visual no navegador

Carregar `frontend-design` e `ui-ux` antes.

- **Dado de teste:** um script no scratchpad, pelo `service_role`, cria a "Clínica Teste Conversas (temporária)" com um owner temporário (`@exemplo.test`), um agente com número fictício e quatro conversas, todas com conteúdo cifrado pela chave do `.env`:
  - uma urgente;
  - uma com falha da IA e a resposta `failed`;
  - uma com a equipe atendendo, já com um evento `assumed`;
  - uma com a IA, com áudio e um evento `ACCOUNT_OFFBOARDED` no agente.
- **Captura:**
  - `docs/design/shot-referencia.mjs` copiado para o scratchpad, com `npm i playwright-core@1` lá;
  - telas: `/dashboard/conversations` (fila e conversa aberta) pelo owner temporário, e a mesma rota pelo `clinica@` (demonstração);
  - `/admin/conversations`, a clínica sem acesso, a clínica com acesso e uma conversa aberta, pelo `admin@`;
  - nos dois temas, em 1440 e 390 px, sem rolagem horizontal no celular.
- **Ao vivo:** com a tela aberta, uma mensagem nova inserida pelo `service_role` aparece sem recarregar. Assumir e devolver pela tela funcionam.
- **Servidor:** `npm run dev`. Com o 500 "Jest worker", usar `next start -p 3100` depois do build, conferindo antes se não há um `next start` antigo na 3100.
- **Limpeza:** apagar a trilha do suporte gerada na clínica temporária, a clínica e o usuário temporário. Conferir no banco que não sobrou nada.
- [ ] Corrigir o que a captura mostrar, rodar os testes afetados e fazer o commit `fix(conversations): ajustes da revisão visual`, se houver.

---

## Verificação final (antes da tarefa 7)

- [ ] `npx vitest run` inteiro em segundo plano, com timeout longo, gravando num arquivo do scratchpad com o commit no topo e `echo exit=$?` no fim. Ler o resultado.
- [ ] `npx tsc --noEmit` e `npm run build`, com o código de saída.
- [ ] Revisão do `qa-reviewer` e do `security-reviewer` sobre o diff da parte. Tratar os achados, rodar de novo e pedir a conferência das correções, inclusive das correções da própria conferência.

### Tarefa 7: Documentação e fechamento

- [ ] **Este plano:** status da execução, commits, ajustes e "O que a próxima sessão precisa saber" (a próxima sessão é a correção da posse do WhatsApp).
- [ ] **Spec `conversation-engine-v1.md`:** a parte 4 em "Implementação" e o critério de aceite atualizado onde a tela entra (eco, retomada e urgência agora com ação pelo painel).
- [ ] **`docs/roadmap.md` e `docs/status.md`:** a parte 4 concluída; a próxima sessão; a pendência de go-live "parte 4" riscada; o contador de testes e de migrations.
- [ ] **Memória:** arquitetura (parte 4, Realtime só com estado, RPC de linha única) e ambiente Supabase (25 migrations, Realtime ligado em `conversations`).
- [ ] `git checkout -- CLAUDE.md`, commit `docs: fecha a parte 4 da 3b e aponta a correção da posse como próxima sessão`, `git status` limpo e `git push origin staging`.
