# CRM próprio, parte 2: backend e tela real — plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** o funil comercial de `/dashboard/crm` passa a ler e gravar no banco, para toda clínica Pro e HealthTech. As oportunidades nascem e andam sozinhas com as mensagens e com a qualificação da IA. A equipe move, edita os campos e escreve a nota cifrada. O Starter vê o convite, e a conta de demonstração junta as reais às de exemplo.

**Arquitetura:** a automação mora no banco, em *triggers* na mesma transação de quem gera o evento (mensagem do paciente, `qualified_at`). A mudança manual é a RPC `move_opportunity`, de linha única e sobre a etapa que a tela viu. Os outros campos passam pela RPC `update_opportunity_details`, que recebe a nota já cifrada pela lib. O `authenticated` só tem `select`, e a RLS libera a leitura para owner e staff. A leitura monta o mesmo tipo `Oportunidade` da parte 1, e as regras puras de `lib/crm/` (métricas, filtros, movimento, cartão) não mudam de lugar. O tempo real usa o padrão de Conversas: aviso sem dado no canal privado `crm:<clinic_id>`, e a tela faz `router.refresh()`.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres 15+, RLS, Realtime Broadcast), Vitest 5 (`node`, `renderToStaticMarkup`), zod, AES-256-GCM de `lib/conversations/conteudo.ts`.

**Spec:** `docs/specs/crm-v1.md` (seções 2, 3, 4 e 6, edge cases, Segurança e LGPD, e o critério de aceite da Parte 2). Leia a spec e o plano da parte 1 (`docs/superpowers/plans/2026-11-03-crm-parte-1-tela-de-demonstracao.md`) antes deste.

## Decisões do Jhones nesta sessão (2026-11-03)

1. **Selo "IA" só na qualificação automática.** O cartão mostra o selo quando o último evento foi Novo → Qualificado pelo sistema. Abrir pela primeira mensagem não é decisão da IA.
2. **"Atividade hoje" por dia de calendário**, no fuso de São Paulo (`chaveDoDia`/`diasEntre` de `lib/formatters/data`). Ontem às 23h, às 8h de hoje, é "parado há 1 dia".
3. **Resumo no celular com KPIs compactos:** abaixo de `sm`, os três números viram uma faixa única de três colunas (~90 px), e a ordem da tela não muda.

## Restrições globais

- Responder e comentar em pt-BR.
- Etapas: `novo`, `qualificado`, `agendado`, `compareceu` (abertas), `ganho`, `perdido` (encerram, `closed_at`). Não há "reabrir".
- Motivos de perda, lista fixa: `preco`, `sem_horario`, `outra_clinica`, `sem_resposta`, `nao_era_paciente`, `outro`.
- **Uma oportunidade aberta por paciente**, garantida por índice único parcial. **Só a mensagem do paciente abre.** O automático só avança, e só de Novo para Qualificado.
- A RPC devolve `ok`, `sem-mudanca`, `nao-encontrada` ou `invalido`. Com etapa esperada diferente da atual, `sem-mudanca`.
- Valor em centavos, inteiro, de 1 a `100_000_000` (`VALOR_MAXIMO_CENTAVOS`).
- **Nota:** cifrada com `cifrarConteudo(clinicId, nota)` (`MESSAGE_CONTENT_ENCRYPTION_KEY`, AAD da clínica), no máximo 2000 caracteres. Nunca em log, URL ou mensagem de erro. Decifrada só no servidor, para owner e staff de plano Pro/HealthTech.
- **Log** só com `erroParaLog(erro)`. O erro do PostgREST não é `Error` e repete o valor rejeitado (memória `postgrest-erro-nao-e-error`).
- **Busca por POST.** A página nunca lê `?q=`. Na URL ficam só período, responsável, vista, resultado e motivo.
- **Plano:** o dado é gravado em todo plano. A tela, as server actions e as RPCs de escrita exigem Pro ou HealthTech (`TEM_CRM`). A trava fica na lib (server action é endpoint público) e também no banco, nas RPCs de escrita, como segunda barreira.
- **Papel:** owner e staff. O profissional não lê nada do CRM (RLS) e vê a permissão negada.
- O `clinic_id` vem sempre da sessão (`requireClinicContext` / `requireClinicContextForWrite`), nunca do navegador.
- Datas na tela só por `lib/formatters`. Nada de `new Date()` em componente: o "agora" chega como prop. Página pode ler o relógio (como Conversas).
- O verde `brand` só em Ganho. Tokens `surface`, `ink` e `hairline`, nunca `[var(--x)]`.
- Celular (390 px) sem rolagem horizontal.
- **Banco compartilhado com produção:** as migrations são aditivas. O `npx supabase db push --remote` **pede aprovação do Jhones** antes (memória `nextech-ambiente-supabase`); rode o `--dry-run` e mostre a saída. Migration e o código/teste que a usam entram **no mesmo commit**.
- Testes de banco: um login por usuário por arquivo (`comoUsuario` já faz cache), datas calculadas na execução, `hookTimeout` de 60 s já configurado. Teste de Realtime pode falhar com `CHANNEL_ERROR` na suíte inteira: rodar o arquivo sozinho antes de investigar.
- Commits na `staging`. Nunca na `main`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261103150000_crm_opportunities.sql` | Enums, `opportunities`, `opportunity_events`, índices, RLS de leitura, *triggers* de abertura e de qualificação, aviso do Broadcast e policy do canal `crm:` |
| `supabase/migrations/20261103160000_crm_actions.sql` | RPCs `move_opportunity`, `update_opportunity_details`, `search_opportunities`, `crm_team`; `anonymize_patient` apaga a nota |
| `tests/rls/crm-automacao.test.ts` | Abertura, reenvio, eco, concorrência, qualificação, encerramento, restrições, leitura por papel, membro e procedimento removidos |
| `tests/rls/crm-realtime.test.ts` | Canal privado `crm:<clinic_id>` |
| `tests/rls/crm-acoes.test.ts` | RPCs, isolamento entre clínicas, papel, plano, anonimização |
| `lib/billing/plan-limits.ts` | `TEM_CRM` |
| `lib/crm/acesso.ts` | `ROTA_DO_CRM`, `acessoAoCrm(role, plano)` |
| `lib/crm/ids.ts` | `ehIdDoBanco(id)` (uuid = real; o resto é fixture) |
| `lib/crm/equipe.ts` | `nomeDoMembro(email)` |
| `lib/crm/cartao.ts` | `qualificadaPelaIa` (troca `ultimaMudancaAutomatica`) e "hoje" por dia de calendário |
| `lib/crm/movimento.ts` | + `lerPedidoDeMovimento`, `lerResultadoDoMovimento` |
| `lib/crm/detalhes.ts` | `lerDetalhes` (formulário → `DetalhesDaOportunidade`), resultados da RPC |
| `lib/formatters/data.ts` | + `instanteDaDataHoraLocal`, `dataHoraLocal` |
| `lib/crm/leitura.ts` | `montarOportunidade`, `carregarCrmDaClinica`, `buscarIdsNoCrm` (recebem o client) |
| `lib/crm/queries.ts` | `carregarCrm(agora)`, `buscarNoCrm(termo)` (sessão + trava de papel e plano) |
| `lib/crm/mutations.ts` | `moverOportunidade`, `salvarDetalhes` (sessão de escrita + trava + cifra) |
| `lib/crm/ao-vivo.ts` | `topicoDoCrm`, `EVENTO_DO_CRM`, `assinarCrm` |
| `lib/conversations/ao-vivo.ts` | + `assinarAvisos(topico, evento, ouvintes)`, genérico |
| `lib/auth/context.ts` | + `plan` no `ClinicContext` (mesma consulta) |
| `lib/navigation/schema.ts`, `dashboard-nav.ts`, `components/shell/painel.ts`, `app-sidebar.tsx`, `app/(dashboard)/layout.tsx` | CRM "pronto" com selo "Pro" no Starter |
| `components/conversations/ao-vivo.tsx` | + prop `canal` (`"conversas"` ou `"crm"`) |
| `components/crm/estado.ts` | + `estadoInicial`, eventos `sincronizar` e `avisar` |
| `components/crm/tela-do-crm.tsx` | Grava pelo servidor, ressincroniza com as props, ao vivo |
| `components/crm/formulario-da-oportunidade.tsx` | Edição dos campos no painel |
| `components/crm/painel-da-oportunidade.tsx` | Formulário nas reais; botão inerte nas de exemplo |
| `components/crm/resumo-do-periodo.tsx` | KPIs compactos no celular |
| `components/crm/convite-do-crm.tsx` | Convite do Starter |
| `components/crm/cartao-da-oportunidade.tsx` | Usa `qualificadaPelaIa` |
| `app/(dashboard)/dashboard/crm/page.tsx`, `acoes.ts` | Tela real, demonstração com as reais e as de exemplo, ações |
| `scripts/canal-demo/limpar.ts` | A conferência da limpeza conta as oportunidades |

---

### Tarefa 1: Migration das tabelas, da automação e do aviso ao vivo

**Arquivos:**
- Criar: `supabase/migrations/20261103150000_crm_opportunities.sql`
- Teste: `tests/rls/crm-automacao.test.ts`, `tests/rls/crm-realtime.test.ts`

**Interfaces:**
- Consome: `register_whatsapp_message` (não muda), `conversations.qualified_at`, `private.sessao_ativa()`, os `unique (id, clinic_id)` de `patients`, `conversations` e `procedures`, o `unique (clinic_id, user_id)` de `clinic_members`; a fixture `tests/fixtures/clinica-de-conversas.ts` (`admin`, `comoUsuario`, `montarClinica`, `novoPaciente`, `registrar`, `emMinutos`, `limparClinica`, `criarUsuario`, `anonClient`).
- Produz: enums `public.opportunity_stage` e `public.opportunity_lost_reason`; tabelas `public.opportunities` e `public.opportunity_events`; funções `private.can_operate_crm(uuid)`, `private.crm_clinic_ids()`, `private.clinic_has_crm(uuid)`; o aviso `realtime.send('{}', 'oportunidade', 'crm:<clinic_id>', true)` a cada insert/update de oportunidade.

- [ ] **Passo 1: conferir a versão do Postgres** (a FK composta com `on delete set null (coluna)` exige 15+):

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/bbfjwsrxastqpvbudhmc/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select current_setting('"'"'server_version_num'"'"')::int as v"}'
```

Esperado: `v >= 150000`. Abaixo disso, pare e avise o Jhones (a alternativa é FK simples mais *trigger* de coerência).

- [ ] **Passo 2: escrever o teste da automação** em `tests/rls/crm-automacao.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import {
  admin,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * O CRM próprio, parte 2 (spec crm-v1, seção 3): as oportunidades nascem e
 * andam com os eventos do sistema, por triggers no banco. Contra o banco
 * real. As clínicas de teste nascem no Starter: a automação vale em todo
 * plano ("o dado é gravado em todo plano").
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let C: ClinicaDeTeste
// Só para o caso de dois agentes: o Starter permite 1 agente, o Pro permite 3.
let D: ClinicaDeTeste

type Linha = { id: string; stage: string; closed_at: string | null; conversation_id: string | null; last_activity_at: string }

async function oportunidades(paciente: string): Promise<Linha[]> {
  const { data, error } = await admin
    .from("opportunities")
    .select("id, stage, closed_at, conversation_id, last_activity_at")
    .eq("patient_id", paciente)
    .order("opened_at")
  if (error) throw error
  return data as Linha[]
}

async function eventos(oportunidade: string) {
  const { data, error } = await admin
    .from("opportunity_events")
    .select("from_stage, to_stage, actor_user_id")
    .eq("opportunity_id", oportunidade)
    .order("created_at")
  if (error) throw error
  return data
}

async function qualificar(conversa: string) {
  const { error } = await admin.from("conversations").update({ qualified_at: new Date().toISOString() }).eq("id", conversa)
  if (error) throw error
}

async function novoProcedimento(c: ClinicaDeTeste, nome: string): Promise<string> {
  const { data, error } = await admin
    .from("procedures")
    .insert({ clinic_id: c.id, name: nome, duration_minutes: 30 })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

beforeAll(async () => {
  ;[A, B, C, D] = await Promise.all([
    montarClinica("crm-auto-a", ["owner", "staff", "professional"]),
    montarClinica("crm-auto-b", ["owner"]),
    montarClinica("crm-auto-c", ["owner", "staff"]),
    montarClinica("crm-auto-d", ["owner"]),
  ])
  const { error } = await admin.from("clinics").update({ plan: "pro" }).eq("id", D.id)
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B), limparClinica(C), limparClinica(D)])
}, 60_000)

describe("abertura pela mensagem do paciente", () => {
  it("a primeira mensagem abre a oportunidade em Novo, com evento do sistema", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const ops = await oportunidades(p)
    expect(ops).toEqual([expect.objectContaining({ stage: "novo", closed_at: null, conversation_id: conversa })])
    expect(await eventos(ops[0].id)).toEqual([{ from_stage: null, to_stage: "novo", actor_user_id: null }])
  })

  it("com oportunidade aberta, a mensagem nova só atualiza a última atividade", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [antes] = await oportunidades(p)
    await registrar(A, p, { autor: "patient", texto: "Tem horário amanhã?", em: emMinutos(1) })
    const depois = await oportunidades(p)
    expect(depois).toHaveLength(1)
    expect(Date.parse(depois[0].last_activity_at)).toBeGreaterThanOrEqual(Date.parse(antes.last_activity_at))
    expect(await eventos(antes.id)).toHaveLength(1)
  })

  it("o reenvio da Meta (mesmo wamid) não duplica nada", async () => {
    const p = await novoPaciente(A)
    const args = {
      p_clinic_id: A.id,
      p_agent_id: A.agente,
      p_patient_id: p,
      p_wa_message_id: `wamid.crm.reenvio.${Date.now()}`,
      p_author: "patient",
      p_media_type: "text",
      p_content_encrypted: cifrarConteudo(A.id, "Oi"),
      p_occurred_at: emMinutos(0),
    }
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.rpc("register_whatsapp_message", args)
      expect(error).toBeNull()
    }
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })

  it("o eco da equipe não abre oportunidade", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "human", texto: "Bom dia, aqui é a clínica", em: emMinutos(0) })
    expect(await oportunidades(p)).toEqual([])
  })

  it("duas mensagens ao mesmo tempo abrem uma oportunidade só", async () => {
    const p = await novoPaciente(A)
    await Promise.all([
      registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) }),
      registrar(A, p, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) }),
    ])
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })
})

describe("duas conversas do mesmo paciente", () => {
  it("mensagens ao mesmo tempo em duas conversas (dois agentes) abrem uma oportunidade só", async () => {
    const { data: outro, error } = await admin
      .from("agents")
      .insert({ clinic_id: D.id, name: "Recepção crm-auto-d 2", specialty: "odontologia" })
      .select("id")
      .single()
    if (error) throw error
    const p = await novoPaciente(D)
    const [r1, r2] = await Promise.all([
      registrar(D, p, { autor: "patient", texto: "Oi", em: emMinutos(0) }),
      registrar({ id: D.id, agente: outro.id }, p, { autor: "patient", texto: "Oi de novo", em: emMinutos(0) }),
    ])
    expect(r1.conversa).not.toBe(r2.conversa)
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })
})

describe("qualificação pela IA", () => {
  it("qualified_at gravado move de Novo para Qualificado, com evento do sistema", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) })
    await qualificar(conversa)
    const [op] = await oportunidades(p)
    expect(op.stage).toBe("qualificado")
    expect(await eventos(op.id)).toEqual([
      { from_stage: null, to_stage: "novo", actor_user_id: null },
      { from_stage: "novo", to_stage: "qualificado", actor_user_id: null },
    ])
  })

  it("em qualquer outra etapa, a qualificação não move (o automático só avança)", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const { error } = await admin.from("opportunities").update({ stage: "agendado" }).eq("id", op.id)
    if (error) throw error
    await qualificar(conversa)
    expect((await oportunidades(p))[0].stage).toBe("agendado")
    expect(await eventos(op.id)).toHaveLength(1)
  })
})

describe("encerramento", () => {
  it("depois de Perdido, a mensagem nova abre outra oportunidade, em Novo", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [primeira] = await oportunidades(p)
    const { error } = await admin
      .from("opportunities")
      .update({ stage: "perdido", lost_reason: "preco", closed_at: new Date().toISOString() })
      .eq("id", primeira.id)
    if (error) throw error
    await registrar(A, p, { autor: "patient", texto: "Voltei", em: emMinutos(1) })
    const ops = await oportunidades(p)
    expect(ops.map((o) => o.stage)).toEqual(["perdido", "novo"])
  })
})

describe("reabertura depois de Ganho", () => {
  it("depois de Ganho, a mensagem nova abre outra oportunidade, em Novo", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [primeira] = await oportunidades(p)
    const { error } = await admin
      .from("opportunities")
      .update({ stage: "ganho", value_cents: 90000, closed_at: new Date().toISOString() })
      .eq("id", primeira.id)
    if (error) throw error
    await registrar(A, p, { autor: "patient", texto: "Quero outro procedimento", em: emMinutos(1) })
    const ops = await oportunidades(p)
    expect(ops.map((o) => o.stage)).toEqual(["ganho", "novo"])
    expect(ops[1].closed_at).toBeNull()
  })
})

describe("restrições do banco", () => {
  it("recusa uma segunda oportunidade aberta para o mesmo paciente", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const { error } = await admin.from("opportunities").insert({ clinic_id: A.id, patient_id: p })
    expect(error?.code).toBe("23505")
  })

  it("Perdido sem motivo, Ganho sem valor e aberta com closed_at são recusados", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const agora = new Date().toISOString()
    for (const mudanca of [
      { stage: "perdido", closed_at: agora },
      { stage: "ganho", closed_at: agora },
      { stage: "novo", closed_at: agora },
      { stage: "agendado", lost_reason: "preco" },
    ]) {
      const { error } = await admin.from("opportunities").update(mudanca).eq("id", op.id)
      expect(error?.code, JSON.stringify(mudanca)).toBe("23514")
    }
  })

  it("procedimento de outra clínica não entra", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const procedimentoDeB = await novoProcedimento(B, "Clareamento B")
    const { error } = await admin.from("opportunities").update({ procedure_id: procedimentoDeB }).eq("id", op.id)
    expect(error?.code).toBe("23503")
  })
})

describe("leitura e escrita pela sessão", () => {
  it("owner e staff leem as oportunidades da clínica; o profissional não lê nenhuma", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    for (const papel of ["owner", "staff"] as const) {
      const db = await comoUsuario(A.equipe[papel]!)
      const { data, error } = await db.from("opportunities").select("id, opportunity_events(id)").eq("patient_id", p)
      expect(error).toBeNull()
      expect(data, papel).toHaveLength(1)
    }
    const profissional = await comoUsuario(A.equipe.professional!)
    const ops = await profissional.from("opportunities").select("id").eq("clinic_id", A.id)
    const evs = await profissional.from("opportunity_events").select("id").eq("clinic_id", A.id)
    expect(ops.data).toEqual([])
    expect(evs.data).toEqual([])
  })

  it("membro de outra clínica não lê", async () => {
    const db = await comoUsuario(B.equipe.owner!)
    const { data } = await db.from("opportunities").select("id").eq("clinic_id", A.id)
    expect(data).toEqual([])
  })

  it("ninguém pela sessão insere, altera ou apaga oportunidade ou evento", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const db = await comoUsuario(A.equipe.owner!)
    const tentativas = [
      await db.from("opportunities").insert({ clinic_id: A.id, patient_id: p }),
      await db.from("opportunities").update({ stage: "ganho" }).eq("id", op.id),
      await db.from("opportunities").update({ notes_encrypted: "x" }).eq("id", op.id),
      await db.from("opportunities").delete().eq("id", op.id),
      await db.from("opportunity_events").insert({ clinic_id: A.id, opportunity_id: op.id, to_stage: "ganho" }),
      await db.from("opportunity_events").delete().eq("opportunity_id", op.id),
    ]
    for (const t of tentativas) expect(t.error?.code).toBe("42501")
    expect((await oportunidades(p))[0].stage).toBe("novo")
  })
})

describe("membro e procedimento removidos", () => {
  it("o membro que sai da equipe deixa os cartões sem responsável", async () => {
    const p = await novoPaciente(C)
    await registrar(C, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const staff = C.equipe.staff!
    const { error } = await admin.from("opportunities").update({ owner_user_id: staff.id }).eq("id", op.id)
    if (error) throw error
    const { error: erroSaida } = await admin.from("clinic_members").delete().eq("clinic_id", C.id).eq("user_id", staff.id)
    if (erroSaida) throw erroSaida
    const { data } = await admin.from("opportunities").select("owner_user_id").eq("id", op.id).single()
    expect(data?.owner_user_id).toBeNull()
  })

  it("o procedimento apagado do perfil deixa o campo vazio, e o valor fica", async () => {
    const p = await novoPaciente(C)
    await registrar(C, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const proc = await novoProcedimento(C, "Implante C")
    const { error } = await admin.from("opportunities").update({ procedure_id: proc, value_cents: 350000 }).eq("id", op.id)
    if (error) throw error
    await admin.from("procedures").delete().eq("id", proc)
    const { data } = await admin.from("opportunities").select("procedure_id, value_cents").eq("id", op.id).single()
    expect(data).toEqual({ procedure_id: null, value_cents: 350000 })
  })
})
```

> **Correção na execução (rodada 1):** testes novos: duas conversas (dois agentes) do mesmo paciente ao mesmo tempo, para exercer o índice único parcial de verdade; reabertura depois de Ganho. (Pós-push) o caso dos dois agentes usa a clínica D, no Pro (o Starter permite 1 agente): `LIMITE_DE_AGENTES` em lib/agent-config/schema.ts.

- [ ] **Passo 3: escrever o teste do canal ao vivo** em `tests/rls/crm-realtime.test.ts`:

```ts
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  admin,
  anonClient,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * O tempo real do CRM (spec crm-v1, "Ao vivo"): um trigger avisa o canal
 * privado `crm:<clinic_id>` a cada mudança de oportunidade, sem dado. Só
 * owner e staff da clínica entram. O tópico e o evento são escritos aqui
 * por extenso; a Tarefa 6 cria `lib/crm/ao-vivo.ts` com os mesmos valores
 * e um teste unitário que os confere.
 */

const EVENTO = "oportunidade"
const topico = (c: ClinicaDeTeste) => `crm:${c.id}`

type Assinatura = { client: SupabaseClient; canal: RealtimeChannel; status: string[]; avisos: Record<string, unknown>[] }

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let pacienteA: string
let pacienteB: string
let minuto = 100
const assinaturas: Assinatura[] = []

async function entrar(client: SupabaseClient, nome: string): Promise<Assinatura> {
  const { data } = await client.auth.getSession()
  await client.realtime.setAuth(data.session?.access_token ?? null)
  const canal = client.channel(nome, { config: { private: true } })
  const a: Assinatura = { client, canal, status: [], avisos: [] }
  canal.on("broadcast", { event: EVENTO }, (m) => a.avisos.push((m.payload ?? {}) as Record<string, unknown>))
  assinaturas.push(a)
  await new Promise<void>((resolve) => {
    canal.subscribe((status) => {
      a.status.push(status)
      if (status !== "CLOSED") resolve()
    })
  })
  return a
}

async function esperar(condicao: () => boolean, ms = 10_000): Promise<boolean> {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (condicao()) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return condicao()
}

/** Mensagem nova do paciente: atualiza a oportunidade aberta, e o trigger avisa. */
async function mexer(c: ClinicaDeTeste, paciente: string) {
  await registrar(c, paciente, { autor: "patient", texto: "Mais uma", em: emMinutos(++minuto) })
}

async function aquecer(a: Assinatura, c: ClinicaDeTeste, paciente: string) {
  for (let i = 0; i < 10; i++) {
    const antes = a.avisos.length
    await mexer(c, paciente)
    if (await esperar(() => a.avisos.length > antes, 3_000)) return
  }
  throw new Error("O membro não recebeu nenhum aviso do CRM da própria clínica.")
}

beforeAll(async () => {
  ;[A, B] = await Promise.all([
    montarClinica("crm-rt-a", ["owner", "professional"]),
    montarClinica("crm-rt-b", ["owner"]),
  ])
  ;[pacienteA, pacienteB] = await Promise.all([novoPaciente(A), novoPaciente(B)])
  await registrar(A, pacienteA, { autor: "patient", texto: "Oi", em: emMinutos(0) })
  await registrar(B, pacienteB, { autor: "patient", texto: "Oi", em: emMinutos(0) })
}, 60_000)

afterAll(async () => {
  for (const a of assinaturas) await a.client.removeAllChannels()
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("canal privado crm:<clinic_id>", () => {
  let ownerA: Assinatura

  it("o owner de A recebe o aviso da mudança de oportunidade, sem dado", async () => {
    ownerA = await entrar(await comoUsuario(A.equipe.owner!), topico(A))
    expect(ownerA.status).toContain("SUBSCRIBED")
    await aquecer(ownerA, A, pacienteA)
    for (const aviso of ownerA.avisos) expect(Object.keys(aviso).every((k) => k === "id")).toBe(true)
  }, 60_000)

  it("a mudança em B não chega ao canal de A", async () => {
    const antes = ownerA.avisos.length
    await mexer(B, pacienteB)
    await mexer(A, pacienteA)
    expect(await esperar(() => ownerA.avisos.length > antes)).toBe(true)
    await new Promise((r) => setTimeout(r, 1_000))
    expect(ownerA.avisos.length).toBe(antes + 1)
  }, 60_000)

  it("o owner de B não entra no canal de A", async () => {
    const intruso = await entrar(await comoUsuario(B.equipe.owner!), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(intruso.status).not.toContain("SUBSCRIBED")
    expect(intruso.avisos).toEqual([])
  }, 60_000)

  it("o profissional de A não entra no canal do CRM de A", async () => {
    const profissional = await entrar(await comoUsuario(A.equipe.professional!), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(profissional.status).not.toContain("SUBSCRIBED")
    expect(profissional.avisos).toEqual([])
  }, 60_000)

  it("o anônimo não entra", async () => {
    const anonimo = await entrar(anonClient(), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(anonimo.status).not.toContain("SUBSCRIBED")
    expect(anonimo.avisos).toEqual([])
  }, 60_000)

  it("a mudança de etapa feita direto no banco também avisa", async () => {
    const antes = ownerA.avisos.length
    const { error } = await admin.from("opportunities").update({ stage: "agendado" }).eq("patient_id", pacienteA).is("closed_at", null)
    if (error) throw error
    expect(await esperar(() => ownerA.avisos.length > antes)).toBe(true)
  }, 60_000)
})
```

- [ ] **Passo 4: rodar e ver falhar**

Run: `npx vitest run tests/rls/crm-automacao.test.ts tests/rls/crm-realtime.test.ts`
Esperado: FAIL (`relation "public.opportunities" does not exist` ou `Could not find the table`).

- [ ] **Passo 5: escrever a migration** `supabase/migrations/20261103150000_crm_opportunities.sql`:

```sql
-- CRM próprio, parte 2 (spec crm-v1, seção 3): o funil comercial da
-- clínica no banco. A oportunidade nasce e anda pelos eventos do sistema
-- (mensagem do paciente, qualificação da IA), por triggers na mesma
-- transação de quem gera o evento. A equipe move pelas RPCs da migration
-- seguinte (20261103160000_crm_actions).
--
-- Aditiva: tabelas, tipos e triggers novos. As funções existentes não
-- mudam aqui; register_whatsapp_message e a gravação de qualified_at
-- (lib/conversations/resposta.ts) continuam iguais.
--
-- Ordem de trava: a mensagem trava paciente (for share), agente e
-- conversa, e só depois a oportunidade; a qualificação trava a conversa
-- (update) e depois a oportunidade. Nada trava a oportunidade antes de
-- paciente ou conversa, então não há ciclo.

-- Falhar rápido em vez de enfileirar o webhook atrás de uma trava forte
-- (create trigger em messages e conversations, create policy em
-- realtime.messages).
set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────
create type public.opportunity_stage as enum (
  'novo', 'qualificado', 'agendado', 'compareceu', 'ganho', 'perdido'
);

-- Lista fixa, nunca texto livre: texto livre levaria dado de paciente
-- para onde não deve (lib/crm/tipos.ts, MOTIVOS_DE_PERDA).
create type public.opportunity_lost_reason as enum (
  'preco', 'sem_horario', 'outra_clinica', 'sem_resposta', 'nao_era_paciente', 'outro'
);

-- ─────────────────────────────────────────────────────────────
-- Quem opera o CRM: owner e staff, com a sessão viva
-- ─────────────────────────────────────────────────────────────
-- Mesmo corpo de private.can_operate_conversations (20261012140000), com
-- nome próprio: se um dia os papéis do CRM e os de Conversas divergirem,
-- muda uma função só.
create function private.can_operate_crm(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members
    where clinic_id = target_clinic_id
      and user_id = (select auth.uid())
      and role in ('owner', 'staff')
  )
  and (select private.sessao_ativa())
$$;

-- Só as RPCs do CRM chamam.
revoke execute on function private.can_operate_crm(uuid) from public, anon, authenticated;

-- As clínicas em que a sessão opera o CRM. Para a RLS e para a policy do
-- canal: `clinic_id in (select ...)` vira um initplan, avaliado uma vez
-- por consulta, e não uma chamada por linha.
create function private.crm_clinic_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select clinic_id
  from public.clinic_members
  where user_id = (select auth.uid())
    and role in ('owner', 'staff')
    and (select private.sessao_ativa())
$$;

revoke execute on function private.crm_clinic_ids() from public, anon;
grant execute on function private.crm_clinic_ids() to authenticated;

-- O plano da clínica tem o CRM (lib/billing/plan-limits.ts, TEM_CRM). O
-- dado é gravado em todo plano; só a escrita da equipe exige o plano.
create function private.clinic_has_crm(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select c.plan in ('pro', 'healthtech') from public.clinics c where c.id = target_clinic_id),
    false
  )
$$;

revoke execute on function private.clinic_has_crm(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Oportunidade: o cartão do funil
-- ─────────────────────────────────────────────────────────────
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  -- A conversa que abriu. Apagar o agente apaga a conversa; a oportunidade fica.
  conversation_id uuid,

  stage public.opportunity_stage not null default 'novo',
  stage_changed_at timestamptz not null default now(),
  -- Muda com mensagem do paciente e com mudança de etapa ("parado há N dias").
  last_activity_at timestamptz not null default now(),
  opened_at timestamptz not null default now(),
  -- Só Ganho e Perdido.
  closed_at timestamptz,

  procedure_id uuid,
  -- BRL, em centavos. Teto de R$ 1 milhão (VALOR_MAXIMO_CENTAVOS).
  value_cents integer
    check (value_cents is null or (value_cents > 0 and value_cents <= 100000000)),
  owner_user_id uuid,
  next_action_at timestamptz,
  lost_reason public.opportunity_lost_reason,

  notes_encrypted text, -- PII
  notes_redacted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_id_clinic_id_key unique (id, clinic_id),
  -- FKs compostas: nunca apontam para paciente, conversa, procedimento ou
  -- membro de outra clínica.
  constraint opportunities_paciente_da_clinica
    foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade,
  constraint opportunities_conversa_da_clinica
    foreign key (conversation_id, clinic_id) references public.conversations(id, clinic_id)
    on delete set null (conversation_id),
  constraint opportunities_procedimento_da_clinica
    foreign key (procedure_id, clinic_id) references public.procedures(id, clinic_id)
    on delete set null (procedure_id),
  -- Membro que sai da equipe: os cartões dele ficam sem responsável.
  constraint opportunities_responsavel_da_clinica
    foreign key (clinic_id, owner_user_id) references public.clinic_members(clinic_id, user_id)
    on delete set null (owner_user_id),

  constraint opportunities_encerrada_coerente
    check ((stage in ('ganho', 'perdido')) = (closed_at is not null)),
  constraint opportunities_motivo_so_em_perdido
    check ((stage = 'perdido') = (lost_reason is not null)),
  constraint opportunities_ganho_tem_valor
    check (stage <> 'ganho' or value_cents is not null),
  constraint opportunities_nota_redigida
    check (notes_redacted_at is null or notes_encrypted is null),
  -- A nota só entra cifrada (lib/conversations/conteudo.ts): base64 de
  -- versão (1 byte) + IV (12) + tag (16) + ciphertext. Mínimo: 1 byte de
  -- ciphertext = 30 bytes = 40 caracteres de base64. Máximo: nota de
  -- TAMANHO_MAXIMO_DA_NOTA = 2000 caracteres x até 4 bytes UTF-8 = 8000
  -- bytes de ciphertext, + 29 = 8029 bytes = ceil(8029 / 3) x 4 = 10708
  -- caracteres. Texto puro de saúde não passa (acento, espaço, hífen e
  -- tamanho fora da faixa), mesmo escrito direto no banco. A RPC
  -- update_opportunity_details repete a mesma expressão.
  constraint opportunities_nota_cifrada
    check (
      notes_encrypted is null
      or (
        notes_encrypted ~ '^[A-Za-z0-9+/]+={0,2}$'
        and length(notes_encrypted) % 4 = 0
        and length(notes_encrypted) between 40 and 10708
      )
    )
);

comment on table public.opportunities is
  'O funil comercial da clínica (crm-v1). Nasce pelo trigger da primeira '
  'mensagem do paciente; anda pelo trigger de qualified_at e pela RPC '
  'move_opportunity. Ninguém da sessão insere, altera ou apaga direto.';

comment on column public.opportunities.notes_encrypted is
  'PII (dado de saúde). AES-256-GCM com MESSAGE_CONTENT_ENCRYPTION_KEY, '
  'amarrado ao clinic_id (lib/conversations/conteudo.ts). Decifrado só no '
  'servidor; nunca logar (lgpd-security, regras 1 e 2). Apagado por '
  'anonymize_patient (notes_redacted_at).';

-- Uma aberta por paciente (spec crm-v1, "Regras de movimento"). É também
-- o alvo do `on conflict` do trigger de abertura.
create unique index opportunities_uma_aberta_por_paciente
  on public.opportunities (patient_id)
  where closed_at is null;

-- A leitura da tela: as abertas e as encerradas recentes da clínica.
create index opportunities_clinic_closed_idx on public.opportunities (clinic_id, closed_at);
-- FKs (cascata e set null varrem por elas).
create index opportunities_patient_idx on public.opportunities (patient_id);
create index opportunities_conversation_idx on public.opportunities (conversation_id);
create index opportunities_procedure_idx on public.opportunities (procedure_id);
create index opportunities_owner_idx on public.opportunities (clinic_id, owner_user_id);

create trigger opportunities_touch_updated_at
  before update on public.opportunities
  for each row
  execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Evento: toda mudança de etapa, só inserção
-- ─────────────────────────────────────────────────────────────
create table public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  opportunity_id uuid not null,
  -- Nulo na abertura.
  from_stage public.opportunity_stage,
  to_stage public.opportunity_stage not null,
  -- Nulo = sistema (primeira mensagem, qualificação da IA). O registro
  -- sobrevive à remoção da pessoa da equipe, como em conversation_events.
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_email text, -- PII (equipe)
  created_at timestamptz not null default now(),

  constraint opportunity_events_da_oportunidade
    foreign key (opportunity_id, clinic_id)
    references public.opportunities(id, clinic_id) on delete cascade,
  constraint opportunity_events_muda_de_etapa check (from_stage is distinct from to_stage),
  constraint opportunity_events_email_so_de_membro check (actor_user_id is not null or actor_email is null)
);

comment on column public.opportunity_events.actor_email is
  'PII (dado pessoal da equipe da clínica): e-mail de quem moveu, copiado '
  'no momento. Nunca logar (lgpd-security, regras 1 e 2).';

create index opportunity_events_opportunity_idx on public.opportunity_events (opportunity_id, created_at);
create index opportunity_events_actor_idx on public.opportunity_events (actor_user_id);
-- A RLS filtra por clínica; sem este, a leitura de eventos varre a tabela.
create index opportunity_events_clinic_idx on public.opportunity_events (clinic_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Acesso: só leitura, para owner e staff
-- ─────────────────────────────────────────────────────────────
alter table public.opportunities enable row level security;
alter table public.opportunity_events enable row level security;

revoke all on table public.opportunities from anon, authenticated;
revoke all on table public.opportunity_events from anon, authenticated;
grant select on table public.opportunities to authenticated;
grant select on table public.opportunity_events to authenticated;

create policy "owner e staff leem as oportunidades da própria clínica"
  on public.opportunities
  for select
  to authenticated
  using (clinic_id in (select private.crm_clinic_ids()));

create policy "owner e staff leem os eventos das oportunidades da própria clínica"
  on public.opportunity_events
  for select
  to authenticated
  using (clinic_id in (select private.crm_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- Automação 1: a mensagem do paciente abre, ou atualiza a atividade
-- ─────────────────────────────────────────────────────────────
-- Na transação da register_whatsapp_message: o reenvio da Meta não insere
-- a mensagem de novo (unique do wamid) e não chega aqui. Duas mensagens
-- ao mesmo tempo: a segunda espera o índice único da primeira, cai no
-- `do nothing` e só atualiza a atividade.
create function private.crm_open_on_patient_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente uuid;
  v_aberta uuid;
  v_atualizadas integer;
begin
  select c.patient_id into v_paciente
    from public.conversations c
   where c.id = new.conversation_id
     and c.clinic_id = new.clinic_id;

  -- Até duas voltas: se o `do nothing` achou uma aberta, mas ela foi
  -- encerrada antes do update da atividade (0 linhas), a segunda volta
  -- abre outra. A mensagem do paciente nunca fica sem oportunidade aberta.
  for v_volta in 1..2 loop
    insert into public.opportunities (clinic_id, patient_id, conversation_id)
    values (new.clinic_id, v_paciente, new.conversation_id)
    on conflict (patient_id) where closed_at is null do nothing
    returning id into v_aberta;

    if v_aberta is not null then
      insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage)
      values (new.clinic_id, v_aberta, null, 'novo');
      exit;
    end if;

    update public.opportunities o
       set last_activity_at = now()
     where o.patient_id = v_paciente
       and o.clinic_id = new.clinic_id
       and o.closed_at is null;
    get diagnostics v_atualizadas = row_count;
    exit when v_atualizadas > 0;
  end loop;
  return null;
end;
$$;

revoke execute on function private.crm_open_on_patient_message() from public, anon, authenticated;

-- Só a mensagem do paciente: o eco da equipe e a resposta da IA não abrem.
create trigger messages_crm_open
  after insert on public.messages
  for each row
  when (new.author = 'patient')
  execute function private.crm_open_on_patient_message();

-- ─────────────────────────────────────────────────────────────
-- Automação 2: a qualificação da IA avança de Novo para Qualificado
-- ─────────────────────────────────────────────────────────────
-- O automático só avança: em qualquer outra etapa, nada muda. O update
-- trava a linha; se a equipe moveu ao mesmo tempo, o `stage = 'novo'` é
-- reavaliado depois da trava e não rebaixa.
create function private.crm_qualify_on_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movida uuid;
begin
  update public.opportunities o
     set stage = 'qualificado',
         stage_changed_at = now(),
         last_activity_at = now()
   where o.clinic_id = new.clinic_id
     and o.patient_id = new.patient_id
     and o.closed_at is null
     and o.stage = 'novo'
  returning o.id into v_movida;

  if v_movida is not null then
    insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage)
    values (new.clinic_id, v_movida, 'novo', 'qualificado');
  end if;
  return null;
end;
$$;

revoke execute on function private.crm_qualify_on_conversation() from public, anon, authenticated;

create trigger conversations_crm_qualify
  after update of qualified_at on public.conversations
  for each row
  when (old.qualified_at is null and new.qualified_at is not null)
  execute function private.crm_qualify_on_conversation();

-- ─────────────────────────────────────────────────────────────
-- Ao vivo: "alguma oportunidade desta clínica mudou", sem dado
-- ─────────────────────────────────────────────────────────────
-- O padrão de Conversas (20261011140000 e 20261011150000): realtime.send
-- privado, que engole o próprio erro, e desistência em 200 ms se a tabela
-- do Realtime estiver travada. O aviso nunca segura a gravação.
create function private.broadcast_crm_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set lock_timeout = '200ms'
as $$
begin
  perform realtime.send('{}'::jsonb, 'oportunidade', 'crm:' || new.clinic_id::text, true);
  return null;
end;
$$;

revoke execute on function private.broadcast_crm_change() from public, anon, authenticated;

create trigger opportunities_broadcast_change
  after insert or update on public.opportunities
  for each row
  execute function private.broadcast_crm_change();

-- Só owner e staff da clínica do tópico entram no canal. O profissional,
-- que entra no de Conversas, não entra neste.
create policy "owner e staff recebem o aviso do CRM da própria clínica"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      select 'crm:' || c::text from private.crm_clinic_ids() as c
    )
  );

reset lock_timeout;
```

> **Correção na execução (rodada 1):** (M1) `set lock_timeout = '5s'` no topo e `reset` no fim; (I2) check `opportunities_nota_cifrada`: a nota só entra em base64 de 40 a 10708 caracteres (30 bytes mínimos = versão 1 + IV 12 + tag 16 + 1 de ciphertext; máximo 29 + 2000 x 4 = 8029 bytes = ceil(8029/3) x 4 = 10708); (M2) o trigger de abertura tenta de novo uma vez se a oportunidade aberta foi encerrada entre o `do nothing` e o update da atividade; (M7) índice `opportunity_events (clinic_id, created_at)`.

- [ ] **Passo 6: `--dry-run` e aprovação do Jhones**

Run: `npx supabase db push --remote -p "$SUPABASE_DB_PASSWORD" --dry-run`
Esperado: só `20261103150000_crm_opportunities.sql` na lista. Mostre a saída ao Jhones e peça a aprovação do push (o classificador barra o push em produção sem ela).

- [ ] **Passo 7: aplicar**, depois da aprovação:

Run: `npx supabase db push --remote -p "$SUPABASE_DB_PASSWORD" --yes`

- [ ] **Passo 8: rodar e ver passar**

Run: `npx vitest run tests/rls/crm-automacao.test.ts tests/rls/crm-realtime.test.ts`
Esperado: PASS. Rode também `npx vitest run tests/rls/conversas-realtime.test.ts tests/rls/conversations.test.ts tests/rls/canal-demo.test.ts` (o trigger novo em `messages` e em `conversations` não pode mudar o que já existia).

- [ ] **Passo 9: commit** (migration e testes juntos)

```bash
git add supabase/migrations/20261103150000_crm_opportunities.sql tests/rls/crm-automacao.test.ts tests/rls/crm-realtime.test.ts
git commit -m "feat(crm): oportunidades no banco, abertas e qualificadas pelos triggers"
```

---

### Tarefa 2: Migration das ações (mover, editar, buscar, equipe, exclusão LGPD)

**Arquivos:**
- Criar: `supabase/migrations/20261103160000_crm_actions.sql`
- Teste: `tests/rls/crm-acoes.test.ts`

**Interfaces:**
- Consome: tudo da Tarefa 1; `public.anonymize_patient(uuid, text)` na versão de `20261103120000_message_transcripts.sql` (a de `20261103130000` não a redefine: confira com `grep -n "anonymize_patient" supabase/migrations/20261103130000_drop_redact_patient_messages.sql`; se houver `create or replace` dela lá, parta daquele corpo).
- Produz (todas com `grant execute ... to authenticated`):
  - `public.move_opportunity(p_opportunity_id uuid, p_from opportunity_stage, p_to opportunity_stage, p_procedure_id uuid default null, p_value_cents integer default null, p_lost_reason opportunity_lost_reason default null) returns text` → `ok` | `sem-mudanca` | `nao-encontrada` | `invalido`;
  - `public.update_opportunity_details(p_opportunity_id uuid, p_procedure_id uuid, p_value_cents integer, p_owner_user_id uuid, p_next_action_at timestamptz, p_notes_encrypted text) returns text` → `ok` | `nao-encontrada` | `invalido`;
  - `public.search_opportunities(p_clinic_id uuid, p_nome text, p_telefone text) returns setof uuid` (invoker);
  - `public.crm_team(p_clinic_id uuid) returns table (user_id uuid, email text)`;
  - `anonymize_patient` passa a apagar a nota (`notes_encrypted = null`, `notes_redacted_at`).

- [ ] **Passo 1: escrever o teste** em `tests/rls/crm-acoes.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo, decifrarConteudo } from "@/lib/conversations/conteudo"
import {
  admin,
  anonClient,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * As ações do CRM (spec crm-v1, seções 3 e 4) e o isolamento, contra o
 * banco real: mover, editar, buscar, a equipe, e a exclusão LGPD.
 * A e B no Pro; S fica no Starter (o padrão da clínica nova).
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let S: ClinicaDeTeste
let procA: string
let procB: string
let contador = 0

async function abrir(c: ClinicaDeTeste, p: { nome?: string; telefone?: string } = {}) {
  const paciente = await novoPaciente(c, p)
  await registrar(c, paciente, { autor: "patient", texto: "Oi", em: emMinutos(++contador) })
  const { data, error } = await admin.from("opportunities").select("id").eq("patient_id", paciente).single()
  if (error) throw error
  return { paciente, op: data.id as string }
}

async function linha(op: string) {
  const { data, error } = await admin
    .from("opportunities")
    .select("stage, closed_at, procedure_id, value_cents, lost_reason, owner_user_id, next_action_at, notes_encrypted, notes_redacted_at, opened_at")
    .eq("id", op)
    .single()
  if (error) throw error
  return data
}

async function eventos(op: string) {
  const { data, error } = await admin
    .from("opportunity_events")
    .select("from_stage, to_stage, actor_user_id, actor_email")
    .eq("opportunity_id", op)
    .order("created_at")
  if (error) throw error
  return data
}

async function procedimento(c: ClinicaDeTeste, nome: string) {
  const { data, error } = await admin.from("procedures").insert({ clinic_id: c.id, name: nome, duration_minutes: 30 }).select("id").single()
  if (error) throw error
  return data.id as string
}

const mover = async (quem: ReturnType<typeof comoUsuario>, args: Record<string, unknown>) => {
  const { data, error } = await (await quem).rpc("move_opportunity", args)
  expect(error).toBeNull()
  return data as string
}

const detalhes = (op: string, p: Partial<Record<string, unknown>> = {}) => ({
  p_opportunity_id: op,
  p_procedure_id: null,
  p_value_cents: null,
  p_owner_user_id: null,
  p_next_action_at: null,
  p_notes_encrypted: null,
  ...p,
})

beforeAll(async () => {
  ;[A, B, S] = await Promise.all([
    montarClinica("crm-acoes-a", ["owner", "staff", "professional"]),
    montarClinica("crm-acoes-b", ["owner"]),
    montarClinica("crm-acoes-s", ["owner"]),
  ])
  const { error } = await admin.from("clinics").update({ plan: "pro" }).in("id", [A.id, B.id])
  if (error) throw error
  ;[procA, procB] = await Promise.all([procedimento(A, "Implante A"), procedimento(B, "Implante B")])
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B), limparClinica(S)])
}, 60_000)

describe("move_opportunity", () => {
  it("move, atualiza as datas e grava o evento com quem moveu", async () => {
    const { op } = await abrir(A)
    const staff = A.equipe.staff!
    expect(await mover(comoUsuario(staff), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("ok")
    expect((await linha(op)).stage).toBe("agendado")
    expect((await eventos(op)).at(-1)).toEqual({ from_stage: "novo", to_stage: "agendado", actor_user_id: staff.id, actor_email: staff.email })
  })

  it("para trás também vale (o manual vai para qualquer etapa)", async () => {
    const { op } = await abrir(A)
    const owner = comoUsuario(A.equipe.owner!)
    expect(await mover(owner, { p_opportunity_id: op, p_from: "novo", p_to: "compareceu" })).toBe("ok")
    expect(await mover(owner, { p_opportunity_id: op, p_from: "compareceu", p_to: "qualificado" })).toBe("ok")
  })

  it("com a etapa esperada diferente da atual: sem-mudanca, e nada muda", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(A.equipe.staff!), { p_opportunity_id: op, p_from: "agendado", p_to: "compareceu" })).toBe("sem-mudanca")
    expect((await linha(op)).stage).toBe("novo")
    expect(await eventos(op)).toHaveLength(1)
  })

  it("depois da qualificação da IA, mover com p_from='novo' dá sem-mudanca (a tela viu uma etapa velha)", async () => {
    const { paciente, op } = await abrir(A)
    const { data: conversa, error } = await admin.from("conversations").select("id").eq("patient_id", paciente).single()
    if (error) throw error
    const { error: erroQualificar } = await admin.from("conversations").update({ qualified_at: new Date().toISOString() }).eq("id", conversa.id)
    if (erroQualificar) throw erroQualificar
    expect((await linha(op)).stage).toBe("qualificado")
    const r = await mover(comoUsuario(A.equipe.staff!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
    expect(r).toBe("sem-mudanca")
    expect((await linha(op)).stage).toBe("qualificado")
    expect(await eventos(op)).toHaveLength(2)
  })

  it("etapa de origem ou de destino nula: invalido (e não erro de coluna nula)", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: null })).toBe("invalido")
    expect(await mover(staff, { p_opportunity_id: op, p_from: null, p_to: "agendado" })).toBe("invalido")
    expect((await linha(op)).stage).toBe("novo")
    expect(await eventos(op)).toHaveLength(1)
  })

  it("Ganho sem procedimento, sem valor, com valor fora da faixa ou com procedimento de outra clínica: invalido", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    for (const extra of [
      { p_value_cents: 100000 },
      { p_procedure_id: procA },
      { p_procedure_id: procA, p_value_cents: 0 },
      { p_procedure_id: procA, p_value_cents: 100000001 },
      { p_procedure_id: procB, p_value_cents: 100000 },
    ]) {
      expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", ...extra }), JSON.stringify(extra)).toBe("invalido")
    }
    expect((await linha(op)).stage).toBe("novo")
  })

  it("Ganho com procedimento e valor encerra; mover de novo dá sem-mudanca", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 350000 })).toBe("ok")
    const l = await linha(op)
    expect(l).toMatchObject({ stage: "ganho", procedure_id: procA, value_cents: 350000, lost_reason: null })
    expect(l.closed_at).not.toBeNull()
    expect(await mover(staff, { p_opportunity_id: op, p_from: "ganho", p_to: "novo" })).toBe("sem-mudanca")
  })

  it("Perdido exige o motivo e encerra", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "perdido" })).toBe("invalido")
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "perdido", p_lost_reason: "sem_horario" })).toBe("ok")
    expect(await linha(op)).toMatchObject({ stage: "perdido", lost_reason: "sem_horario" })
  })

  it("membro de B não move a de A (nao-encontrada), e nada muda", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(B.equipe.owner!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
    expect((await linha(op)).stage).toBe("novo")
  })

  it("o profissional não move", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(A.equipe.professional!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
  })

  it("no Starter, a RPC recusa (segunda barreira da trava de plano)", async () => {
    const { op } = await abrir(S)
    expect(await mover(comoUsuario(S.equipe.owner!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
    expect((await linha(op)).stage).toBe("novo")
  })

  it("o anônimo não chama", async () => {
    const { op } = await abrir(A)
    const { error } = await anonClient().rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
    expect(error).not.toBeNull()
    expect((await linha(op)).stage).toBe("novo")
  })
})

describe("update_opportunity_details", () => {
  it("grava procedimento, valor, responsável, próxima ação e a nota cifrada", async () => {
    const { op } = await abrir(A)
    const staff = A.equipe.staff!
    const nota = cifrarConteudo(A.id, "Prefere manhã; sensível a dor")
    const { data, error } = await (await comoUsuario(staff)).rpc(
      "update_opportunity_details",
      detalhes(op, { p_procedure_id: procA, p_value_cents: 120050, p_owner_user_id: staff.id, p_next_action_at: "2026-12-01T13:00:00Z", p_notes_encrypted: nota }),
    )
    expect(error).toBeNull()
    expect(data).toBe("ok")
    const l = await linha(op)
    expect(l).toMatchObject({ procedure_id: procA, value_cents: 120050, owner_user_id: staff.id })
    expect(Date.parse(l.next_action_at!)).toBe(Date.parse("2026-12-01T13:00:00Z"))
    expect(l.notes_encrypted).not.toContain("manhã")
    expect(decifrarConteudo(A.id, l.notes_encrypted!)).toBe("Prefere manhã; sensível a dor")
    // Editar campo não é mudança de etapa: nenhum evento novo.
    expect(await eventos(op)).toHaveLength(1)
  })

  it("responsável de fora da equipe (ou profissional), procedimento de outra clínica e valor fora da faixa: invalido", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const p of [
      { p_owner_user_id: B.equipe.owner!.id },
      { p_owner_user_id: A.equipe.professional!.id },
      { p_procedure_id: procB },
      { p_value_cents: 0 },
      { p_value_cents: 100000001 },
    ]) {
      const { data } = await staff.rpc("update_opportunity_details", detalhes(op, p))
      expect(data, JSON.stringify(p)).toBe("invalido")
    }
  })

  it("Ganho não fica sem valor", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 5000 })
    const { data } = await (await staff).rpc("update_opportunity_details", detalhes(op, { p_procedure_id: procA }))
    expect(data).toBe("invalido")
    expect((await linha(op)).value_cents).toBe(5000)
  })

  it("oportunidade em Ganho não perde o procedimento: p_procedure_id nulo dá invalido e nada muda", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 5000 })
    const { data, error } = await (await staff).rpc("update_opportunity_details", detalhes(op, { p_value_cents: 7000 }))
    expect(error).toBeNull()
    expect(data).toBe("invalido")
    const l = await linha(op)
    expect(l.procedure_id).toBe(procA)
    expect(l.value_cents).toBe(5000)
  })

  it("Ganho cujo procedimento foi apagado do perfil continua editável (campo vazio, valor e nota gravados)", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    const proc = await procedimento(A, "Faceta A")
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: proc, p_value_cents: 5000 })
    const { error: erroApagar } = await admin.from("procedures").delete().eq("id", proc)
    if (erroApagar) throw erroApagar
    expect((await linha(op)).procedure_id).toBeNull()
    const nota = cifrarConteudo(A.id, "Voltar em seis meses")
    const { data, error } = await (await staff).rpc(
      "update_opportunity_details",
      detalhes(op, { p_value_cents: 6000, p_notes_encrypted: nota }),
    )
    expect(error).toBeNull()
    expect(data).toBe("ok")
    const l = await linha(op)
    expect(l.procedure_id).toBeNull()
    expect(l.value_cents).toBe(6000)
    expect(l.notes_encrypted).toBe(nota)
  })

  it("nota fora do formato cifrado (texto puro, curta demais, gigante) dá invalido e a coluna não muda", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const nota of ["Prefere manhã", "Prefere-manha", "A".repeat(36), "A".repeat(10_712), "A".repeat(37) + "==="]) {
      const { data, error } = await staff.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: nota }))
      expect(error, `tamanho ${nota.length}`).toBeNull()
      expect(data, `tamanho ${nota.length}`).toBe("invalido")
    }
    expect((await linha(op)).notes_encrypted).toBeNull()
  })

  it("os limites da nota: 40 e 10708 caracteres de base64 passam; a nota de 2000 caracteres de 4 bytes cabe", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const nota of ["A".repeat(40), "A".repeat(10_708), cifrarConteudo(A.id, "😀".repeat(1000)), cifrarConteudo(A.id, "ç".repeat(2000))]) {
      const { data, error } = await staff.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: nota }))
      expect(error, `tamanho ${nota.length}`).toBeNull()
      expect(data, `tamanho ${nota.length}`).toBe("ok")
    }
  })

  it("o banco recusa texto puro na nota, mesmo escrito direto como administrador (23514)", async () => {
    const { op } = await abrir(A)
    const { error } = await admin.from("opportunities").update({ notes_encrypted: "Prefere manhã" }).eq("id", op)
    expect(error?.code).toBe("23514")
    const paciente = await novoPaciente(A)
    const { error: erroInsert } = await admin
      .from("opportunities")
      .insert({ clinic_id: A.id, patient_id: paciente, notes_encrypted: "Prefere manhã" })
    expect(erroInsert?.code).toBe("23514")
    expect((await linha(op)).notes_encrypted).toBeNull()
  })

  it("membro de B, profissional de A e Starter: nao-encontrada", async () => {
    const { op } = await abrir(A)
    const { op: opS } = await abrir(S)
    for (const [quem, alvo] of [
      [B.equipe.owner!, op],
      [A.equipe.professional!, op],
      [S.equipe.owner!, opS],
    ] as const) {
      const { data } = await (await comoUsuario(quem)).rpc("update_opportunity_details", detalhes(alvo, { p_value_cents: 100 }))
      expect(data).toBe("nao-encontrada")
    }
    expect((await linha(op)).value_cents).toBeNull()
  })
})

describe("search_opportunities e crm_team", () => {
  it("acha por nome e por parte do telefone, só na própria clínica", async () => {
    const telefone = `+55819${String(Date.now()).slice(-8)}`
    const { op } = await abrir(A, { nome: "Gertrudes Busca", telefone })
    const staff = await comoUsuario(A.equipe.staff!)
    const porNome = await staff.rpc("search_opportunities", { p_clinic_id: A.id, p_nome: "%gertrudes%", p_telefone: null })
    const porTelefone = await staff.rpc("search_opportunities", { p_clinic_id: A.id, p_nome: null, p_telefone: `%${telefone.slice(-6)}%` })
    expect(porNome.data).toContain(op)
    expect(porTelefone.data).toContain(op)
    const deB = await (await comoUsuario(B.equipe.owner!)).rpc("search_opportunities", { p_clinic_id: A.id, p_nome: "%gertrudes%", p_telefone: null })
    expect(deB.data).toEqual([])
  })

  it("a equipe do CRM é owner e staff da clínica, com o e-mail; outra clínica não vê", async () => {
    const { data } = await (await comoUsuario(A.equipe.staff!)).rpc("crm_team", { p_clinic_id: A.id })
    expect(data).toEqual(
      expect.arrayContaining([
        { user_id: A.equipe.owner!.id, email: A.equipe.owner!.email },
        { user_id: A.equipe.staff!.id, email: A.equipe.staff!.email },
      ]),
    )
    expect(data).toHaveLength(2)
    const deB = await (await comoUsuario(B.equipe.owner!)).rpc("crm_team", { p_clinic_id: A.id })
    expect(deB.data).toEqual([])
  })
})

describe("anonymize_patient (exclusão LGPD)", () => {
  it("apaga a nota e mantém etapa, datas e valor", async () => {
    const { paciente, op } = await abrir(A)
    const owner = await comoUsuario(A.equipe.owner!)
    await owner.rpc("update_opportunity_details", detalhes(op, { p_value_cents: 80000, p_notes_encrypted: cifrarConteudo(A.id, "Nota sensível") }))
    await owner.rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "perdido", p_lost_reason: "preco" })
    const antes = await linha(op)

    const marcador = `+999${String(Date.now()).slice(-11).padStart(11, "0")}`
    const { error } = await owner.rpc("anonymize_patient", { p_patient_id: paciente, p_phone_marker: marcador })
    expect(error).toBeNull()

    const depois = await linha(op)
    expect(depois.notes_encrypted).toBeNull()
    expect(depois.notes_redacted_at).not.toBeNull()
    expect(depois).toMatchObject({ stage: antes.stage, value_cents: 80000, closed_at: antes.closed_at, opened_at: antes.opened_at })
  })

  it("depois da exclusão, a nota não volta pela edição", async () => {
    const { paciente, op } = await abrir(A)
    const owner = await comoUsuario(A.equipe.owner!)
    const marcador = `+999${String(Date.now() + 1).slice(-11).padStart(11, "0")}`
    await owner.rpc("anonymize_patient", { p_patient_id: paciente, p_phone_marker: marcador })
    const { data } = await owner.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: cifrarConteudo(A.id, "Outra nota") }))
    expect(data).toBe("ok")
    expect((await linha(op)).notes_encrypted).toBeNull()
  })
})
```

> **Correção na execução (rodada 1):** testes novos: mover com p_from velho depois da qualificação (`sem-mudanca`); etapa nula (`invalido`); edição em Ganho sem procedimento (`invalido`); nota fora do formato, limites da nota e texto puro direto no banco (23514). (Rodada 2) Ganho cujo procedimento foi apagado do perfil continua editável: teste novo.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run tests/rls/crm-acoes.test.ts`
Esperado: FAIL (`Could not find the function public.move_opportunity`).

- [ ] **Passo 3: escrever a migration** `supabase/migrations/20261103160000_crm_actions.sql`:

```sql
-- CRM próprio, parte 2 (spec crm-v1, seções 3 e 4): o que a equipe faz.
--
-- - move_opportunity: a mudança manual de etapa, de linha única, sobre a
--   etapa que a tela viu, com o evento na mesma transação;
-- - update_opportunity_details: procedimento, valor, responsável, próxima
--   ação e nota (que chega já cifrada pela lib);
-- - search_opportunities: a busca por POST (o termo nunca vai para URL);
-- - crm_team: quem pode ser responsável (owner e staff), com o e-mail;
-- - anonymize_patient passa a apagar a nota (spec, "Exclusão LGPD").
--
-- As duas escritas conferem papel e plano no banco, além da lib: server
-- action é endpoint público, e a RPC também é (PostgREST).

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- Mover
-- ─────────────────────────────────────────────────────────────
create function public.move_opportunity(
  p_opportunity_id uuid,
  p_from public.opportunity_stage,
  p_to public.opportunity_stage,
  p_procedure_id uuid default null,
  p_value_cents integer default null,
  p_lost_reason public.opportunity_lost_reason default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_mudou uuid;
begin
  select o.clinic_id into v_clinica
    from public.opportunities o
   where o.id = p_opportunity_id;
  if v_clinica is null
     or not private.can_operate_crm(v_clinica)
     or not private.clinic_has_crm(v_clinica) then
    return 'nao-encontrada';
  end if;

  -- Etapa nula não é pedido válido (viraria 23502 e o PostgREST repete a linha).
  if p_from is null or p_to is null then
    return 'invalido';
  end if;
  if p_from = p_to then
    return 'sem-mudanca';
  end if;

  if p_to = 'ganho' and (
       p_procedure_id is null
       or p_value_cents is null
       or p_value_cents <= 0
       or p_value_cents > 100000000
       or not exists (
         select 1 from public.procedures pr
          where pr.id = p_procedure_id and pr.clinic_id = v_clinica
       )
     ) then
    return 'invalido';
  end if;
  if p_to = 'perdido' and p_lost_reason is null then
    return 'invalido';
  end if;

  -- Linha única, sobre a etapa que a tela viu. Encerrada não volta.
  update public.opportunities o
     set stage = p_to,
         stage_changed_at = now(),
         last_activity_at = now(),
         closed_at = case when p_to in ('ganho', 'perdido') then now() else null end,
         procedure_id = case when p_to = 'ganho' then p_procedure_id else o.procedure_id end,
         value_cents = case when p_to = 'ganho' then p_value_cents else o.value_cents end,
         lost_reason = case when p_to = 'perdido' then p_lost_reason else null end
   where o.id = p_opportunity_id
     and o.stage = p_from
     and o.closed_at is null
  returning o.id into v_mudou;
  if v_mudou is null then
    return 'sem-mudanca';
  end if;

  -- VALUES, e não INSERT ... SELECT de auth.users: sem o usuário, o NOT
  -- NULL implícito do autor falha e desfaz tudo (lição de 20261011150000).
  insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage, actor_user_id, actor_email)
  values (
    v_clinica,
    p_opportunity_id,
    p_from,
    p_to,
    (select auth.uid()),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
  return 'ok';
end;
$$;

comment on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) is
  'Mudança manual de etapa (crm-v1). ok, sem-mudanca (a etapa não é a que a '
  'tela viu, ou a oportunidade encerrou), nao-encontrada (outra clínica, '
  'papel ou plano) ou invalido (faltam os campos de Ganho/Perdido).';

revoke execute on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) from public, anon;
grant execute on function public.move_opportunity(uuid, public.opportunity_stage, public.opportunity_stage, uuid, integer, public.opportunity_lost_reason) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Editar os outros campos
-- ─────────────────────────────────────────────────────────────
create function public.update_opportunity_details(
  p_opportunity_id uuid,
  p_procedure_id uuid,
  p_value_cents integer,
  p_owner_user_id uuid,
  p_next_action_at timestamptz,
  p_notes_encrypted text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_paciente uuid;
  v_etapa public.opportunity_stage;
  v_procedimento_atual uuid;
  v_anonimizado timestamptz;
begin
  -- Leitura sem trava, só para saber clínica e paciente (não mudam nunca).
  select o.clinic_id, o.patient_id into v_clinica, v_paciente
    from public.opportunities o
   where o.id = p_opportunity_id;
  if v_clinica is null
     or not private.can_operate_crm(v_clinica)
     or not private.clinic_has_crm(v_clinica) then
    return 'nao-encontrada';
  end if;

  -- Validações que não dependem da etapa.
  if p_value_cents is not null and (p_value_cents <= 0 or p_value_cents > 100000000) then
    return 'invalido';
  end if;
  if p_procedure_id is not null and not exists (
       select 1 from public.procedures pr where pr.id = p_procedure_id and pr.clinic_id = v_clinica
     ) then
    return 'invalido';
  end if;
  if p_owner_user_id is not null and not exists (
       select 1 from public.clinic_members m
        where m.clinic_id = v_clinica and m.user_id = p_owner_user_id and m.role in ('owner', 'staff')
     ) then
    return 'invalido';
  end if;
  -- Nota só cifrada (mesma expressão do check opportunities_nota_cifrada:
  -- base64 de 30 a 8029 bytes, 40 a 10708 caracteres). Devolve invalido, e
  -- não 23514, para o erro do PostgREST não repetir a nota.
  if p_notes_encrypted is not null and not (
       p_notes_encrypted ~ '^[A-Za-z0-9+/]+={0,2}$'
       and length(p_notes_encrypted) % 4 = 0
       and length(p_notes_encrypted) between 40 and 10708
     ) then
    return 'invalido';
  end if;

  -- Ordem de trava: paciente (for share) PRIMEIRO, como save_message_transcript
  -- e register_whatsapp_message; só depois a oportunidade. O anonymize_patient
  -- trava paciente (for update) e depois a oportunidade: a mesma ordem, sem ciclo.
  -- Não inverter.
  select p.anonymized_at into v_anonimizado
    from public.patients p
   where p.id = v_paciente and p.clinic_id = v_clinica
     for share;

  -- Trava a oportunidade e relê a etapa: um Ganho gravado há instantes por
  -- move_opportunity é visto aqui, e a edição não sobrescreve o que ele gravou.
  select o.stage, o.procedure_id into v_etapa, v_procedimento_atual
    from public.opportunities o
   where o.id = p_opportunity_id
     for update;
  if v_etapa is null then
    return 'nao-encontrada';
  end if;

  -- Ganho pede valor e não perde o procedimento (spec crm-v1): um formulário
  -- velho (procedimento nulo) não apaga o de um Ganho. Mas o Ganho cujo
  -- procedimento foi apagado do perfil (FK on delete set null: "o campo fica
  -- vazio, o valor fica") continua editável, com o procedimento ainda nulo.
  if v_etapa = 'ganho' and (
       p_value_cents is null
       or (p_procedure_id is null and v_procedimento_atual is not null)
     ) then
    return 'invalido';
  end if;

  update public.opportunities o
     set procedure_id = p_procedure_id,
         value_cents = p_value_cents,
         owner_user_id = p_owner_user_id,
         next_action_at = p_next_action_at,
         notes_encrypted = case when v_anonimizado is null then p_notes_encrypted else null end
   where o.id = p_opportunity_id;
  return 'ok';
end;
$$;

comment on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) is
  'Procedimento, valor, responsável, próxima ação e nota (já cifrada pela '
  'lib, AAD da clínica). Não muda etapa nem grava evento.';

revoke execute on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) from public, anon;
grant execute on function public.update_opportunity_details(uuid, uuid, integer, uuid, timestamptz, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Buscar (por POST)
-- ─────────────────────────────────────────────────────────────
-- Mesmo contrato de search_conversations (20261011170000): os padrões
-- chegam prontos de lib/conversations/busca.ts (padraoDeBusca). security
-- invoker: a RLS de opportunities (owner e staff) e de patients vale.
create function public.search_opportunities(p_clinic_id uuid, p_nome text, p_telefone text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id
    from public.opportunities o
    join public.patients p
      on p.id = o.patient_id
     and p.clinic_id = o.clinic_id
   where o.clinic_id = p_clinic_id
     and (
       (p_nome is not null and p.name ilike p_nome)
       or (p_telefone is not null and p.whatsapp_phone_number like p_telefone)
     )
   order by o.last_activity_at desc
   limit 200
$$;

revoke execute on function public.search_opportunities(uuid, text, text) from public, anon, service_role;
grant execute on function public.search_opportunities(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- A equipe do CRM
-- ─────────────────────────────────────────────────────────────
-- O painel não tem nome de membro: a tela mostra o e-mail (lib/crm/equipe.ts).
-- auth.users não é legível pela sessão; a função lê como dono e só
-- devolve algo a quem opera o CRM da clínica pedida.
create function public.crm_team(p_clinic_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text
    from public.clinic_members m
    join auth.users u on u.id = m.user_id
   where m.clinic_id = p_clinic_id
     and m.role in ('owner', 'staff')
     and (select private.can_operate_crm(p_clinic_id))
   order by u.email
$$;

revoke execute on function public.crm_team(uuid) from public, anon, service_role;
grant execute on function public.crm_team(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Exclusão LGPD: a nota sai junto
-- ─────────────────────────────────────────────────────────────
-- Corpo de 20261103120000_message_transcripts, com o bloco do CRM no fim.
-- Mesma assinatura: `create or replace` mantém os grants. A oportunidade
-- fica com etapa, datas e valor, para o funil histórico não mudar.
create or replace function public.anonymize_patient(p_patient_id uuid, p_phone_marker text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_total integer;
begin
  if p_phone_marker is null or p_phone_marker !~ '^\+999[0-9]{11}$' then
    raise exception 'Marcador de telefone fora do formato de anonimização.'
      using errcode = '22023';
  end if;

  -- A trava serializa com a gravação de mensagem (for share em
  -- register_whatsapp_message), com a da transcrição
  -- (save_message_transcript) e com a da nota do CRM
  -- (update_opportunity_details): nada entra no meio.
  select p.clinic_id into v_clinic_id
  from public.patients p
  where p.id = p_patient_id
  for update;

  if v_clinic_id is null or not private.is_clinic_owner(v_clinic_id) then
    raise exception 'Apenas o owner da clínica do paciente atende o pedido de exclusão.'
      using errcode = '42501';
  end if;

  update public.patients p
     set whatsapp_phone_number = p_phone_marker,
         name = null,
         consent_given_at = null,
         -- Nenhuma sequência futura o alcança.
         opted_out = true,
         -- Idempotente: o segundo pedido não recarimba.
         anonymized_at = coalesce(p.anonymized_at, now())
   where p.id = p_patient_id
     and p.clinic_id = v_clinic_id;

  update public.messages m
     set content_encrypted = null,
         transcript_encrypted = null,
         content_redacted_at = now()
    from public.conversations c
   where c.id = m.conversation_id
     and c.clinic_id = v_clinic_id
     and c.patient_id = p_patient_id
     and m.clinic_id = v_clinic_id
     and m.content_redacted_at is null;

  get diagnostics v_total = row_count;

  -- CRM: a nota da oportunidade (crm-v1). Etapa, datas e valor ficam.
  update public.opportunities o
     set notes_encrypted = null,
         notes_redacted_at = now()
   where o.clinic_id = v_clinic_id
     and o.patient_id = p_patient_id
     and o.notes_redacted_at is null;

  return v_total;
end;
$$;

reset lock_timeout;
```

> **Correção na execução (rodada 1):** (I1) update_opportunity_details trava o paciente (`for share`) e depois a oportunidade (`for update`), relê a etapa e só então valida e grava; em Ganho, procedimento nulo vira `invalido`; (I2) nota fora do formato cifrado devolve `invalido` com a mesma expressão do check da coluna; (M1) lock_timeout; (M3) `p_from`/`p_to` nulo vira `invalido`; (M4) `crm_team` com `(select private.can_operate_crm(...))`. (Rodada 2) em Ganho, `invalido` se o valor é nulo, ou se p_procedure_id é nulo E o procedimento atual (relido no `for update`) não é nulo; assim o formulário velho não apaga o procedimento, e o Ganho com procedimento apagado pela FK segue editável.

Antes do passo 4, confira que o corpo acima é o atual, campo a campo:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/bbfjwsrxastqpvbudhmc/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select pg_get_functiondef('"'"'public.anonymize_patient(uuid, text)'"'"'::regprocedure)"}'
```

Se o banco tiver algo que o corpo acima não tem, pare e acrescente (nunca tire o que já existe).

- [ ] **Passo 4: `--dry-run` e aprovação do Jhones** (como na Tarefa 1). Esperado: só `20261103160000_crm_actions.sql`. A troca de `anonymize_patient` é alteração de função existente: diga isso explicitamente no pedido de aprovação.

- [ ] **Passo 5: aplicar**: `npx supabase db push --remote -p "$SUPABASE_DB_PASSWORD" --yes`

- [ ] **Passo 6: rodar e ver passar**

Run: `npx vitest run tests/rls/crm-acoes.test.ts tests/rls/crm-automacao.test.ts tests/rls/patients.test.ts tests/rls/transcricao.test.ts`
Esperado: PASS (os dois últimos cobrem o `anonymize_patient` de antes).

- [ ] **Passo 7: commit**

```bash
git add supabase/migrations/20261103160000_crm_actions.sql tests/rls/crm-acoes.test.ts
git commit -m "feat(crm): mover, editar, buscar e equipe por RPC; exclusão LGPD apaga a nota"
```

---

### Tarefa 3: Regras puras novas e as decisões do Jhones

**Arquivos:**
- Modificar: `lib/billing/plan-limits.ts`, `lib/crm/cartao.ts`, `lib/crm/movimento.ts`, `lib/formatters/data.ts`, `components/crm/cartao-da-oportunidade.tsx`
- Criar: `lib/crm/acesso.ts`, `lib/crm/ids.ts`, `lib/crm/equipe.ts`, `lib/crm/detalhes.ts`
- Teste: `lib/crm/cartao.test.ts`, `lib/crm/movimento.test.ts`, `lib/crm/regras-da-parte-2.test.ts`, `lib/crm/detalhes.test.ts`, `lib/formatters/data-hora-local.test.ts`, `components/crm/componentes.test.tsx`

**Interfaces:**
- Consome: `podeAcessar(role, rota)` de `lib/navigation/acesso`; `ClinicPlan` e `PLANOS` de `lib/agent-config/schema`; `chaveDoDia`, `diasEntre`, `partesDaData`, `FUSO_PADRAO` de `lib/formatters/data`; `lerValorEmCentavos`, `VALOR_MAXIMO_CENTAVOS` de `lib/crm/movimento`.
- Produz:
  - `TEM_CRM: Record<ClinicPlan, boolean>`;
  - `ROTA_DO_CRM = "/dashboard/crm"`, `type AcessoAoCrm = "liberado" | "sem-papel" | "sem-plano"`, `acessoAoCrm(role: ClinicRole, plano: ClinicPlan): AcessoAoCrm`;
  - `ehIdDoBanco(id: string): boolean`;
  - `nomeDoMembro(email: string | null): string`;
  - `qualificadaPelaIa(op: Oportunidade): boolean` (substitui `ultimaMudancaAutomatica`);
  - `atividadeDoCartao` com dias de calendário;
  - `lerPedidoDeMovimento(v: unknown): PedidoDeMovimento | null`, `lerResultadoDoMovimento(v: unknown): ResultadoDoMovimento`;
  - `instanteDaDataHoraLocal(valor: string, fuso?): string | null`, `dataHoraLocal(instante, fuso?): string`;
  - `TAMANHO_MAXIMO_DA_NOTA = 2000`, `type DetalhesDaOportunidade`, `type CamposDosDetalhes`, `lerDetalhes(c): LeituraDosDetalhes`, `type ResultadoDosDetalhes = "ok" | "nao-encontrada" | "invalido"`, `lerResultadoDosDetalhes(v)`, `mensagemDosDetalhes(r)`.

- [ ] **Passo 1: ajustar `lib/crm/cartao.test.ts`** às decisões (troque o import e os dois `describe`):

```ts
import { atividadeDoCartao, nomeDoPaciente, qualificadaPelaIa, tituloDoEvento } from "./cartao"
```

```ts
describe("atividadeDoCartao", () => {
  it("a próxima ação vem primeiro", () => {
    expect(atividadeDoCartao(op({ proximaAcao: "2026-09-29T10:00:00-03:00", ultimaAtividade: "2026-09-01T10:00:00-03:00" }), AGORA)).toEqual({
      tipo: "proxima-acao",
      em: "2026-09-29T10:00:00-03:00",
    })
  })
  it("hoje é o mesmo dia de calendário em São Paulo", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-28T00:05:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
  it("ontem à noite já é parado há 1 dia, mesmo com menos de 24 h", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T23:00:00-03:00" }), "2026-09-28T08:00:00-03:00")).toEqual({
      tipo: "parado",
      dias: 1,
      alerta: false,
    })
  })
  it("o dia é o de São Paulo, não o de UTC", () => {
    // 20h de 27/09 em São Paulo ainda é 27/09 em UTC (23h); 22h30 já é 28/09 em UTC.
    // Pelo dia de UTC seria "parado há 1 dia"; pelo de São Paulo, é hoje.
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T20:00:00-03:00" }), "2026-09-27T22:30:00-03:00")).toEqual({ tipo: "hoje" })
  })
  it("parado: alerta a partir de 3 dias", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-26T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 2, alerta: false })
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-25T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 3, alerta: true })
  })
  it("atividade no futuro (relógio adiantado) conta como hoje", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-29T10:00:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
})

describe("qualificadaPelaIa", () => {
  const ABERTURA = { id: "e1", de: null, para: "novo" as const, em: AGORA, autor: null }
  const QUALIFICACAO = { id: "e2", de: "novo" as const, para: "qualificado" as const, em: AGORA, autor: null }
  it("o selo vale quando o último evento é a qualificação automática", () => {
    expect(qualificadaPelaIa(op({ etapa: "qualificado", eventos: [ABERTURA, QUALIFICACAO] }))).toBe(true)
  })
  it("abrir pela primeira mensagem não é decisão da IA", () => {
    expect(qualificadaPelaIa(op({ eventos: [ABERTURA] }))).toBe(false)
  })
  it("a equipe qualificar à mão não dá o selo; mover depois da IA tira o selo", () => {
    expect(qualificadaPelaIa(op({ etapa: "qualificado", eventos: [ABERTURA, { ...QUALIFICACAO, autor: CARLA }] }))).toBe(false)
    const movida = op({ etapa: "agendado", eventos: [ABERTURA, QUALIFICACAO, { id: "e3", de: "qualificado", para: "agendado", em: AGORA, autor: CARLA }] })
    expect(qualificadaPelaIa(movida)).toBe(false)
  })
})
```

- [ ] **Passo 2: escrever `lib/crm/regras-da-parte-2.test.ts`**:

```ts
import { describe, expect, it } from "vitest"
import { TEM_CRM } from "@/lib/billing/plan-limits"
import { acessoAoCrm } from "./acesso"
import { nomeDoMembro } from "./equipe"
import { ehIdDoBanco } from "./ids"

describe("TEM_CRM", () => {
  it("Pro e HealthTech, não Starter (a régua da integração com CRM no site)", () => {
    expect(TEM_CRM).toEqual({ starter: false, pro: true, healthtech: true })
  })
})

describe("acessoAoCrm", () => {
  it("owner e staff de Pro ou HealthTech: liberado", () => {
    for (const role of ["owner", "staff"] as const)
      for (const plano of ["pro", "healthtech"] as const) expect(acessoAoCrm(role, plano)).toBe("liberado")
  })
  it("Starter: sem-plano (vê o convite)", () => {
    expect(acessoAoCrm("owner", "starter")).toBe("sem-plano")
    expect(acessoAoCrm("staff", "starter")).toBe("sem-plano")
  })
  it("profissional: sem-papel, em qualquer plano (o papel vem antes do plano)", () => {
    for (const plano of ["starter", "pro", "healthtech"] as const) expect(acessoAoCrm("professional", plano)).toBe("sem-papel")
  })
})

describe("ehIdDoBanco", () => {
  it("uuid é do banco; o id da fixture não é", () => {
    expect(ehIdDoBanco("4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192")).toBe(true)
    expect(ehIdDoBanco("op-08")).toBe(false)
    expect(ehIdDoBanco("")).toBe(false)
  })
})

describe("nomeDoMembro", () => {
  it("a parte do e-mail antes do @, em palavras com inicial maiúscula", () => {
    expect(nomeDoMembro("marina.souza@clinica.com.br")).toBe("Marina Souza")
    expect(nomeDoMembro("joao_pedro+crm@x.com")).toBe("Joao Pedro Crm")
    expect(nomeDoMembro("ana@x.com")).toBe("Ana")
  })
  it("sem e-mail: Equipe", () => {
    expect(nomeDoMembro(null)).toBe("Equipe")
    expect(nomeDoMembro("@x.com")).toBe("Equipe")
  })
})
```

- [ ] **Passo 3: acrescentar a `lib/crm/movimento.test.ts`**:

```ts
import { lerPedidoDeMovimento, lerResultadoDoMovimento } from "./movimento"

describe("lerPedidoDeMovimento (o que chega do navegador)", () => {
  const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
  it("aceita o pedido bem formado", () => {
    expect(lerPedidoDeMovimento({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ oportunidadeId: ID, de: "novo", para: "agendado" })
    const ganho = { oportunidadeId: ID, de: "compareceu", para: "ganho", procedimento: { id: ID, nome: "Implante" }, valorCentavos: 350000 }
    expect(lerPedidoDeMovimento(ganho)).toEqual(ganho)
  })
  it("recusa etapa fora da lista, id que não é uuid, motivo fora da lista e lixo", () => {
    for (const v of [
      { oportunidadeId: ID, de: "novo", para: "fechado" },
      { oportunidadeId: ID, de: "aberto", para: "novo" },
      { oportunidadeId: "op-01", de: "novo", para: "agendado" },
      { oportunidadeId: ID, de: "novo", para: "perdido", motivo: "caro demais" },
      { oportunidadeId: ID, de: "novo", para: "ganho", valorCentavos: 10.5 },
      null,
      "novo",
    ]) {
      expect(lerPedidoDeMovimento(v), JSON.stringify(v)).toBeNull()
    }
  })
})

describe("lerResultadoDoMovimento (o que a RPC devolve)", () => {
  it("traduz os quatro resultados", () => {
    expect(lerResultadoDoMovimento("ok")).toEqual({ status: "ok" })
    expect(lerResultadoDoMovimento("sem-mudanca")).toEqual({ status: "sem-mudanca" })
    expect(lerResultadoDoMovimento("nao-encontrada")).toEqual({ status: "nao-encontrada" })
    expect(lerResultadoDoMovimento("invalido")).toEqual({ status: "invalido", erro: "Confira o procedimento, o valor ou o motivo e tente de novo." })
  })
  it("fora da lista é defeito nosso: lança", () => {
    expect(() => lerResultadoDoMovimento("talvez")).toThrow("Resultado desconhecido da mudança de etapa.")
  })
})
```

- [ ] **Passo 4: escrever `lib/formatters/data-hora-local.test.ts`**:

```ts
import { describe, expect, it } from "vitest"
import { dataHoraLocal, instanteDaDataHoraLocal } from "./data"

describe("instanteDaDataHoraLocal (o campo datetime-local, lido em São Paulo)", () => {
  it("converte para o instante UTC", () => {
    expect(instanteDaDataHoraLocal("2026-11-05T10:30")).toBe("2026-11-05T13:30:00.000Z")
  })
  it("respeita outro fuso", () => {
    expect(instanteDaDataHoraLocal("2026-07-01T09:00", "Europe/Lisbon")).toBe("2026-07-01T08:00:00.000Z")
  })
  it("recusa formato e data inválidos", () => {
    for (const v of ["", "2026-11-05", "2026-02-30T10:00", "2026-11-05T24:00", "05/11/2026 10:30"]) {
      expect(instanteDaDataHoraLocal(v), v).toBeNull()
    }
  })
})

describe("dataHoraLocal (o valor inicial do campo)", () => {
  it("é o inverso de instanteDaDataHoraLocal", () => {
    expect(dataHoraLocal("2026-11-05T13:30:00.000Z")).toBe("2026-11-05T10:30")
    expect(instanteDaDataHoraLocal(dataHoraLocal("2026-11-05T13:30:00.000Z"))).toBe("2026-11-05T13:30:00.000Z")
  })
})
```

- [ ] **Passo 5: escrever `lib/crm/detalhes.test.ts`**:

```ts
import { describe, expect, it } from "vitest"
import { formatarMoeda } from "@/lib/formatters/numero"
import { lerDetalhes, lerResultadoDosDetalhes, mensagemDosDetalhes, TAMANHO_MAXIMO_DA_NOTA, type CamposDosDetalhes } from "./detalhes"
import { lerValorEmCentavos } from "./movimento"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const OUTRO = "0b7a4c3e-2d5e-4f70-8192-4f1c2b6e9a1d"

const campos = (c: Partial<CamposDosDetalhes> = {}): CamposDosDetalhes => ({
  oportunidade: ID,
  procedimento: "",
  valor: "",
  responsavel: "",
  proxima_acao: "",
  nota: "",
  ...c,
})

describe("lerDetalhes", () => {
  it("campos vazios viram null", () => {
    expect(lerDetalhes(campos())).toEqual({
      detalhes: { oportunidadeId: ID, procedimentoId: null, valorCentavos: null, responsavelId: null, proximaAcao: null, nota: null },
      erro: null,
    })
  })

  it("lê procedimento, valor, responsável, próxima ação e nota", () => {
    const r = lerDetalhes(campos({ procedimento: ID, valor: "1.200,50", responsavel: OUTRO, proxima_acao: "2026-11-05T10:30", nota: "  Prefere manhã  " }))
    expect(r.detalhes).toEqual({
      oportunidadeId: ID,
      procedimentoId: ID,
      valorCentavos: 120050,
      responsavelId: OUTRO,
      proximaAcao: "2026-11-05T13:30:00.000Z",
      nota: "Prefere manhã",
    })
  })

  it("o valor mostrado pela tela (formatarMoeda) volta igual", () => {
    expect(lerValorEmCentavos(formatarMoeda(120050))).toBe(120050)
    expect(lerDetalhes(campos({ valor: formatarMoeda(120050) })).detalhes?.valorCentavos).toBe(120050)
  })

  it("recusa o que não é da lista ou do formato, sem repetir o valor na mensagem", () => {
    const casos: [Partial<CamposDosDetalhes>, string][] = [
      [{ oportunidade: "op-1" }, "Oportunidade não encontrada."],
      [{ procedimento: "proc-x" }, "Escolha um procedimento da lista."],
      [{ responsavel: "alguem" }, "Escolha alguém da equipe."],
      [{ valor: "doze reais" }, "Informe o valor em reais, como 1.200,00."],
      [{ valor: "0" }, "Informe o valor em reais, como 1.200,00."],
      [{ proxima_acao: "amanhã" }, "Data da próxima ação inválida."],
      [{ nota: "x".repeat(TAMANHO_MAXIMO_DA_NOTA + 1) }, `A nota passa de ${TAMANHO_MAXIMO_DA_NOTA} caracteres.`],
    ]
    for (const [c, erro] of casos) expect(lerDetalhes(campos(c)), JSON.stringify(c).slice(0, 60)).toEqual({ detalhes: null, erro })
  })

  it("campo que não é texto (arquivo no FormData) conta como vazio", () => {
    expect(lerDetalhes(campos({ nota: null, valor: null })).detalhes?.nota).toBeNull()
  })
})

describe("resultado da RPC de detalhes", () => {
  it("traduz e explica", () => {
    expect(lerResultadoDosDetalhes("ok")).toBe("ok")
    expect(mensagemDosDetalhes("ok")).toBeNull()
    expect(mensagemDosDetalhes("nao-encontrada")).toBe("Oportunidade não encontrada.")
    expect(mensagemDosDetalhes("invalido")).toBe("Confira o procedimento, o valor e o responsável. Ganho não fica sem valor.")
    expect(() => lerResultadoDosDetalhes("x")).toThrow("Resultado desconhecido da edição da oportunidade.")
  })
})
```

- [ ] **Passo 6: no `components/crm/componentes.test.tsx`**, o caso que espera `>IA<` (linha ~64) passa a ter a qualificação automática no fim da trilha. Troque a linha `eventos: [{ id: "e1", de: null, para: "novo", em: AGORA, autor: null }],` desse caso por:

```ts
          etapa: "qualificado",
          eventos: [
            { id: "e1", de: null, para: "novo", em: AGORA, autor: null },
            { id: "e2", de: "novo", para: "qualificado", em: AGORA, autor: null },
          ],
```

e acrescente, logo depois desse `it`, o caso de Novo sem selo:

```ts
  it("cartão em Novo, aberto pela primeira mensagem, não tem o selo IA", () => {
    const h = renderToStaticMarkup(<CartaoDaOportunidade op={op()} agora={AGORA} aoAbrir={nada} />)
    expect(h).not.toContain(">IA<")
  })
```

(Use os mesmos nomes de helper do arquivo: confira `op`, `nada` e `CartaoDaOportunidade` no topo dele.)

- [ ] **Passo 7: rodar e ver falhar**

Run: `npx vitest run lib/crm lib/formatters components/crm`
Esperado: FAIL (módulos e funções novos não existem; `qualificadaPelaIa` não exportada).

- [ ] **Passo 8: implementar.** Em `lib/billing/plan-limits.ts`, acrescente:

```ts
/**
 * O CRM próprio (spec crm-v1, decisão 4): Pro e HealthTech, a mesma régua
 * da "Integração total no CRM" do site. O dado é gravado em todo plano; só
 * a tela e as ações exigem o plano. Espelho de `private.clinic_has_crm`.
 */
export const TEM_CRM: Record<ClinicPlan, boolean> = {
  starter: false,
  pro: true,
  healthtech: true,
}
```

`lib/crm/acesso.ts`:

```ts
import type { ClinicPlan } from "@/lib/agent-config/schema"
import type { ClinicRole } from "@/lib/auth/context"
import { TEM_CRM } from "@/lib/billing/plan-limits"
import { podeAcessar } from "@/lib/navigation/acesso"

export const ROTA_DO_CRM = "/dashboard/crm"

export type AcessoAoCrm = "liberado" | "sem-papel" | "sem-plano"

/**
 * Quem usa o CRM (spec crm-v1, seção 4). O papel vem antes do plano: o
 * profissional vê a permissão negada, e não o convite. É a trava da página,
 * das server actions e da lib; o banco repete as duas (RLS e RPCs).
 */
export function acessoAoCrm(role: ClinicRole, plano: ClinicPlan): AcessoAoCrm {
  if (!podeAcessar(role, ROTA_DO_CRM)) return "sem-papel"
  return TEM_CRM[plano] ? "liberado" : "sem-plano"
}
```

`lib/crm/ids.ts`:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Na demonstração, a tela junta oportunidades reais e de exemplo. O id diz
 * de onde vem: uuid é do banco (grava pelas ações); o resto é fixture (só
 * no navegador), como em Conversas.
 */
export function ehIdDoBanco(id: string): boolean {
  return UUID.test(id)
}
```

`lib/crm/equipe.ts`:

```ts
/**
 * O nome que a tela mostra de um membro da equipe. O painel ainda não tem
 * nome de membro, só o e-mail do Auth: a parte antes do @, em palavras.
 * "marina.souza@…" vira "Marina Souza", e a linha do tempo diz "Marina moveu".
 */
export function nomeDoMembro(email: string | null): string {
  const local = email?.split("@")[0] ?? ""
  const palavras = local.split(/[._+-]+/).filter(Boolean)
  if (palavras.length === 0) return "Equipe"
  return palavras.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")
}
```

Em `lib/crm/cartao.ts`, troque `ultimaMudancaAutomatica` e o cálculo de dias:

```ts
import { chaveDoDia, diasEntre } from "@/lib/formatters/data"
```

```ts
export function atividadeDoCartao(op: Oportunidade, agora: string): AtividadeDoCartao {
  if (op.proximaAcao) return { tipo: "proxima-acao", em: op.proximaAcao }
  // Dia de calendário no fuso de São Paulo (decisão do Jhones, 2026-11-03):
  // ontem às 23h, às 8h de hoje, já é "parado há 1 dia".
  const dias = Math.max(0, diasEntre(chaveDoDia(op.ultimaAtividade), chaveDoDia(agora)))
  if (dias === 0) return { tipo: "hoje" }
  return { tipo: "parado", dias, alerta: dias >= DIAS_PARA_ALERTA }
}

/**
 * O selo IA (decisão do Jhones, 2026-11-03): só quando a última mudança foi
 * a qualificação automática. Abrir pela primeira mensagem não é decisão da
 * IA, e o selo em toda a coluna Novo seria ruído.
 */
export function qualificadaPelaIa(op: Oportunidade): boolean {
  const ultimo = op.eventos.at(-1)
  return ultimo !== undefined && ultimo.autor === null && ultimo.de === "novo" && ultimo.para === "qualificado"
}
```

Remova o import de `DIA_MS` se ficar sem uso. Em `components/crm/cartao-da-oportunidade.tsx`, troque `ultimaMudancaAutomatica` por `qualificadaPelaIa` no import e nas duas chamadas (linhas ~4, 58 e 60).

Em `lib/formatters/data.ts`, depois de `chaveDoDia`:

```ts
const DATA_HORA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * O valor de um `<input type="datetime-local">` ("2026-11-05T10:30"), lido
 * no fuso, como instante ISO em UTC. `null` se não for uma data e hora
 * válidas. O deslocamento é o do fuso naquele instante, sem supor -03:00.
 */
export function instanteDaDataHoraLocal(valor: string, fuso = FUSO_PADRAO): string | null {
  const m = DATA_HORA_LOCAL.exec(valor)
  if (!m) return null
  const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number)
  if (hora > 23 || minuto > 59) return null
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto)
  const d = new Date(comoUtc)
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  const p = partesDaData(d, fuso)
  const deslocamento = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - comoUtc
  return new Date(comoUtc - deslocamento).toISOString()
}

/** O valor inicial de um `datetime-local` para um instante, no fuso. */
export function dataHoraLocal(instante: Date | string, fuso = FUSO_PADRAO): string {
  const p = partesDaData(instante, fuso)
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}`
}
```

Em `lib/crm/movimento.ts`, acrescente (com `import { z } from "zod"` e `ehEtapa` no import de `./tipos`):

```ts
const PEDIDO = z.object({
  oportunidadeId: z.string().uuid(),
  de: z.string().refine(ehEtapa),
  para: z.string().refine(ehEtapa),
  procedimento: z.object({ id: z.string().uuid(), nome: z.string().max(200) }).nullish(),
  valorCentavos: z.number().int().nullish(),
  motivo: z.string().refine(ehMotivoDePerda).nullish(),
})

/**
 * O pedido de movimento que chega do navegador numa server action: input
 * não confiável. `de` e `para` precisam ser etapas da lista (`ehEtapa`), o
 * id um uuid e o motivo um da lista. Os campos de Ganho e Perdido são
 * conferidos pela RPC, que devolve `invalido`.
 */
export function lerPedidoDeMovimento(v: unknown): PedidoDeMovimento | null {
  const r = PEDIDO.safeParse(v)
  return r.success ? (r.data as PedidoDeMovimento) : null
}

/** O texto que a RPC `move_opportunity` devolve. Fora da lista é defeito nosso. */
export function lerResultadoDoMovimento(v: unknown): ResultadoDoMovimento {
  switch (v) {
    case "ok":
    case "sem-mudanca":
    case "nao-encontrada":
      return { status: v }
    case "invalido":
      return invalido("Confira o procedimento, o valor ou o motivo e tente de novo.")
  }
  throw new Error("Resultado desconhecido da mudança de etapa.")
}
```

(O `toEqual` do passo 3 compara o pedido lido com o enviado: o zod descarta chaves desconhecidas e mantém as conhecidas. Se o zod do projeto devolver `undefined` explícito para as opcionais ausentes, o `toEqual` ainda passa.)

`lib/crm/detalhes.ts`:

```ts
import { z } from "zod"
import { instanteDaDataHoraLocal } from "@/lib/formatters/data"
import { lerValorEmCentavos, VALOR_MAXIMO_CENTAVOS } from "./movimento"

/**
 * Os campos que a equipe edita na oportunidade (spec crm-v1, "Os outros
 * campos"): procedimento, valor, responsável, próxima ação e nota. A nota
 * nunca aparece em mensagem de erro (lgpd-security, regra 1).
 */

export const TAMANHO_MAXIMO_DA_NOTA = 2000

export type DetalhesDaOportunidade = {
  oportunidadeId: string
  procedimentoId: string | null
  valorCentavos: number | null
  responsavelId: string | null
  /** Instante ISO (UTC). */
  proximaAcao: string | null
  /** Texto claro: a lib cifra antes de gravar. */
  nota: string | null
}

/** Os campos como chegam do FormData (`form.get`). */
export type CamposDosDetalhes = Record<
  "oportunidade" | "procedimento" | "valor" | "responsavel" | "proxima_acao" | "nota",
  FormDataEntryValue | null
>

export type LeituraDosDetalhes = { detalhes: DetalhesDaOportunidade; erro: null } | { detalhes: null; erro: string }

const UUID = z.string().uuid()
const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "")
const falha = (erro: string): LeituraDosDetalhes => ({ detalhes: null, erro })

export function lerDetalhes(c: CamposDosDetalhes): LeituraDosDetalhes {
  const id = texto(c.oportunidade)
  if (!UUID.safeParse(id).success) return falha("Oportunidade não encontrada.")

  const procedimento = texto(c.procedimento)
  if (procedimento && !UUID.safeParse(procedimento).success) return falha("Escolha um procedimento da lista.")

  const responsavel = texto(c.responsavel)
  if (responsavel && !UUID.safeParse(responsavel).success) return falha("Escolha alguém da equipe.")

  let valorCentavos: number | null = null
  const valor = texto(c.valor)
  if (valor) {
    valorCentavos = lerValorEmCentavos(valor)
    if (valorCentavos === null || valorCentavos <= 0 || valorCentavos > VALOR_MAXIMO_CENTAVOS) {
      return falha("Informe o valor em reais, como 1.200,00.")
    }
  }

  let proximaAcao: string | null = null
  const quando = texto(c.proxima_acao)
  if (quando) {
    proximaAcao = instanteDaDataHoraLocal(quando)
    if (!proximaAcao) return falha("Data da próxima ação inválida.")
  }

  const nota = texto(c.nota)
  if (nota.length > TAMANHO_MAXIMO_DA_NOTA) return falha(`A nota passa de ${TAMANHO_MAXIMO_DA_NOTA} caracteres.`)

  return {
    detalhes: {
      oportunidadeId: id,
      procedimentoId: procedimento || null,
      valorCentavos,
      responsavelId: responsavel || null,
      proximaAcao,
      nota: nota || null,
    },
    erro: null,
  }
}

export type ResultadoDosDetalhes = "ok" | "nao-encontrada" | "invalido"

export function lerResultadoDosDetalhes(v: unknown): ResultadoDosDetalhes {
  if (v === "ok" || v === "nao-encontrada" || v === "invalido") return v
  throw new Error("Resultado desconhecido da edição da oportunidade.")
}

export function mensagemDosDetalhes(r: ResultadoDosDetalhes): string | null {
  switch (r) {
    case "ok":
      return null
    case "nao-encontrada":
      return "Oportunidade não encontrada."
    case "invalido":
      return "Confira o procedimento, o valor e o responsável. Ganho não fica sem valor."
  }
}
```

- [ ] **Passo 9: rodar e ver passar**

Run: `npx vitest run lib/crm lib/formatters lib/billing components/crm app/_fixtures tests/demo`
Esperado: PASS. Se um teste de fixture ou de tela dependia de "hoje" em 24 h, ajuste a data do caso para o dia de calendário certo (e não a regra).

- [ ] **Passo 10: commit**

```bash
git add lib/billing/plan-limits.ts lib/crm lib/formatters components/crm/cartao-da-oportunidade.tsx components/crm/componentes.test.tsx
git commit -m "feat(crm): regras da parte 2 (acesso por plano, pedido, detalhes) e decisões do selo IA e do dia"
```

---

### Tarefa 4: Plano na sessão e o CRM no menu com o selo "Pro"

**Arquivos:**
- Modificar: `lib/auth/context.ts`, `lib/navigation/schema.ts`, `lib/navigation/dashboard-nav.ts`, `components/shell/painel.ts`, `components/shell/app-sidebar.tsx`, `app/(dashboard)/layout.tsx`
- Teste: `tests/auth/context.test.ts`, `lib/navigation/navigation.test.ts`, `components/shell/painel.test.ts`

**Interfaces:**
- Consome: `ClinicPlan`, `PLANOS`, `ROTULO_DO_PLANO` de `lib/agent-config/schema`.
- Produz: `ClinicContext.plan: ClinicPlan` (Starter quando a resposta não traz plano conhecido); `NavItem.planos?: readonly ClinicPlan[]`; `ResolvedNavItem.selo?: string`; `resolveDashboardNav(role, pathname, { demo?, plano?, grupos? })`; `Painel` da clínica com `plano?: ClinicPlan`; `shellDaClinica(role, demo, plano?)`. O item CRM ganha `planos: ["pro", "healthtech"]` e **continua `status: "em-breve"` nesta tarefa**: a página ainda responde 404 fora da demonstração, e `tests/architecture/rotas.test.ts` exige as duas coisas juntas. A Tarefa 6 troca para `"pronto"` junto com a página real, para cada commit ficar verde.

- [ ] **Passo 1: escrever os testes.** Em `tests/auth/context.test.ts`, troque a expectativa do `select` (linha ~268) por `"clinic_id, role, clinics(is_demo, plan)"` e acrescente, junto dos casos de `is_demo`:

```ts
  it("o plano vem da mesma consulta do vínculo", async () => {
    mockMembership({ clinic_id: "clinic-1", role: "owner", clinics: { is_demo: false, plan: "pro" } })
    expect((await requireClinicContext()).plan).toBe("pro")
  })

  it("sem plano conhecido na resposta, a clínica conta como Starter (falha fechada)", async () => {
    for (const clinics of [null, { is_demo: false }, { is_demo: false, plan: "enterprise" }]) {
      mockMembership({ clinic_id: "clinic-1", role: "owner", clinics })
      expect((await requireClinicContext()).plan).toBe("starter")
    }
  })
```

(Siga o preparo de sessão dos casos vizinhos de `is_demo`: se eles chamam algo antes de `mockMembership`, como `mockGetClaims.mockResolvedValue(...)`, repita aqui.)

Em `lib/navigation/navigation.test.ts`, acrescente:

```ts
describe("CRM e o plano", () => {
  const crm = (plano?: "starter" | "pro" | "healthtech") =>
    resolveDashboardNav("owner", "/dashboard/crm", { plano })
      .flatMap((g) => g.items)
      .find((i) => i.href === "/dashboard/crm")

  it("no Starter, aparece com o selo Pro", () => {
    expect(crm("starter")?.selo).toBe("Pro")
  })
  it("no Pro e no HealthTech, sem selo", () => {
    expect(crm("pro")?.selo).toBeUndefined()
    expect(crm("healthtech")?.selo).toBeUndefined()
  })
  it("sem plano informado (painel interno, chamadas antigas), sem selo", () => {
    expect(crm()?.selo).toBeUndefined()
  })
  it("item sem planos nunca tem selo", () => {
    const itens = resolveDashboardNav("owner", "/dashboard", { plano: "starter" }).flatMap((g) => g.items)
    expect(itens.filter((i) => i.href !== "/dashboard/crm").every((i) => i.selo === undefined)).toBe(true)
  })
  it("o profissional não vê o item", () => {
    const itens = resolveDashboardNav("professional", "/dashboard", { plano: "pro" }).flatMap((g) => g.items)
    expect(itens.map((i) => i.href)).not.toContain("/dashboard/crm")
  })
})
```

Em `components/shell/painel.test.ts`, acrescente:

```ts
  it("o plano chega ao menu: CRM com selo Pro no Starter", () => {
    const { painel } = shellDaClinica("owner", false, "starter")
    const crm = gruposDoPainel(painel, "/dashboard").flatMap((g) => g.items).find((i) => i.href === "/dashboard/crm")
    expect(crm?.selo).toBe("Pro")
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run tests/auth/context.test.ts lib/navigation components/shell`
Esperado: FAIL (`plan` indefinido; sem `selo`).

- [ ] **Passo 3: implementar.** `lib/auth/context.ts`:

```ts
import { PLANOS, type ClinicPlan } from "@/lib/agent-config/schema"
```

(Se esse import criar ciclo — `lib/agent-config/schema.ts` importa de `lib/auth/context` em valor, e não só em tipo —, mova `PLANOS` e `ClinicPlan` para `lib/billing/planos.ts`, reexporte de `lib/agent-config/schema.ts` e importe daqui de `lib/billing/planos`.)

No tipo `ClinicContext`, depois de `isDemo`:

```ts
  /**
   * O plano da clínica (`clinics.plan`), na mesma consulta do vínculo. Decide
   * telas e ações por plano (CRM). Sem plano conhecido, Starter: falha fechada.
   */
  plan: ClinicPlan
```

Em `resolverVinculo`:

```ts
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id, role, clinics(is_demo, plan)")
    .eq("user_id", identidade.id)
    .limit(1)
    .maybeSingle()
```

```ts
  const clinica = membership.clinics as { is_demo?: boolean; plan?: string } | null
  const plano = clinica?.plan
```

```ts
    isDemo: clinica?.is_demo === true,
    plan: (PLANOS as readonly string[]).includes(plano ?? "") ? (plano as ClinicPlan) : "starter",
```

`lib/navigation/schema.ts`, em `NavItem`:

```ts
  /**
   * Planos que usam a tela. Ausente = todos. Fora deles, o item continua no
   * menu (a tela abre o convite) com o selo do primeiro plano da lista.
   */
  planos?: readonly ClinicPlan[]
```

e em `ResolvedNavItem`:

```ts
  /** "Pro": o plano da clínica não tem a tela; ela abre o convite. */
  selo?: string
```

(com `import type { ClinicPlan } from "@/lib/agent-config/schema"`, ou de `lib/billing/planos` se o passo acima mudou o lugar.)

`lib/navigation/dashboard-nav.ts`, o item (ainda "em-breve"; a Tarefa 6 troca):

```ts
      {
        // spec crm-v1. Pro e HealthTech; no Starter, o selo "Pro" e o convite.
        label: "CRM",
        href: "/dashboard/crm",
        status: "em-breve",
        roles: ["owner", "staff"],
        planos: ["pro", "healthtech"],
      },
```

e `resolveDashboardNav`:

```ts
export function resolveDashboardNav(
  role: ClinicRole,
  pathname: string,
  {
    demo = false,
    plano,
    grupos = DASHBOARD_NAV,
  }: { demo?: boolean; plano?: ClinicPlan; grupos?: readonly NavGroup[] } = {},
): ResolvedNavGroup[] {
  const visiveis = grupos
    .map((grupo) => ({
      label: grupo.label,
      items: grupo.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({
          label: item.label,
          href: item.href,
          status: statusNoPainel(item, demo),
          ...seloDoPlano(item, plano),
        })),
    }))
    .filter((grupo) => grupo.items.length > 0)
```

(o resto da função não muda), com:

```ts
/** O selo do plano que falta. Sem plano informado (painel interno, testes antigos), sem selo. */
function seloDoPlano(item: NavItem, plano: ClinicPlan | undefined): { selo?: string } {
  if (!item.planos || !plano || item.planos.includes(plano)) return {}
  return { selo: ROTULO_DO_PLANO[item.planos[0]] }
}
```

`components/shell/painel.ts`:

```ts
export type Painel =
  | {
      tipo: "clinica"
      role: ClinicRole
      /** Conta de demonstração: todo item do menu abre, com o dado de exemplo. */
      demo: boolean
      /** O plano decide o selo dos itens que exigem plano (CRM). */
      plano?: ClinicPlan
    }
  | { tipo: "interno" }
```

```ts
    ? resolveDashboardNav(painel.role, pathname, { demo: painel.demo, plano: painel.plano })
```

```ts
export function shellDaClinica(role: ClinicRole, demo: boolean, plano?: ClinicPlan) {
  return {
    painel: { tipo: "clinica", role, demo, plano } satisfies Painel,
```

`app/(dashboard)/layout.tsx`: `shellDaClinica(ctx.role, ctx.isDemo, ctx.plan)`.

`components/shell/app-sidebar.tsx`, em `ItemPronto`, dentro do `<Link>`, depois do `<span>{item.label}</span>`:

```tsx
          {item.selo && (
            <span className="ml-auto rounded-pill border border-hairline px-1.5 text-[0.6875rem] text-ink-3 group-data-[collapsible=icon]:hidden">
              {item.selo}
            </span>
          )}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run tests/auth lib/navigation components/shell tests/architecture`
Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add lib/auth/context.ts lib/navigation components/shell "app/(dashboard)/layout.tsx" tests/auth/context.test.ts
git commit -m "feat(shell): plano da clínica na sessão e selo de plano no menu"
```

---

### Tarefa 5: Leitura e escrita no servidor (`lib/crm`)

**Arquivos:**
- Criar: `lib/crm/leitura.ts`, `lib/crm/queries.ts`, `lib/crm/mutations.ts`
- Teste: `lib/crm/leitura.test.ts` (montagem, pura), `lib/crm/servidor.test.ts` (trava, cifra, log, com mocks), `tests/crm/leitura.test.ts` (contra o banco)

**Interfaces:**
- Consome: as RPCs e tabelas das Tarefas 1 e 2; `acessoAoCrm`, `nomeDoMembro`, `lerResultadoDoMovimento`, `lerResultadoDosDetalhes`, `DetalhesDaOportunidade` (Tarefa 3); `ClinicContext.plan` (Tarefa 4); `padraoDeBusca` de `lib/conversations/busca`; `cifrarConteudo`/`decifrarConteudo` de `lib/conversations/conteudo`.
- Produz:
  - `leitura.ts`: `type Cliente`, `type LinhaDaOportunidade`, `type DadosDoCrm = { oportunidades: Oportunidade[]; procedimentos: Referencia[]; equipe: Referencia[] }`, `montarOportunidade(clinicId, linha, equipe: ReadonlyMap<string, Referencia>): Oportunidade`, `carregarCrmDaClinica(supabase, clinicId, agora): Promise<DadosDoCrm>`, `buscarIdsNoCrm(supabase, clinicId, termo): Promise<string[]>`;
  - `queries.ts`: `class SemAcessoAoCrm`, `carregarCrm(agora: string): Promise<DadosDoCrm>`, `buscarNoCrm(termo: string): Promise<string[]>`;
  - `mutations.ts`: `moverOportunidade(p: PedidoDeMovimento): Promise<ResultadoDoMovimento>`, `salvarDetalhes(d: DetalhesDaOportunidade): Promise<ResultadoDosDetalhes>`.

- [ ] **Passo 1: escrever `lib/crm/leitura.test.ts`** (montagem pura):

```ts
import { beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { montarOportunidade, type LinhaDaOportunidade } from "./leitura"

const CLINICA = "c-1"
const EM = "2026-11-03T12:00:00.000Z"

beforeAll(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64")
})

function linha(p: Partial<LinhaDaOportunidade> = {}): LinhaDaOportunidade {
  return {
    id: "op-1",
    conversation_id: "conv-1",
    stage: "qualificado",
    stage_changed_at: EM,
    last_activity_at: EM,
    opened_at: EM,
    closed_at: null,
    value_cents: 120050,
    owner_user_id: "u-1",
    next_action_at: null,
    lost_reason: null,
    notes_encrypted: null,
    patients: { id: "p-1", name: "Gertrudes", whatsapp_phone_number: "+5581999990000", opted_out: true },
    conversations: { is_urgent: true },
    procedures: { id: "proc-1", name: "Implante" },
    opportunity_events: [
      { id: "e2", from_stage: "novo", to_stage: "qualificado", actor_user_id: null, actor_email: null, created_at: "2026-11-03T11:00:00.000Z" },
      { id: "e1", from_stage: null, to_stage: "novo", actor_user_id: null, actor_email: null, created_at: "2026-11-03T10:00:00.000Z" },
    ],
    ...p,
  }
}

const EQUIPE = new Map([["u-1", { id: "u-1", nome: "Marina Souza" }]])

describe("montarOportunidade", () => {
  it("monta o tipo da tela, com a trilha do mais antigo para o mais novo", () => {
    const op = montarOportunidade(CLINICA, linha(), EQUIPE)
    expect(op).toMatchObject({
      id: "op-1",
      paciente: { id: "p-1", nome: "Gertrudes", telefone: "+5581999990000", optOut: true },
      conversaId: "conv-1",
      etapa: "qualificado",
      procedimento: { id: "proc-1", nome: "Implante" },
      valorCentavos: 120050,
      responsavel: { id: "u-1", nome: "Marina Souza" },
      urgente: true,
      nota: null,
      motivoDePerda: null,
    })
    expect(op.eventos.map((e) => e.id)).toEqual(["e1", "e2"])
    expect(op.eventos[0]).toEqual({ id: "e1", de: null, para: "novo", em: "2026-11-03T10:00:00.000Z", autor: null })
  })

  it("o autor do evento vem do e-mail copiado no momento", () => {
    const op = montarOportunidade(
      CLINICA,
      linha({ opportunity_events: [{ id: "e1", from_stage: "novo", to_stage: "agendado", actor_user_id: "u-9", actor_email: "carla.mendes@x.com", created_at: EM }] }),
      EQUIPE,
    )
    expect(op.eventos[0].autor).toEqual({ id: "u-9", nome: "Carla Mendes" })
  })

  it("decifra a nota com a clínica da linha", () => {
    const op = montarOportunidade(CLINICA, linha({ notes_encrypted: cifrarConteudo(CLINICA, "Prefere manhã") }), EQUIPE)
    expect(op.nota).toBe("Prefere manhã")
  })

  it("nota de outra clínica não decifra: lança, sem o texto na mensagem", () => {
    const blob = cifrarConteudo("outra", "Segredo da outra")
    expect(() => montarOportunidade(CLINICA, linha({ notes_encrypted: blob }), EQUIPE)).toThrow(/^(?!.*Segredo)/)
  })

  it("responsável fora do mapa da equipe aparece como Equipe; sem conversa e sem procedimento, nulos", () => {
    const op = montarOportunidade(CLINICA, linha({ owner_user_id: "u-x", conversations: null, procedures: null, conversation_id: null }), EQUIPE)
    expect(op.responsavel).toEqual({ id: "u-x", nome: "Equipe" })
    expect(op).toMatchObject({ conversaId: null, procedimento: null, urgente: false })
  })

  it("Perdido traz o motivo; etapa fora da lista ou sem paciente é defeito: lança sem dado", () => {
    expect(montarOportunidade(CLINICA, linha({ stage: "perdido", lost_reason: "preco", closed_at: EM }), EQUIPE).motivoDePerda).toBe("preco")
    expect(() => montarOportunidade(CLINICA, linha({ stage: "fechado" }), EQUIPE)).toThrow("Linha do CRM fora do formato esperado.")
    expect(() => montarOportunidade(CLINICA, linha({ patients: null }), EQUIPE)).toThrow("Linha do CRM fora do formato esperado.")
  })
})
```

- [ ] **Passo 2: escrever `lib/crm/servidor.test.ts`** (trava, cifra e log, com o contexto e o Supabase falsos):

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.fn()
const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({
  requireClinicContext: vi.fn(async () => ctx.valor),
  requireClinicContextForWrite: vi.fn(async () => ctx.valor),
}))

import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { moverOportunidade, salvarDetalhes } from "./mutations"
import { buscarNoCrm, carregarCrm, SemAcessoAoCrm } from "./queries"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const detalhes = { oportunidadeId: ID, procedimentoId: null, valorCentavos: 5000, responsavelId: null, proximaAcao: null, nota: "Prefere manhã" }

beforeAll(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64")
})

beforeEach(() => {
  rpc.mockReset()
  ctx.valor = { clinicId: "c-1", role: "staff", plan: "pro", userId: "u-1", email: "a@x.com", isDemo: false, supabase: { rpc } }
})

describe("trava de papel e de plano na lib", () => {
  it("Starter e profissional não leem (lança SemAcessoAoCrm, sem ir ao banco)", async () => {
    for (const [role, plan] of [["owner", "starter"], ["professional", "healthtech"]]) {
      ctx.valor = { ...ctx.valor, role, plan }
      await expect(carregarCrm("2026-11-03T12:00:00Z")).rejects.toBeInstanceOf(SemAcessoAoCrm)
      await expect(buscarNoCrm("maria")).rejects.toBeInstanceOf(SemAcessoAoCrm)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it("Starter e profissional não gravam: nao-encontrada, sem ir ao banco", async () => {
    ctx.valor = { ...ctx.valor, plan: "starter" }
    expect(await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ status: "nao-encontrada" })
    expect(await salvarDetalhes(detalhes)).toBe("nao-encontrada")
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe("moverOportunidade", () => {
  it("manda só os campos da etapa de destino", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "perdido", motivo: "preco", valorCentavos: 10 })
    expect(rpc).toHaveBeenCalledWith("move_opportunity", {
      p_opportunity_id: ID,
      p_from: "novo",
      p_to: "perdido",
      p_procedure_id: null,
      p_value_cents: null,
      p_lost_reason: "preco",
    })
  })

  it("o erro do PostgREST vira Error genérico, com o original em cause", async () => {
    const original = { code: "22P02", message: "valor rejeitado: Gertrudes", details: "Gertrudes", hint: null }
    rpc.mockResolvedValue({ data: null, error: original })
    const erro = await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "agendado" }).catch((e) => e)
    expect(erro).toBeInstanceOf(Error)
    expect(erro.message).toBe("Falha ao mover a oportunidade")
    expect(erro.cause).toBe(original)
  })
})

describe("salvarDetalhes", () => {
  it("cifra a nota com a clínica da sessão antes de gravar; o texto claro não sai da lib", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    expect(await salvarDetalhes(detalhes)).toBe("ok")
    const [nome, args] = rpc.mock.calls[0]
    expect(nome).toBe("update_opportunity_details")
    expect(JSON.stringify(args)).not.toContain("manhã")
    expect(decifrarConteudo("c-1", args.p_notes_encrypted)).toBe("Prefere manhã")
    expect(args).toMatchObject({ p_opportunity_id: ID, p_value_cents: 5000, p_procedure_id: null, p_owner_user_id: null, p_next_action_at: null })
  })

  it("sem nota, manda null (apaga a nota)", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    await salvarDetalhes({ ...detalhes, nota: null })
    expect(rpc.mock.calls[0][1].p_notes_encrypted).toBeNull()
  })

  it("o erro do PostgREST vira Error genérico", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "Prefere manhã", details: null, hint: null } })
    const erro = await salvarDetalhes(detalhes).catch((e) => e)
    expect(erro.message).toBe("Falha ao salvar a oportunidade")
  })
})
```

- [ ] **Passo 3: escrever `tests/crm/leitura.test.ts`** (contra o banco, pelo client de cada papel):

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { buscarIdsNoCrm, carregarCrmDaClinica, type Cliente } from "@/lib/crm/leitura"
import { admin, comoUsuario, emMinutos, limparClinica, montarClinica, novoPaciente, registrar, type ClinicaDeTeste } from "../fixtures/clinica-de-conversas"

/**
 * A leitura do CRM (lib/crm/leitura.ts) contra o banco real: monta as
 * oportunidades decifradas para owner e staff, e a RLS devolve vazio para
 * o profissional e para outra clínica, mesmo pedindo a clínica A.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let op: string
let procedimento: string
const agora = () => new Date(Date.now() + 5_000).toISOString()
const como = async (u: { id: string; email: string; password: string }) => (await comoUsuario(u)) as unknown as Cliente

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("crm-leitura-a", ["owner", "staff", "professional"]), montarClinica("crm-leitura-b", ["owner"])])
  await admin.from("clinics").update({ plan: "pro" }).in("id", [A.id, B.id])
  const paciente = await novoPaciente(A, { nome: "Gertrudes Leitura" })
  await registrar(A, paciente, { autor: "patient", texto: "Oi", em: emMinutos(0) })
  const { data: o } = await admin.from("opportunities").select("id").eq("patient_id", paciente).single()
  op = o!.id
  const { data: p } = await admin.from("procedures").insert({ clinic_id: A.id, name: "Implante L", duration_minutes: 30 }).select("id").single()
  procedimento = p!.id
  const staff = await comoUsuario(A.equipe.staff!)
  await staff.rpc("update_opportunity_details", {
    p_opportunity_id: op,
    p_procedure_id: procedimento,
    p_value_cents: 90000,
    p_owner_user_id: A.equipe.staff!.id,
    p_next_action_at: null,
    p_notes_encrypted: cifrarConteudo(A.id, "Prefere manhã"),
  })
  await staff.rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("carregarCrmDaClinica", () => {
  it("owner e staff recebem a oportunidade montada, com a nota decifrada e a trilha", async () => {
    for (const papel of ["owner", "staff"] as const) {
      const dados = await carregarCrmDaClinica(await como(A.equipe[papel]!), A.id, agora())
      const o = dados.oportunidades.find((x) => x.id === op)
      expect(o, papel).toMatchObject({
        etapa: "agendado",
        nota: "Prefere manhã",
        valorCentavos: 90000,
        procedimento: { id: procedimento, nome: "Implante L" },
        paciente: { nome: "Gertrudes Leitura" },
      })
      expect(o!.responsavel?.id).toBe(A.equipe.staff!.id)
      expect(o!.eventos.map((e) => [e.de, e.para])).toEqual([[null, "novo"], ["novo", "agendado"]])
      expect(o!.eventos[1].autor?.id).toBe(A.equipe.staff!.id)
      expect(dados.procedimentos).toContainEqual({ id: procedimento, nome: "Implante L" })
      expect(dados.equipe.map((m) => m.id).sort()).toEqual([A.equipe.owner!.id, A.equipe.staff!.id].sort())
    }
  })

  it("o profissional de A e o owner de B recebem tudo vazio", async () => {
    for (const u of [A.equipe.professional!, B.equipe.owner!]) {
      const dados = await carregarCrmDaClinica(await como(u), A.id, agora())
      expect(dados.oportunidades).toEqual([])
      expect(dados.equipe).toEqual([])
    }
  })

  it("encerrada há mais de 90 dias fica fora; a recente entra", async () => {
    const paciente = await novoPaciente(A)
    await registrar(A, paciente, { autor: "patient", texto: "Oi", em: emMinutos(1) })
    const velha = new Date(Date.now() - 100 * 86_400_000).toISOString()
    await admin
      .from("opportunities")
      .update({ stage: "perdido", lost_reason: "preco", closed_at: velha, opened_at: velha })
      .eq("patient_id", paciente)
    const dados = await carregarCrmDaClinica(await como(A.equipe.owner!), A.id, agora())
    expect(dados.oportunidades.some((o) => o.paciente.id === paciente)).toBe(false)
    expect(dados.oportunidades.some((o) => o.id === op)).toBe(true)
  })
})

describe("buscarIdsNoCrm", () => {
  it("acha pelo nome para a staff de A; nada para B pedindo A", async () => {
    expect(await buscarIdsNoCrm(await como(A.equipe.staff!), A.id, "gertrudes")).toContain(op)
    expect(await buscarIdsNoCrm(await como(B.equipe.owner!), A.id, "gertrudes")).toEqual([])
  })
  it("termo sem letra e com menos de 4 dígitos não vai ao banco", async () => {
    expect(await buscarIdsNoCrm(await como(A.equipe.staff!), A.id, "12")).toEqual([])
  })
})
```

- [ ] **Passo 4: rodar e ver falhar**

Run: `npx vitest run lib/crm/leitura.test.ts lib/crm/servidor.test.ts tests/crm/leitura.test.ts`
Esperado: FAIL (módulos não existem).

- [ ] **Passo 5: implementar `lib/crm/leitura.ts`**:

```ts
import type { createServiceClient } from "@/lib/supabase/server"
import { padraoDeBusca } from "@/lib/conversations/busca"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { nomeDoMembro } from "./equipe"
import { DIA_MS, PERIODOS } from "./metricas"
import { ehEtapa, ehMotivoDePerda, type EventoDaOportunidade, type Oportunidade, type Referencia } from "./tipos"

/**
 * A leitura do CRM a partir do banco. Recebe o client e a clínica, como
 * lib/conversations/leitura.ts: quem chama decide a sessão (queries.ts, ou
 * o client do teste). A RLS é a segunda barreira: owner e staff.
 */

export type Cliente = ReturnType<typeof createServiceClient>

/** Encerrada há mais que o maior período não aparece em lugar nenhum da tela. */
const JANELA_DAS_ENCERRADAS_DIAS = Math.max(...PERIODOS)
/** O teto de linhas do PostgREST. Acima disso, paginar (fora desta v1). */
export const LIMITE_DE_OPORTUNIDADES = 1000

const COLUNAS = [
  "id, conversation_id, stage, stage_changed_at, last_activity_at, opened_at, closed_at",
  "value_cents, owner_user_id, next_action_at, lost_reason, notes_encrypted",
  "patients(id, name, whatsapp_phone_number, opted_out)",
  "conversations(is_urgent)",
  "procedures(id, name)",
  "opportunity_events(id, from_stage, to_stage, actor_user_id, actor_email, created_at)",
].join(", ")

export type LinhaDaOportunidade = {
  id: string
  conversation_id: string | null
  stage: string
  stage_changed_at: string
  last_activity_at: string
  opened_at: string
  closed_at: string | null
  value_cents: number | null
  owner_user_id: string | null
  next_action_at: string | null
  lost_reason: string | null
  notes_encrypted: string | null
  patients: { id: string; name: string | null; whatsapp_phone_number: string; opted_out: boolean } | null
  conversations: { is_urgent: boolean } | null
  procedures: { id: string; name: string } | null
  opportunity_events: {
    id: string
    from_stage: string | null
    to_stage: string
    actor_user_id: string | null
    actor_email: string | null
    created_at: string
  }[]
}

/** A mensagem não leva dado: um erro com o nome do paciente iria para o log. */
export class LinhaDoCrmInvalida extends Error {
  constructor() {
    super("Linha do CRM fora do formato esperado.")
    this.name = "LinhaDoCrmInvalida"
  }
}

export type DadosDoCrm = { oportunidades: Oportunidade[]; procedimentos: Referencia[]; equipe: Referencia[] }

export function montarOportunidade(
  clinicId: string,
  l: LinhaDaOportunidade,
  equipe: ReadonlyMap<string, Referencia>,
): Oportunidade {
  if (!l.patients || !ehEtapa(l.stage)) throw new LinhaDoCrmInvalida()
  const eventos: EventoDaOportunidade[] = [...l.opportunity_events]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((e) => {
      if (!ehEtapa(e.to_stage) || (e.from_stage !== null && !ehEtapa(e.from_stage))) throw new LinhaDoCrmInvalida()
      return {
        id: e.id,
        de: e.from_stage,
        para: e.to_stage,
        em: e.created_at,
        autor: e.actor_user_id ? { id: e.actor_user_id, nome: nomeDoMembro(e.actor_email) } : null,
      }
    })
  return {
    id: l.id,
    paciente: {
      id: l.patients.id,
      nome: l.patients.name,
      telefone: l.patients.whatsapp_phone_number,
      optOut: l.patients.opted_out,
    },
    conversaId: l.conversation_id,
    etapa: l.stage,
    etapaDesde: l.stage_changed_at,
    ultimaAtividade: l.last_activity_at,
    abertaEm: l.opened_at,
    encerradaEm: l.closed_at,
    procedimento: l.procedures ? { id: l.procedures.id, nome: l.procedures.name } : null,
    valorCentavos: l.value_cents,
    responsavel: l.owner_user_id ? (equipe.get(l.owner_user_id) ?? { id: l.owner_user_id, nome: "Equipe" }) : null,
    proximaAcao: l.next_action_at,
    motivoDePerda: ehMotivoDePerda(l.lost_reason) ? l.lost_reason : null,
    // Decifrada só aqui, no servidor (lgpd-security). Blob de outra clínica lança.
    nota: l.notes_encrypted ? decifrarConteudo(clinicId, l.notes_encrypted) : null,
    urgente: l.conversations?.is_urgent ?? false,
    eventos,
  }
}

/** As abertas, as encerradas dos últimos 90 dias, os procedimentos ativos e a equipe. */
export async function carregarCrmDaClinica(supabase: Cliente, clinicId: string, agora: string): Promise<DadosDoCrm> {
  const desde = new Date(Date.parse(agora) - JANELA_DAS_ENCERRADAS_DIAS * DIA_MS).toISOString()
  const [linhas, procedimentos, membros] = await Promise.all([
    supabase
      .from("opportunities")
      .select(COLUNAS)
      .eq("clinic_id", clinicId)
      .or(`closed_at.is.null,closed_at.gte.${desde}`)
      .order("last_activity_at", { ascending: false })
      .limit(LIMITE_DE_OPORTUNIDADES),
    supabase.from("procedures").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("name"),
    supabase.rpc("crm_team", { p_clinic_id: clinicId }),
  ])
  if (linhas.error) throw linhas.error
  if (procedimentos.error) throw procedimentos.error
  if (membros.error) throw membros.error

  const equipe = ((membros.data ?? []) as { user_id: string; email: string | null }[]).map(
    (m): Referencia => ({ id: m.user_id, nome: nomeDoMembro(m.email) }),
  )
  const porId = new Map(equipe.map((m) => [m.id, m]))
  return {
    oportunidades: ((linhas.data ?? []) as unknown as LinhaDaOportunidade[]).map((l) => montarOportunidade(clinicId, l, porId)),
    procedimentos: ((procedimentos.data ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, nome: p.name })),
    equipe,
  }
}

/**
 * A busca por nome ou telefone, pela RPC (POST): o termo nunca vai para a
 * URL. Os padrões são os da fila de Conversas (`padraoDeBusca`).
 */
export async function buscarIdsNoCrm(supabase: Cliente, clinicId: string, termo: string): Promise<string[]> {
  const padrao = padraoDeBusca(termo)
  if (!padrao) return []
  const { data, error } = await supabase.rpc("search_opportunities", {
    p_clinic_id: clinicId,
    p_nome: padrao.nome,
    p_telefone: padrao.telefone,
  })
  if (error) throw error
  return (data ?? []) as string[]
}
```

- [ ] **Passo 6: implementar `lib/crm/queries.ts`**:

```ts
import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm, type AcessoAoCrm } from "./acesso"
import { buscarIdsNoCrm, carregarCrmDaClinica, type Cliente, type DadosDoCrm } from "./leitura"

/**
 * O CRM da clínica da sessão. Não recebe `clinic_id`: vem do vínculo do
 * usuário autenticado. A trava de papel e de plano fica aqui, porque a
 * nota sai decifrada e a server action da busca é um POST que qualquer
 * membro logado alcança sem passar pela página.
 */

/** A sessão não usa o CRM (papel ou plano). A mensagem não leva dado. */
export class SemAcessoAoCrm extends Error {
  constructor(readonly motivo: Exclude<AcessoAoCrm, "liberado">) {
    super("A sessão não tem acesso ao CRM.")
    this.name = "SemAcessoAoCrm"
  }
}

async function contextoDoCrm() {
  const ctx = await requireClinicContext()
  const acesso = acessoAoCrm(ctx.role, ctx.plan)
  if (acesso !== "liberado") throw new SemAcessoAoCrm(acesso)
  return ctx
}

export async function carregarCrm(agora: string): Promise<DadosDoCrm> {
  const { supabase, clinicId } = await contextoDoCrm()
  return carregarCrmDaClinica(supabase as unknown as Cliente, clinicId, agora)
}

export async function buscarNoCrm(termo: string): Promise<string[]> {
  const { supabase, clinicId } = await contextoDoCrm()
  return buscarIdsNoCrm(supabase as unknown as Cliente, clinicId, termo)
}
```

(Se `ClinicContext["supabase"]` já for atribuível a `Cliente`, como em `lib/conversations/queries.ts`, tire o `as unknown as Cliente`.)

- [ ] **Passo 7: implementar `lib/crm/mutations.ts`**:

```ts
import { requireClinicContextForWrite } from "@/lib/auth/context"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { acessoAoCrm } from "./acesso"
import { lerResultadoDosDetalhes, type DetalhesDaOportunidade, type ResultadoDosDetalhes } from "./detalhes"
import { lerResultadoDoMovimento, type PedidoDeMovimento, type ResultadoDoMovimento } from "./movimento"

/**
 * As escritas do CRM pelas RPCs. A sessão de escrita confirma no Auth que a
 * sessão existe; a trava de papel e de plano fica aqui (server action é
 * endpoint público) e se repete no banco. O erro do PostgREST nunca chega à
 * tela: vira um `Error` genérico, com o original em `cause` para quem loga
 * por `erroParaLog`.
 */

export async function moverOportunidade(p: PedidoDeMovimento): Promise<ResultadoDoMovimento> {
  const { supabase, role, plan } = await requireClinicContextForWrite()
  if (acessoAoCrm(role, plan) !== "liberado") return { status: "nao-encontrada" }
  const { data, error } = await supabase.rpc("move_opportunity", {
    p_opportunity_id: p.oportunidadeId,
    p_from: p.de,
    p_to: p.para,
    p_procedure_id: p.para === "ganho" ? (p.procedimento?.id ?? null) : null,
    p_value_cents: p.para === "ganho" ? (p.valorCentavos ?? null) : null,
    p_lost_reason: p.para === "perdido" ? (p.motivo ?? null) : null,
  })
  if (error) throw new Error("Falha ao mover a oportunidade", { cause: error })
  return lerResultadoDoMovimento(data)
}

export async function salvarDetalhes(d: DetalhesDaOportunidade): Promise<ResultadoDosDetalhes> {
  const { supabase, clinicId, role, plan } = await requireClinicContextForWrite()
  if (acessoAoCrm(role, plan) !== "liberado") return "nao-encontrada"
  const { data, error } = await supabase.rpc("update_opportunity_details", {
    p_opportunity_id: d.oportunidadeId,
    p_procedure_id: d.procedimentoId,
    p_value_cents: d.valorCentavos,
    p_owner_user_id: d.responsavelId,
    p_next_action_at: d.proximaAcao,
    // Cifrada aqui, com a clínica da sessão como AAD: o texto claro não sai da aplicação.
    p_notes_encrypted: d.nota ? cifrarConteudo(clinicId, d.nota) : null,
  })
  if (error) throw new Error("Falha ao salvar a oportunidade", { cause: error })
  return lerResultadoDosDetalhes(data)
}
```

- [ ] **Passo 8: rodar e ver passar**

Run: `npx vitest run lib/crm tests/crm/leitura.test.ts tests/architecture/boundaries.test.ts`
Esperado: PASS (a trava de fronteiras confere que `mutations.ts` usa `requireClinicContextForWrite` e que ninguém instancia client).

> **Correção na execução:** `montarOportunidade` trata a nota que não decifra (blob corrompido, chave trocada, AAD de outra clínica) como nota indisponível: `nota: null`, sem lançar e sem log (o teste do plano que esperava o lançamento foi trocado). O tipo `Oportunidade` não tem campo de indicador, então a forma mais simples é a nota nula. Testes novos: nenhum `console` chamado na montagem nem na gravação, `clinic_id` da cifra vindo da sessão, owner/Starter e professional/Pro não gravam, e a nota cifrada no banco sem texto puro.

- [ ] **Passo 9: commit**

```bash
git add lib/crm tests/crm/leitura.test.ts
git commit -m "feat(crm): leitura decifrada e escritas pela sessão, com trava de papel e plano"
```

---

### Tarefa 6: Página real, ações e tempo real

**Arquivos:**
- Modificar: `lib/conversations/ao-vivo.ts`, `components/conversations/ao-vivo.tsx`, `lib/navigation/dashboard-nav.ts` (status "pronto"), `app/(dashboard)/dashboard/crm/page.tsx`, `app/(dashboard)/dashboard/crm/acoes.ts`
- Criar: `lib/crm/ao-vivo.ts`, `components/crm/convite-do-crm.tsx`
- Teste: `lib/crm/ao-vivo.test.ts`, `app/(dashboard)/dashboard/crm/acoes.test.ts`, `app/(dashboard)/dashboard/crm/page.test.tsx`, `lib/conversations/ao-vivo.test.ts`, `lib/navigation/navigation.test.ts`, `components/shell/painel.test.ts`

**Interfaces:**
- Consome: `carregarCrm`, `buscarNoCrm`, `SemAcessoAoCrm` (Tarefa 5); `moverOportunidade`, `salvarDetalhes`; `lerPedidoDeMovimento`, `mensagemDoMovimento`, `lerDetalhes`, `mensagemDosDetalhes`, `acessoAoCrm`, `ROTA_DO_CRM`, `nomeDoMembro` (Tarefa 3); `idsQueCasam`; fixtures `OPORTUNIDADES`, `PROCEDIMENTOS_DO_CRM`, `MEMBROS`, `AGORA`; `relogioDoMinuto`.
- Produz:
  - `assinarAvisos(topico: string, evento: string, ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void }): () => void` em `lib/conversations/ao-vivo.ts`;
  - `topicoDoCrm(clinicId)`, `EVENTO_DO_CRM = "oportunidade"`, `assinarCrm(clinicId, ouvintes)`;
  - `<AoVivo clinicId canal?: "conversas" | "crm" />`;
  - server actions `buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm>`, `mover(pedido: unknown): Promise<{ erro: string | null }>`, `salvar(form: FormData): Promise<{ erro: string | null }>`;
  - `<ConviteDoCrm plano />`;
  - as props novas de `TelaDoCrm` que a Tarefa 7 implementa: `gravar?: { mover; salvar; equipe: Referencia[] }`, `aoVivo?: ReactNode`, `procedimentosDeExemplo?: Referencia[]`.

- [ ] **Passo 1: escrever `lib/crm/ao-vivo.test.ts`**:

```ts
import { describe, expect, it } from "vitest"
import { EVENTO_DO_CRM, topicoDoCrm } from "./ao-vivo"

describe("canal do CRM", () => {
  // Os mesmos valores do trigger e da policy (20261103150000) e de tests/rls/crm-realtime.test.ts.
  it("tópico crm:<clinic_id> e evento oportunidade", () => {
    expect(topicoDoCrm("abc")).toBe("crm:abc")
    expect(EVENTO_DO_CRM).toBe("oportunidade")
  })
})
```

- [ ] **Passo 2: reescrever `app/(dashboard)/dashboard/crm/acoes.test.ts`**:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))
vi.mock("@/lib/crm/queries", async (original) => ({
  ...(await original<typeof import("@/lib/crm/queries")>()),
  buscarNoCrm: vi.fn(async () => [] as string[]),
}))
vi.mock("@/lib/crm/mutations", () => ({
  moverOportunidade: vi.fn(async () => ({ status: "ok" })),
  salvarDetalhes: vi.fn(async () => "ok"),
}))

import { readFileSync } from "node:fs"
import { redirect } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { moverOportunidade, salvarDetalhes } from "@/lib/crm/mutations"
import { buscarNoCrm } from "@/lib/crm/queries"
import { buscar, mover, salvar } from "./acoes"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const ERRO_DO_POSTGREST_COM_O_TERMO = { code: "22P02", message: "invalid input syntax: Mariana Araújo", details: "Mariana Araújo", hint: null }

function espiarLog() {
  return vi.spyOn(console, "error").mockImplementation(() => {})
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

beforeEach(() => {
  ctx.valor = { role: "staff", plan: "pro", isDemo: false, clinicId: "c" }
  vi.mocked(requireClinicContext).mockClear()
  vi.mocked(buscarNoCrm).mockReset().mockResolvedValue([])
  vi.mocked(moverOportunidade).mockReset().mockResolvedValue({ status: "ok" })
  vi.mocked(salvarDetalhes).mockReset().mockResolvedValue("ok")
})

describe("buscar", () => {
  it("fora da demonstração: só as reais", async () => {
    vi.mocked(buscarNoCrm).mockResolvedValue([ID])
    expect(await buscar("mariana")).toEqual({ ids: [ID], erro: null })
  })

  it("na demonstração: as reais e as de exemplo", async () => {
    ctx.valor = { ...ctx.valor, isDemo: true, plan: "healthtech" }
    vi.mocked(buscarNoCrm).mockResolvedValue([ID])
    const r = await buscar("mariana")
    expect(r.ids).toEqual(expect.arrayContaining([ID, "op-08", "op-12"]))
  })

  it("Starter e profissional: nada, sem ir ao banco", async () => {
    for (const v of [{ plan: "starter" }, { role: "professional" }]) {
      ctx.valor = { ...ctx.valor, ...v }
      expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
    }
    expect(buscarNoCrm).not.toHaveBeenCalled()
  })

  it("termo inválido não chega a ler a sessão", async () => {
    for (const termo of [42, "", "   ", "x".repeat(81)]) {
      expect((await buscar(termo)).erro).toBe("Busque por um nome ou por parte do telefone.")
    }
    expect(requireClinicContext).not.toHaveBeenCalled()
  })

  it("erro do PostgREST que repete o termo: o log leva só tipo e código", async () => {
    const log = espiarLog()
    vi.mocked(buscarNoCrm).mockRejectedValue(ERRO_DO_POSTGREST_COM_O_TERMO)
    expect(await buscar("Mariana Araújo")).toEqual({ ids: [], erro: "Não foi possível buscar. Tente de novo." })
    expect(log).toHaveBeenCalledTimes(1)
    const logado = JSON.stringify(log.mock.calls)
    expect(logado).not.toContain("Mariana")
    expect(logado).not.toContain("Araújo")
    expect(logado).toContain("22P02")
    log.mockRestore()
  })

  it("sessão vencida: o redirect para /login segue adiante", async () => {
    const log = espiarLog()
    let erroDoRedirect: unknown
    try {
      redirect("/login")
    } catch (e) {
      erroDoRedirect = e
    }
    vi.mocked(requireClinicContext).mockRejectedValueOnce(erroDoRedirect)
    await expect(buscar("mariana")).rejects.toBe(erroDoRedirect)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

describe("mover", () => {
  it("confere o pedido no servidor: etapa fora da lista nem chega à lib", async () => {
    for (const pedido of [
      { oportunidadeId: ID, de: "novo", para: "fechado" },
      { oportunidadeId: ID, de: "novo; drop", para: "ganho" },
      { oportunidadeId: "op-01", de: "novo", para: "agendado" },
      "novo",
    ]) {
      expect(await mover(pedido)).toEqual({ erro: "Oportunidade não encontrada." })
    }
    expect(moverOportunidade).not.toHaveBeenCalled()
  })

  it("ok: sem erro; sem-mudanca: o aviso da tela", async () => {
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ erro: null })
    vi.mocked(moverOportunidade).mockResolvedValue({ status: "sem-mudanca" })
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({
      erro: "Este cartão mudou de etapa antes. O quadro foi atualizado.",
    })
  })

  it("falha: mensagem genérica e log só com metadado", async () => {
    const log = espiarLog()
    vi.mocked(moverOportunidade).mockRejectedValue(new Error("Falha ao mover a oportunidade", { cause: ERRO_DO_POSTGREST_COM_O_TERMO }))
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ erro: "Não foi possível mover. Tente de novo." })
    expect(JSON.stringify(log.mock.calls)).not.toContain("Mariana")
    log.mockRestore()
  })
})

describe("salvar", () => {
  it("lê o formulário e salva", async () => {
    const r = await salvar(formulario({ oportunidade: ID, valor: "1.200,00", nota: "Prefere manhã" }))
    expect(r).toEqual({ erro: null })
    expect(salvarDetalhes).toHaveBeenCalledWith(expect.objectContaining({ oportunidadeId: ID, valorCentavos: 120000, nota: "Prefere manhã" }))
  })

  it("formulário inválido não chega à lib", async () => {
    expect(await salvar(formulario({ oportunidade: ID, valor: "muito" }))).toEqual({ erro: "Informe o valor em reais, como 1.200,00." })
    expect(salvarDetalhes).not.toHaveBeenCalled()
  })

  it("a nota nunca vai para o log, nem quando o erro do banco a repete", async () => {
    const log = espiarLog()
    const nota = "Paciente relata ansiedade com agulha"
    vi.mocked(salvarDetalhes).mockRejectedValue({ code: "23514", message: `falha: ${nota}`, details: nota, hint: null })
    expect(await salvar(formulario({ oportunidade: ID, nota }))).toEqual({ erro: "Não foi possível salvar. Tente de novo." })
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain("ansiedade")
    log.mockRestore()
  })
})

describe("página do CRM", () => {
  const pagina = readFileSync("app/(dashboard)/dashboard/crm/page.tsx", "utf8")
  it("nunca lê ?q=", () => {
    expect(pagina).not.toMatch(/\.q\b|\[["']q["']\]/)
  })
})
```

- [ ] **Passo 3: reescrever `app/(dashboard)/dashboard/crm/page.test.tsx`**:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))
vi.mock("@/lib/crm/queries", () => ({ carregarCrm: vi.fn(), buscarNoCrm: vi.fn() }))

import { ConviteDoCrm } from "@/components/crm/convite-do-crm"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { carregarCrm } from "@/lib/crm/queries"
import type { Oportunidade } from "@/lib/crm/tipos"
import CrmPage from "./page"

const REAL = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const abrir = (params: Record<string, string> = {}) => CrmPage({ searchParams: Promise.resolve(params) })

beforeEach(() => {
  ctx.valor = { role: "staff", plan: "pro", isDemo: false, clinicId: "c-1", userId: "u-1", email: "marina@x.com" }
  vi.mocked(carregarCrm).mockReset().mockResolvedValue({
    oportunidades: [{ id: REAL } as Oportunidade],
    procedimentos: [{ id: "p-1", nome: "Implante" }],
    equipe: [{ id: "u-1", nome: "Marina" }],
  })
})

describe("página do CRM (parte 2)", () => {
  it("profissional: permissão negada, sem ler o CRM", async () => {
    ctx.valor = { ...ctx.valor, role: "professional" }
    const el = await abrir()
    expect(el.type).toBe(PermissaoNegada)
    expect(carregarCrm).not.toHaveBeenCalled()
  })

  it("Starter: o convite, sem ler o CRM", async () => {
    ctx.valor = { ...ctx.valor, plan: "starter" }
    const el = await abrir()
    expect(el.type).toBe(ConviteDoCrm)
    expect(el.props).toEqual({ plano: "starter" })
    expect(carregarCrm).not.toHaveBeenCalled()
  })

  it("Pro fora da demonstração: a tela real, com as ações, o ao vivo e o recorte da URL", async () => {
    const el = await abrir({ periodo: "7", responsavel: "meus" })
    expect(el.type).toBe(TelaDoCrm)
    expect(el.props).toMatchObject({
      oportunidades: [{ id: REAL }],
      periodo: 7,
      responsavel: "meus",
      eu: { id: "u-1", nome: "Marina" },
      procedimentos: [{ id: "p-1", nome: "Implante" }],
      gravar: { equipe: [{ id: "u-1", nome: "Marina" }] },
    })
    expect(el.props.gravar.mover).toBeTypeOf("function")
    expect(el.props.gravar.salvar).toBeTypeOf("function")
    expect(el.props.aoVivo).toBeTruthy()
    expect(el.props.procedimentosDeExemplo).toBeUndefined()
  })

  it("demonstração: as reais antes das de exemplo, e os procedimentos de exemplo à parte", async () => {
    ctx.valor = { ...ctx.valor, isDemo: true, plan: "healthtech" }
    const el = await abrir()
    const ids = (el.props.oportunidades as Oportunidade[]).map((o) => o.id)
    expect(ids[0]).toBe(REAL)
    expect(ids.length).toBeGreaterThan(10)
    expect(ids.slice(1).every((id) => id.startsWith("op-"))).toBe(true)
    expect(el.props.procedimentosDeExemplo?.length).toBeGreaterThan(0)
    expect(el.props.gravar).toBeDefined()
  })
})
```

- [ ] **Passo 4: rodar e ver falhar**

Run: `npx vitest run lib/crm/ao-vivo.test.ts "app/(dashboard)/dashboard/crm" tests/architecture/rotas.test.ts`
Esperado: FAIL.

- [ ] **Passo 5: generalizar o ao vivo.** Em `lib/conversations/ao-vivo.ts`, troque `assinarConversas` por:

```ts
/**
 * Entra num canal privado de avisos sem dado. O tópico leva o `clinic_id`
 * da sessão, mas quem decide a entrada é a policy do banco: pedir o tópico
 * de outra clínica dá erro de canal, e nada chega. Devolve a função que sai
 * do canal e descarta o refresh pendente. Usado por Conversas e pelo CRM;
 * é o único lugar que importa o client do navegador (boundaries.test.ts).
 */
export function assinarAvisos(
  topico: string,
  evento: string,
  ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void },
): () => void {
  const supabase = createBrowserSupabase()
  const aoMudar = agruparChamadas(ouvintes.aoMudar, ESPERA_DO_REFRESH_MS)
  const canal = supabase
    .channel(topico, { config: { private: true } })
    .on("broadcast", { event: evento }, () => aoMudar())
  let encerrada = false

  // O canal privado exige o token da sessão no Realtime antes da entrada.
  void supabase.realtime.setAuth().then(() => {
    if (encerrada) return
    canal.subscribe((status) => {
      const estado = estadoDoAoVivo(status)
      ouvintes.aoEstado(estado)
      // Ao entrar, e ao voltar depois de cair: o aviso de uma mudança feita
      // enquanto o canal estava fora não chega mais, então a tela relê.
      if (estado === "ao-vivo") aoMudar()
    })
  })

  return () => {
    encerrada = true
    aoMudar.cancelar()
    void supabase.removeChannel(canal)
  }
}

/** O canal da tela de Conversas. */
export function assinarConversas(
  clinicId: string,
  ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void },
): () => void {
  return assinarAvisos(topicoDaClinica(clinicId), EVENTO_DO_AVISO, ouvintes)
}
```

(Se `lib/conversations/ao-vivo.test.ts` mocka `createBrowserSupabase` e chama `assinarConversas`, ele continua passando; não mude o teste.)

`lib/crm/ao-vivo.ts`:

```ts
import { assinarAvisos, type EstadoDoAoVivo } from "@/lib/conversations/ao-vivo"

/**
 * O CRM em tempo real (spec crm-v1, "Ao vivo"): o trigger
 * `private.broadcast_crm_change` avisa `crm:<clinic_id>` sem dado, e só
 * owner e staff entram (migration 20261103150000). A tela pede um refresh,
 * e o servidor redesenha já decifrado.
 */

export const EVENTO_DO_CRM = "oportunidade"

export function topicoDoCrm(clinicId: string): string {
  return `crm:${clinicId}`
}

export function assinarCrm(
  clinicId: string,
  ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void },
): () => void {
  return assinarAvisos(topicoDoCrm(clinicId), EVENTO_DO_CRM, ouvintes)
}
```

Em `components/conversations/ao-vivo.tsx`:

```tsx
import { assinarCrm } from "@/lib/crm/ao-vivo"
```

```tsx
/**
 * A tela se atualiza sozinha: cada aviso do canal da clínica pede um
 * refresh, e o servidor redesenha a tela já decifrada. A pílula diz se a
 * tela está em dia ou se a conexão caiu. `canal` escolhe o de Conversas
 * (padrão) ou o do CRM; vem como texto porque a página (servidor) não passa
 * função para componente de cliente.
 */
export function AoVivo({ clinicId, canal = "conversas" }: { clinicId: string; canal?: "conversas" | "crm" }) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoDoAoVivo>("conectando")

  useEffect(() => {
    const assinar = canal === "crm" ? assinarCrm : assinarConversas
    return assinar(clinicId, { aoMudar: () => router.refresh(), aoEstado: setEstado })
  }, [clinicId, canal, router])
```

(o resto do componente não muda).

- [ ] **Passo 6: `components/crm/convite-do-crm.tsx`**:

```tsx
import { PageHeader } from "@/components/patterns/page-header"
import { ROTULO_DO_PLANO, type ClinicPlan } from "@/lib/agent-config/schema"

/**
 * O CRM no Starter (spec crm-v1, seção 4): o convite para subir de plano.
 * O dado já é gravado em todo plano: quem sobe encontra o funil com histórico.
 */
export function ConviteDoCrm({ plano }: { plano: ClinicPlan }) {
  return (
    <div className="grid gap-6">
      <PageHeader title="CRM" description="O funil comercial da clínica: de quem escreveu até quem fechou." />
      <section className="grid max-w-xl gap-3 rounded-card border border-hairline bg-surface-1/50 p-6">
        <h2 className="text-base font-semibold text-ink-1">O CRM faz parte dos planos Pro e HealthTech</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          Seu plano atual é o {ROTULO_DO_PLANO[plano]}. As oportunidades já são registradas desde a primeira mensagem de
          cada paciente: ao mudar de plano, o funil abre com o histórico.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">Para mudar de plano, fale com a equipe Nextech.</p>
      </section>
    </div>
  )
}
```

- [ ] **Passo 7: reescrever `app/(dashboard)/dashboard/crm/acoes.ts`**:

```ts
"use server"

import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import type { ResultadoDaBuscaDoCrm } from "@/components/crm/busca-do-crm"
import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm } from "@/lib/crm/acesso"
import { idsQueCasam } from "@/lib/crm/busca"
import { lerDetalhes, mensagemDosDetalhes } from "@/lib/crm/detalhes"
import { lerPedidoDeMovimento, mensagemDoMovimento } from "@/lib/crm/movimento"
import { moverOportunidade, salvarDetalhes } from "@/lib/crm/mutations"
import { buscarNoCrm } from "@/lib/crm/queries"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { OPORTUNIDADES } from "@/app/_fixtures/crm"

const TERMO = z.string().trim().min(1).max(80)

/**
 * A busca do CRM por nome ou telefone. O termo chega no corpo deste POST,
 * segue no corpo do POST da RPC e não vai a URL, log nem mensagem de erro
 * (lgpd-security, regra 1). Na demonstração, procura também nas de exemplo.
 */
export async function buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm> {
  const t = TERMO.safeParse(termo)
  if (!t.success) return { ids: [], erro: "Busque por um nome ou por parte do telefone." }

  try {
    const { role, plan, isDemo } = await requireClinicContext()
    if (acessoAoCrm(role, plan) !== "liberado") return { ids: [], erro: null }
    const reais = await buscarNoCrm(t.data)
    return { ids: isDemo ? [...reais, ...idsQueCasam(OPORTUNIDADES, t.data)] : reais, erro: null }
  } catch (erro) {
    // O redirect("/login") de requireClinicContext é um erro interno do Next.
    unstable_rethrow(erro)
    console.error("Falha na busca do CRM", erroParaLog(erro))
    return { ids: [], erro: "Não foi possível buscar. Tente de novo." }
  }
}

/**
 * Mover pela tela. O pedido vem do navegador: `de` e `para` passam por
 * `ehEtapa` (lerPedidoDeMovimento) antes de qualquer coisa. Clínica, papel
 * e plano são conferidos pela sessão, na lib e no banco.
 */
export async function mover(pedido: unknown): Promise<{ erro: string | null }> {
  const p = lerPedidoDeMovimento(pedido)
  if (!p) return { erro: mensagemDoMovimento({ status: "nao-encontrada" }) }
  try {
    return { erro: mensagemDoMovimento(await moverOportunidade(p)) }
  } catch (erro) {
    unstable_rethrow(erro)
    console.error("Falha ao mover no CRM", erroParaLog(erro))
    return { erro: "Não foi possível mover. Tente de novo." }
  }
}

/** Procedimento, valor, responsável, próxima ação e nota. A nota é cifrada na lib. */
export async function salvar(form: FormData): Promise<{ erro: string | null }> {
  const lido = lerDetalhes({
    oportunidade: form.get("oportunidade"),
    procedimento: form.get("procedimento"),
    valor: form.get("valor"),
    responsavel: form.get("responsavel"),
    proxima_acao: form.get("proxima_acao"),
    nota: form.get("nota"),
  })
  if (lido.erro !== null) return { erro: lido.erro }
  try {
    return { erro: mensagemDosDetalhes(await salvarDetalhes(lido.detalhes)) }
  } catch (erro) {
    unstable_rethrow(erro)
    console.error("Falha ao salvar no CRM", erroParaLog(erro))
    return { erro: "Não foi possível salvar. Tente de novo." }
  }
}
```

- [ ] **Passo 8: reescrever `app/(dashboard)/dashboard/crm/page.tsx`**:

```tsx
import type { Metadata } from "next"
import { AoVivo } from "@/components/conversations/ao-vivo"
import { ConviteDoCrm } from "@/components/crm/convite-do-crm"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm, ROTA_DO_CRM } from "@/lib/crm/acesso"
import { nomeDoMembro } from "@/lib/crm/equipe"
import { lerFiltroDeEncerradas, lerPeriodo, lerResponsavel, lerVista } from "@/lib/crm/filtros"
import { carregarCrm } from "@/lib/crm/queries"
import { relogioDoMinuto } from "@/lib/demo/relogio"
import { AGORA } from "@/app/_fixtures/agora"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "@/app/_fixtures/crm"
import { buscar, mover, salvar } from "./acoes"

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * O funil comercial (spec crm-v1, parte 2):
 * - profissional: permissão negada; Starter: o convite. Nenhum dos dois lê o CRM;
 * - Pro e HealthTech: as oportunidades do banco, decifradas no servidor, com
 *   as ações e o tempo real pelo canal privado da clínica;
 * - na demonstração, as reais (canal da Evolution) e as de exemplo trazidas
 *   para o minuto atual, numa tela só. A de exemplo move só no navegador.
 *
 * A busca é por POST (`buscar`): `?q=` nunca é lido.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, plan, isDemo, clinicId, userId, email } = await requireClinicContext()
  const acesso = acessoAoCrm(role, plan)
  if (acesso === "sem-papel") return <PermissaoNegada titulo="CRM" rota={ROTA_DO_CRM} role={role} demo={isDemo} />
  if (acesso === "sem-plano") return <ConviteDoCrm plano={plan} />

  const params = await searchParams
  // No minuto real: as reais e as de exemplo no mesmo relógio (como Conversas).
  const relogio = isDemo ? relogioDoMinuto(AGORA) : null
  const agora = relogio?.agora ?? new Date().toISOString()
  const dados = await carregarCrm(agora)

  return (
    <TelaDoCrm
      oportunidades={relogio ? [...dados.oportunidades, ...relogio.deslocar(OPORTUNIDADES)] : dados.oportunidades}
      agora={agora}
      eu={{ id: userId, nome: nomeDoMembro(email) }}
      periodo={lerPeriodo(texto(params.periodo))}
      responsavel={lerResponsavel(texto(params.responsavel))}
      vista={lerVista(texto(params.vista))}
      encerradas={lerFiltroDeEncerradas(texto(params.resultado), texto(params.motivo))}
      procedimentos={dados.procedimentos}
      procedimentosDeExemplo={isDemo ? PROCEDIMENTOS_DO_CRM : undefined}
      caminho={ROTA_DO_CRM}
      buscar={buscar}
      gravar={{ mover, salvar, equipe: dados.equipe }}
      aoVivo={<AoVivo clinicId={clinicId} canal="crm" />}
    />
  )
}
```

> Nota sobre "Meus" na demonstração: o "eu" agora é o usuário real da sessão (os movimentos reais gravam esse autor). As de exemplo com o membro "você" da fixture não entram em "Meus". É o preço de juntar reais e exemplos; anote no `docs/specs/demo-account-v1.md` (Tarefa 8).

- [ ] **Passo 8b: o item vira tela pronta.** Em `lib/navigation/dashboard-nav.ts`, o item CRM passa a `status: "pronto"`. Em `lib/navigation/navigation.test.ts`, no `describe("CRM e o plano")` da Tarefa 4, acrescente:

```ts
  it("é tela pronta, e acende na própria rota", () => {
    expect(crm("pro")).toMatchObject({ status: "pronto", active: true })
    expect(crm("starter")).toMatchObject({ status: "pronto", selo: "Pro" })
  })
```

Os testes que contam itens "em breve" fora da demonstração (`lib/navigation/navigation.test.ts`, "itens de tela não construída", e `components/shell/painel.test.ts`, que contava 8 com o CRM, commit 2328a17) passam a ter **um a menos**: ajuste a contagem e tire "CRM" das listas de "em breve" desses casos. `tests/architecture/rotas.test.ts` passa a exigir a página sem `if (!isDemo) notFound()`, que o passo 8 já tirou.

- [ ] **Passo 9: rodar e ver passar** (a tela ainda não aceita as props novas: o TypeScript reclama, o Vitest não)

Run: `npx vitest run lib/crm lib/conversations/ao-vivo.test.ts "app/(dashboard)/dashboard/crm" tests/architecture lib/navigation components/shell tests/demo`
Esperado: PASS. O `tsc` só fecha na Tarefa 7.

- [ ] **Passo 10: não commitar ainda.** Siga para a Tarefa 7: as props novas da tela (`gravar`, `aoVivo`, `procedimentosDeExemplo`) só existem lá, e o commit sai junto, com o `tsc` limpo.

---

### Tarefa 7: A tela grava, ressincroniza e mostra o resumo compacto

**Arquivos:**
- Modificar: `components/crm/estado.ts`, `components/crm/tela-do-crm.tsx`, `components/crm/painel-da-oportunidade.tsx`, `components/crm/resumo-do-periodo.tsx`
- Criar: `components/crm/formulario-da-oportunidade.tsx`
- Teste: `components/crm/estado.test.ts`, `components/crm/tela-do-crm.test.tsx`, `components/crm/componentes.test.tsx`

**Interfaces:**
- Consome: `ehIdDoBanco`, `dataHoraLocal`, `formatarMoeda`, `TAMANHO_MAXIMO_DA_NOTA`; as server actions `mover` e `salvar` (como funções nas props); `AoVivo` (como `ReactNode`).
- Produz:
  - `estadoInicial(ops: Oportunidade[]): EstadoDoCrm`; `EstadoDoCrm = { origem: readonly Oportunidade[]; oportunidades: Oportunidade[]; aviso: string | null }`; eventos `{ tipo: "sincronizar"; oportunidades }` e `{ tipo: "avisar"; aviso: string }`;
  - `PropsDaTelaDoCrm` com `gravar?: Gravacao`, `aoVivo?: ReactNode`, `procedimentosDeExemplo?: Referencia[]`, onde `type Gravacao = { mover: (pedido: PedidoDeMovimento) => Promise<{ erro: string | null }>; salvar: (form: FormData) => Promise<{ erro: string | null }>; equipe: Referencia[] }`;
  - `<FormularioDaOportunidade op procedimentos equipe salvar aoSalvar />`;
  - `PainelDaOportunidade` com prop opcional `edicao?: { procedimentos: Referencia[]; equipe: Referencia[]; salvar; aoSalvar: () => void }`.

- [ ] **Passo 1: acrescentar a `components/crm/estado.test.ts`**:

```ts
import { estadoInicial, reduzirCrm } from "./estado"

describe("sincronizar com o servidor (router.refresh)", () => {
  it("as props novas substituem o quadro, e o aviso fica", () => {
    const antes = { ...estadoInicial([op("op-1", "novo")]), aviso: "Este cartão mudou de etapa antes. O quadro foi atualizado." }
    const novas = [op("op-1", "agendado"), op("op-2", "novo")]
    const depois = reduzirCrm(antes, { tipo: "sincronizar", oportunidades: novas })
    expect(depois.oportunidades).toBe(novas)
    expect(depois.origem).toBe(novas)
    expect(depois.aviso).toBe(antes.aviso)
  })

  it("desfaz o movimento otimista que o servidor recusou", () => {
    const doServidor = [op("op-1", "novo")]
    const movido = reduzirCrm(estadoInicial(doServidor), {
      tipo: "mover",
      pedido: { oportunidadeId: "op-1", de: "novo", para: "agendado" },
      em: AGORA,
      autor: { id: "m", nome: "Marina" },
    })
    expect(movido.oportunidades[0].etapa).toBe("agendado")
    expect(movido.origem).toBe(doServidor)
    const refeito = reduzirCrm(movido, { tipo: "sincronizar", oportunidades: doServidor })
    expect(refeito.oportunidades[0].etapa).toBe("novo")
  })

  it("avisar mostra a mensagem do servidor", () => {
    expect(reduzirCrm(estadoInicial([]), { tipo: "avisar", aviso: "Não foi possível mover. Tente de novo." }).aviso).toBe(
      "Não foi possível mover. Tente de novo.",
    )
  })
})
```

(Use o helper `op(id, etapa)` e a constante `AGORA` que o arquivo já tem; se o helper tiver outra assinatura, adapte só a chamada. Os casos existentes que montam o estado com `{ oportunidades, aviso }` passam a usar `estadoInicial(...)`.)

- [ ] **Passo 2: acrescentar a `components/crm/tela-do-crm.test.tsx`** (no topo, antes dos imports do componente, o mock do roteador; o `renderToStaticMarkup` não tem o App Router montado):

```tsx
import { vi } from "vitest"
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))
```

e os casos:

```tsx
const REAL = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const gravar = { mover: vi.fn(async () => ({ erro: null })), salvar: vi.fn(async () => ({ erro: null })), equipe: [ANA] }

describe("tela real", () => {
  it("mostra o ao vivo quando recebe", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} gravar={gravar} aoVivo={<span>pílula-ao-vivo</span>} />)
    expect(h).toContain("pílula-ao-vivo")
  })
})

describe("painel: edição só na oportunidade real", () => {
  it("real com gravação: o formulário, com a nota no campo", () => {
    const h = renderToStaticMarkup(
      <PainelDaOportunidade
        op={op(REAL, "Gertrudes", "agendado", { nota: "Prefere manhã", valorCentavos: 120050 })}
        aoFechar={() => {}}
        aoMover={() => {}}
        edicao={{ procedimentos: [], equipe: [ANA], salvar: gravar.salvar, aoSalvar: () => {} }}
      />,
    )
    expect(h).toContain('name="nota"')
    expect(h).toContain("Prefere manhã")
    expect(h).toContain('name="valor"')
    expect(h).toContain("1.200,50")
    expect(h).toContain(`value="${REAL}"`)
    expect(h).not.toContain("Editar campos")
  })

  it("de exemplo (ou sem gravação): o botão inerte, sem formulário", () => {
    const h = renderToStaticMarkup(<PainelDaOportunidade op={op("op-1", "Gertrudes", "agendado")} aoFechar={() => {}} aoMover={() => {}} />)
    expect(h).toContain("Editar campos")
    expect(h).not.toContain('name="nota"')
  })
})
```

(Use o helper `props()` do arquivo se existir; se não, monte as props mínimas como os casos existentes fazem e chame-o `props`. O `op(id, nome, etapa, p)` já existe no arquivo.)

Em `components/crm/componentes.test.tsx`, acrescente o resumo compacto:

```tsx
describe("ResumoDoPeriodo no celular", () => {
  it("tem a faixa compacta só abaixo de sm e os KPIs grandes só a partir de sm", () => {
    const h = renderToStaticMarkup(
      <ResumoDoPeriodo
        resumo={{ valorGanhoCentavos: 1240000, conversao: 0.18, diasAteFechar: 9.5 }}
        periodo={30}
        hrefDoPeriodo={{ 7: "/a", 30: "/b", 90: "/c" }}
      />,
    )
    expect(h).toMatch(/<dl[^>]*sm:hidden/)
    expect(h).toMatch(/class="[^"]*hidden[^"]*sm:grid/)
    expect(h).toContain("Até fechar")
    expect(h).toContain("9,5 dias")
  })

  it("sem base, a faixa compacta mostra o traço, nunca zero", () => {
    const h = renderToStaticMarkup(
      <ResumoDoPeriodo resumo={{ valorGanhoCentavos: 0, conversao: null, diasAteFechar: null }} periodo={30} hrefDoPeriodo={{ 7: "/a", 30: "/b", 90: "/c" }} />,
    )
    const compacta = h.match(/<dl[\s\S]*?<\/dl>/)?.[0] ?? ""
    expect(compacta.match(/—/g)?.length).toBe(2)
  })
})
```

(Importe `ResumoDoPeriodo` de `./resumo-do-periodo` se o arquivo ainda não o importa.)

- [ ] **Passo 3: rodar e ver falhar**

Run: `npx vitest run components/crm`
Esperado: FAIL (`estadoInicial` não existe; painel sem `edicao`; resumo sem `<dl>`).

- [ ] **Passo 4: `components/crm/estado.ts`**:

```ts
import { aplicarMovimento, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import { ETAPAS_ABERTAS, type EtapaAberta, type Oportunidade, type Referencia } from "@/lib/crm/tipos"

/**
 * O quadro no navegador. O servidor é a fonte: `origem` é a lista que veio
 * nas props, e o `router.refresh()` (depois de gravar, ou pelo aviso ao
 * vivo) traz outra, que substitui o quadro (`sincronizar`). O movimento é
 * otimista: aparece na hora e, se o servidor recusar, o refresh desfaz.
 * Nas oportunidades de exemplo da demonstração, o movimento só vive aqui.
 */
export type EstadoDoCrm = { origem: readonly Oportunidade[]; oportunidades: Oportunidade[]; aviso: string | null }

export type EventoDoCrm =
  | { tipo: "mover"; pedido: PedidoDeMovimento; em: string; autor: Referencia }
  | { tipo: "sincronizar"; oportunidades: Oportunidade[] }
  | { tipo: "avisar"; aviso: string }
  | { tipo: "fechar-aviso" }

export function estadoInicial(oportunidades: Oportunidade[]): EstadoDoCrm {
  return { origem: oportunidades, oportunidades, aviso: null }
}

export function reduzirCrm(e: EstadoDoCrm, ev: EventoDoCrm): EstadoDoCrm {
  switch (ev.tipo) {
    case "fechar-aviso":
      return { ...e, aviso: null }
    case "avisar":
      return { ...e, aviso: ev.aviso }
    case "sincronizar":
      return { ...e, origem: ev.oportunidades, oportunidades: ev.oportunidades }
    case "mover": {
      const alvo = e.oportunidades.find((o) => o.id === ev.pedido.oportunidadeId)
      const r = validarMovimento(alvo, ev.pedido)
      if (r.status !== "ok") return { ...e, aviso: mensagemDoMovimento(r) }
      return {
        ...e,
        oportunidades: e.oportunidades.map((o) => (o === alvo ? aplicarMovimento(o, ev.pedido, ev.em, ev.autor) : o)),
        aviso: null,
      }
    }
  }
}
```

(`etapaComResultado` fica como está, no fim do arquivo.)

- [ ] **Passo 5: `components/crm/formulario-da-oportunidade.tsx`**:

```tsx
"use client"

import { useState } from "react"
import { Botao, Campo, Input, Select, Textarea } from "@/components/patterns/formulario"
import { TAMANHO_MAXIMO_DA_NOTA } from "@/lib/crm/detalhes"
import type { Oportunidade, Referencia } from "@/lib/crm/tipos"
import { dataHoraLocal } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"

/**
 * Os campos da oportunidade real (spec crm-v1, "Os outros campos"). O
 * formulário vai inteiro para a server action, que confere tudo de novo;
 * a nota segue no corpo do POST e é cifrada na lib antes de gravar.
 */
export function FormularioDaOportunidade({
  op,
  procedimentos,
  equipe,
  salvar,
  aoSalvar,
}: {
  op: Oportunidade
  procedimentos: Referencia[]
  equipe: Referencia[]
  salvar: (form: FormData) => Promise<{ erro: string | null }>
  aoSalvar: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(form: FormData) {
    setEnviando(true)
    const r = await salvar(form).catch(() => ({ erro: "Não foi possível salvar. Tente de novo." }))
    setEnviando(false)
    setErro(r.erro)
    if (!r.erro) aoSalvar()
  }

  // O procedimento apagado do perfil some da lista, mas o atual continua escolhível.
  const opcoes = op.procedimento && !procedimentos.some((p) => p.id === op.procedimento?.id) ? [op.procedimento, ...procedimentos] : procedimentos

  return (
    <form action={enviar} className="grid gap-3" aria-label="Campos da oportunidade">
      <input type="hidden" name="oportunidade" value={op.id} />
      <Campo label="Procedimento">
        <Select name="procedimento" defaultValue={op.procedimento?.id ?? ""}>
          <option value="">Não informado</option>
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="Valor" hint="em reais">
        <Input name="valor" inputMode="decimal" placeholder="1.200,00" defaultValue={op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : ""} />
      </Campo>
      <Campo label="Responsável">
        <Select name="responsavel" defaultValue={op.responsavel?.id ?? ""}>
          <option value="">Sem responsável</option>
          {equipe.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="Próxima ação">
        <Input type="datetime-local" name="proxima_acao" defaultValue={op.proximaAcao ? dataHoraLocal(op.proximaAcao) : ""} />
      </Campo>
      <Campo label="Nota" hint="visível só para a equipe">
        <Textarea name="nota" rows={4} maxLength={TAMANHO_MAXIMO_DA_NOTA} defaultValue={op.nota ?? ""} />
      </Campo>
      {erro && (
        <p role="alert" className="text-sm text-danger-fg">
          {erro}
        </p>
      )}
      <Botao type="submit" disabled={enviando} className="justify-self-start">
        {enviando ? "Salvando…" : "Salvar"}
      </Botao>
    </form>
  )
}
```

(O `formatarMoeda` devolve "R$ 1.200,50"; o `lerValorEmCentavos` do servidor aceita esse formato, como o teste da Tarefa 3 confere. O teste do passo 2 procura "1.200,50" no HTML, que está dentro do valor.)

- [ ] **Passo 6: `components/crm/painel-da-oportunidade.tsx`.** Acrescente a prop e troque o botão inerte:

```tsx
import { FormularioDaOportunidade } from "./formulario-da-oportunidade"
```

```tsx
export function PainelDaOportunidade({
  op,
  aoFechar,
  aoMover,
  edicao,
}: {
  op: Oportunidade
  aoFechar: () => void
  aoMover: (op: Oportunidade, para: Etapa) => void
  /** Só na oportunidade real com gravação. Na de exemplo, o botão fica inerte. */
  edicao?: {
    procedimentos: Referencia[]
    equipe: Referencia[]
    salvar: (form: FormData) => Promise<{ erro: string | null }>
    aoSalvar: () => void
  }
}) {
```

(acrescente `type Referencia` ao import de `@/lib/crm/tipos`) e, no lugar do `<button ... disabled ...>Editar campos</button>`:

```tsx
      {edicao ? (
        <FormularioDaOportunidade op={op} {...edicao} />
      ) : (
        <button
          type="button"
          disabled
          title="Oportunidade de exemplo: a edição vale para as reais"
          className="justify-self-start rounded-control border border-hairline px-3 py-1.5 text-sm text-ink-3"
        >
          Editar campos
        </button>
      )}
```

Atualize o comentário do componente: "Na oportunidade real, os campos se editam no formulário; na de exemplo, são leitura."

- [ ] **Passo 7: `components/crm/tela-do-crm.tsx`.** Mudanças, nesta ordem:

Imports:

```tsx
import { useMemo, useReducer, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ehIdDoBanco } from "@/lib/crm/ids"
import { estadoInicial, etapaComResultado, reduzirCrm } from "./estado"
```

Props:

```tsx
export type Gravacao = {
  mover: (pedido: PedidoDeMovimento) => Promise<{ erro: string | null }>
  salvar: (form: FormData) => Promise<{ erro: string | null }>
  equipe: Referencia[]
}

export type PropsDaTelaDoCrm = {
  oportunidades: Oportunidade[]
  agora: string
  eu: Referencia
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  encerradas: FiltroDeEncerradas
  procedimentos: Referencia[]
  /** Na demonstração, os procedimentos das oportunidades de exemplo. */
  procedimentosDeExemplo?: Referencia[]
  caminho: string
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
  /** As ações do servidor. Sem elas, nada grava (o protótipo da parte 1). */
  gravar?: Gravacao
  /** A pílula do tempo real (AoVivo), montada pela página. */
  aoVivo?: ReactNode
}
```

No corpo, troque o `useReducer` e o `mover`:

```tsx
  const router = useRouter()
  const [estado, despachar] = useReducer(reduzirCrm, p.oportunidades, estadoInicial)
  // O router.refresh() traz props novas: o servidor é a fonte, e o quadro
  // volta a ela (inclusive desfazendo o movimento que ele recusou). Ajuste
  // durante a renderização, como a doc do React recomenda para estado
  // derivado de props, sem um efeito que pintaria o quadro velho antes.
  if (estado.origem !== p.oportunidades) despachar({ tipo: "sincronizar", oportunidades: p.oportunidades })
```

```tsx
  /** As de exemplo fecham com os procedimentos de exemplo; as reais, com os do perfil. */
  const procedimentosDe = (op: Oportunidade) =>
    !ehIdDoBanco(op.id) && p.procedimentosDeExemplo ? p.procedimentosDeExemplo : p.procedimentos

  async function mover(pedido: PedidoDeMovimento) {
    despachar({ tipo: "mover", pedido, em: p.agora, autor: p.eu })
    if (!p.gravar || !ehIdDoBanco(pedido.oportunidadeId)) return
    const r = await p.gravar.mover(pedido).catch(() => ({ erro: "Não foi possível mover. Tente de novo." }))
    if (r.erro) despachar({ tipo: "avisar", aviso: r.erro })
    router.refresh()
  }
```

No JSX: o cabeçalho ganha a pílula,

```tsx
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="CRM" description="O funil comercial da clínica: de quem escreveu até quem fechou." />
        {p.aoVivo}
      </div>
```

o painel ganha a edição nas reais,

```tsx
      {opAberta && (
        <PainelDaOportunidade
          op={opAberta}
          aoFechar={() => setAberta(null)}
          aoMover={aoMover}
          edicao={
            p.gravar && ehIdDoBanco(opAberta.id)
              ? { procedimentos: p.procedimentos, equipe: p.gravar.equipe, salvar: p.gravar.salvar, aoSalvar: () => router.refresh() }
              : undefined
          }
        />
      )}
```

e o pedido de fechamento usa `procedimentos={procedimentosDe(fechando.op)}`. O `aoConfirmar` continua chamando `mover(pedido)` (agora assíncrona; não precisa de `await`: o aviso chega pelo estado).

- [ ] **Passo 8: `components/crm/resumo-do-periodo.tsx`** (decisão 3, KPIs compactos):

```tsx
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
  const ganho = formatarMoeda(resumo.valorGanhoCentavos)
  const conversao = resumo.conversao === null ? null : formatarPercentual(resumo.conversao)
  const ateFechar = resumo.diasAteFechar === null ? null : dias(resumo.diasAteFechar)

  return (
    <section aria-label="Resumo do período" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Período"
        atual={String(periodo)}
        segmentos={PERIODOS.map((p) => ({ valor: String(p), rotulo: `${p} dias`, href: hrefDoPeriodo[p] }))}
      />
      {/* Celular (decisão do Jhones, 2026-11-03): uma faixa de três números
          curtos, ~90 px, para a faixa do funil e o quadro não descerem 650 px. */}
      <dl className="grid grid-cols-3 divide-x divide-hairline rounded-card border border-hairline bg-surface-1/50 sm:hidden">
        {[
          { rotulo: "Ganho", valor: ganho },
          { rotulo: "Conversão", valor: conversao },
          { rotulo: "Até fechar", valor: ateFechar },
        ].map((i) => (
          <div key={i.rotulo} className="grid min-w-0 gap-0.5 px-3 py-2">
            <dt className="truncate text-[0.6875rem] text-ink-3">{i.rotulo}</dt>
            <dd className={`truncate font-display text-lg ${i.valor === null ? "text-ink-3" : "text-ink-1"}`}>{i.valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        <KpiCard label="Valor ganho" value={ganho} />
        {conversao === null ? (
          <KpiCard label="Conversão de Novo até Ganho" pendente={SEM_BASE} />
        ) : (
          <KpiCard label="Conversão de Novo até Ganho" value={conversao} />
        )}
        {ateFechar === null ? (
          <KpiCard label="Tempo médio até fechar" pendente={SEM_GANHO} />
        ) : (
          <KpiCard label="Tempo médio até fechar" value={ateFechar} />
        )}
      </div>
    </section>
  )
}
```

- [ ] **Passo 9: rodar tudo o que a tela toca e o TypeScript**

Run: `npx vitest run components/crm "app/(dashboard)/dashboard/crm" lib/crm tests/architecture tests/demo lib/navigation components/shell`
Esperado: PASS.

Run: `npx tsc --noEmit`
Esperado: sem erro (gravar em arquivo e conferir o código de saída: `npx tsc --noEmit > "$SCRATCH/tsc.txt" 2>&1; echo exit=$? >> "$SCRATCH/tsc.txt"`).

- [ ] **Passo 10: commit** (Tarefas 6 e 7 juntas)

```bash
git add lib/conversations/ao-vivo.ts lib/crm/ao-vivo.ts lib/crm/ao-vivo.test.ts components/conversations/ao-vivo.tsx components/crm components/shell/painel.test.ts lib/navigation "app/(dashboard)/dashboard/crm"
git commit -m "feat(crm): tela real com gravação, tempo real, convite do Starter e resumo compacto"
```

---

### Tarefa 8: Limpeza do canal, conferência na tela, revisões e documentação

**Arquivos:**
- Modificar: `scripts/canal-demo/limpar.ts`, `tests/rls/canal-demo.test.ts`, `docs/status.md`, `docs/specs/crm-v1.md`, `docs/specs/demo-account-v1.md`, `docs/specs/evolution-demo-v1.md`, `docs/specs/conversation-engine-v1.md`, `.claude/skills/architecture/SKILL.md`, `docs/claude-memory/nextech-ambiente-supabase.md`, `docs/claude-memory/MEMORY.md`

**Interfaces:**
- Consome: tudo das tarefas anteriores.
- Produz: a conferência da limpeza com as oportunidades; a documentação da parte 2.

- [ ] **Passo 1: o teste da limpeza.** Em `tests/rls/canal-demo.test.ts`, no caso "depois de uma conversa gravada, deixa a clínica sem paciente, conversa, mensagem nem agente conectado", troque a lista de tabelas por:

```ts
    for (const tabela of ["patients", "conversations", "messages", "attendance_sessions", "opportunities", "opportunity_events"]) {
      expect(await contar(tabela), tabela).toBe(0)
    }
```

e acrescente, antes do `limpar()`, a prova de que as conversas abriram oportunidades:

```ts
    expect(await contar("opportunities")).toBe(2)
```

Run: `npx vitest run tests/rls/canal-demo.test.ts`
Esperado: PASS já (a cascata do paciente leva as oportunidades). Se falhar, a cascata não está como a Tarefa 1 manda: corrija lá.

- [ ] **Passo 2: a conferência do script.** Em `scripts/canal-demo/limpar.ts`, `conferirLimpeza` passa a contar `opportunities`:

```ts
  const [pacientes, conversas, mensagens, oportunidades, agentes] = await Promise.all([
    contar("patients"),
    contar("conversations"),
    contar("messages"),
    contar("opportunities"),
    contar("agents").or("whatsapp_phone_number_id.not.is.null,status.eq.active"),
  ])
```

e inclua `["oportunidade", oportunidades]` na lista de sobras, ao lado de `["paciente", pacientes]` e `["conversa", conversas]`. Rode o teste do passo 1 de novo. Commit:

```bash
git add scripts/canal-demo/limpar.ts tests/rls/canal-demo.test.ts
git commit -m "test(demo): a limpeza do canal leva as oportunidades do CRM"
```

- [ ] **Passo 3: conferir na tela** (skill `run`; script de captura `shot-referencia.mjs` com a conta de demonstração): `/dashboard/crm` em 1440 e 390 px, nos dois temas. Conferir: a pílula "Ao vivo"; os KPIs compactos no celular sem rolagem horizontal; abrir uma oportunidade real (mande uma mensagem pelo canal de demonstração, ou registre uma pela fixture) e editar valor, responsável e nota; mover por arrastar e pelo menu; o selo IA só em Qualificado automático. Rode `npx tsx scripts/canal-demo.ts limpar` no fim, se usou o canal.

- [ ] **Passo 4: revisões.** Peça a revisão do subagente `security-reviewer` (a parte 2 toca nota de paciente cifrada, RLS nova e um canal Realtime) e do `qa-reviewer` sobre o diff desde o início da sessão. Corrija com teste o que eles acharem e anote "Correção na execução" no passo da tarefa correspondente deste plano.

- [ ] **Passo 5: a suíte inteira**, em segundo plano, sem editar arquivo enquanto roda:

```bash
SAIDA="$SCRATCH/suite-crm-parte-2.txt"
{ git rev-parse HEAD; npx vitest run; echo "exit=$?"; } > "$SAIDA" 2>&1
```

Esperado: `exit=0`. Teste de banco travado muito além do `testTimeout` é queda de rede: confira a conexão e rode o arquivo sozinho antes de concluir que é falha.

- [ ] **Passo 6: documentação.**
  - `docs/specs/crm-v1.md`: marcar `[x]` nos critérios da Parte 2 conferidos; registrar as três decisões de 2026-11-03 na seção "Decisões" (10: selo IA só na qualificação automática; 11: "hoje" por dia de calendário; 12: KPIs compactos no celular) e ajustar a linha do cartão na seção 5 ("selo IA quando a última mudança foi a qualificação automática");
  - `docs/status.md`: CRM próprio "parte 2 pronta"; tirar da seção "CRM, parte 1 — pendências" o que a parte 2 resolveu (layout do celular, `ehEtapa`, teste do log, redutor, selo IA, "hoje"); manter o `npm run lint` e o `acoes.ts` de Conversas;
  - `docs/specs/demo-account-v1.md`: o CRM junta as reais às de exemplo; "Meus" na demonstração é o usuário real;
  - `docs/specs/evolution-demo-v1.md`: a limpeza leva as oportunidades (pela cascata, conferida em `conferirLimpeza`);
  - `docs/specs/conversation-engine-v1.md`: os triggers em `messages` e em `conversations.qualified_at`, e `anonymize_patient` apagando a nota;
  - `.claude/skills/architecture/SKILL.md`: `lib/crm/` agora tem leitura, queries e mutations; o canal `crm:<clinic_id>`;
  - `docs/claude-memory/nextech-ambiente-supabase.md`: **43 migrations** (a 42ª `crm_opportunities`, a 43ª `crm_actions`), e atualizar a linha correspondente no `MEMORY.md`.

- [ ] **Passo 7: commit e push da `staging`**

```bash
git add docs .claude/skills/architecture/SKILL.md docs/superpowers/plans/2026-11-03-crm-parte-2-backend.md
git commit -m "docs(crm): parte 2 pronta, status e specs atualizados"
git push origin staging
```

O PR de `staging` → `main` fica com o Jhones.
