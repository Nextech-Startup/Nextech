import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { buscarNaFila, carregarAvisosDeDesconexao, carregarConversa, carregarFila } from "@/lib/conversations/leitura"
import { ROTULO_DA_MIDIA, TEXTO_ILEGIVEL, TEXTO_REDIGIDO } from "@/lib/conversations/tela"
import {
  admin,
  anonClient,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  respostaDaIa,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * A leitura da tela de Conversas (parte 4 do motor), contra o banco real,
 * com o client logado de cada clínica: a mesma RLS da tela.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let conversa: string
let mensagemTrocada: string
let antiga: string
let buscada: string
let conversaB: string
let ultimaFalhou: string
let redigida: string
const TELEFONE_BUSCADO = `+5581977${String(Date.now()).slice(-6)}`

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("leitura-a", ["owner"]), montarClinica("leitura-b", ["owner"])])

  // A conversa urgente mais antiga de todas: entra na fila mesmo fora do limite.
  const pacienteAntigo = await novoPaciente(A)
  antiga = (await registrar(A, pacienteAntigo, { autor: "patient", texto: "Dor forte", em: emMinutos(-120) })).conversa
  await admin.from("conversations").update({ is_urgent: true, handled_by: "human" }).eq("id", antiga)

  // A conversa da busca: fora do limite, mais antiga que a principal.
  const pacienteBuscado = await novoPaciente(A, { nome: "Joana Buscável", telefone: TELEFONE_BUSCADO })
  buscada = (await registrar(A, pacienteBuscado, { autor: "patient", texto: "Oi", em: emMinutos(-60) })).conversa

  const paciente = await novoPaciente(A, { nome: "Paciente Principal" })
  const primeira = await registrar(A, paciente, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) })
  conversa = primeira.conversa
  await respostaDaIa(A, conversa, primeira.mensagem, { texto: "Claro!", em: emMinutos(1), status: "read" })
  const segunda = await registrar(A, paciente, { autor: "patient", texto: "Amanhã?", em: emMinutos(2) })
  await respostaDaIa(A, conversa, segunda.mensagem, { texto: "Temos às 15h", em: emMinutos(3), status: "failed" })
  const terceira = await registrar(A, paciente, { autor: "patient", midia: "audio", em: emMinutos(4) })
  await respostaDaIa(A, conversa, terceira.mensagem, { texto: "Recebi seu áudio", em: emMinutos(5), status: "pending" })
  mensagemTrocada = (await registrar(A, paciente, { autor: "patient", texto: "Segredo", em: emMinutos(6) })).mensagem

  // Cifrado com a clínica B: não decifra na A, por causa do AAD.
  const { error } = await admin
    .from("messages")
    .update({ content_encrypted: cifrarConteudo(B.id, "Segredo") })
    .eq("id", mensagemTrocada)
  if (error) throw error

  await admin
    .from("conversations")
    .update({ qualified_at: emMinutos(2), ai_failed_at: emMinutos(3), handled_by: "human" })
    .eq("id", conversa)

  const pacienteB = await novoPaciente(B)
  conversaB = (await registrar(B, pacienteB, { autor: "patient", texto: "Oi da B", em: emMinutos(0) })).conversa

  // A prévia na RPC da fila (conversation_queue). As duas são mais antigas
  // que a principal, para não mudar o "limite 1".
  // A última mensagem é a resposta da IA que não chegou ao paciente.
  const pacienteDaFalha = await novoPaciente(A, { nome: "Paciente da Falha" })
  const pergunta = await registrar(A, pacienteDaFalha, { autor: "patient", texto: "Tem horário amanhã?", em: emMinutos(-30) })
  ultimaFalhou = pergunta.conversa
  await respostaDaIa(A, ultimaFalhou, pergunta.mensagem, { texto: "Temos às 9h", em: emMinutos(-29), status: "failed" })

  // Paciente com convênio, e a última mensagem apagada a pedido dele.
  const { data: convenio, error: erroConvenio } = await admin
    .from("insurances")
    .insert({ clinic_id: A.id, name: "Convênio de Teste" })
    .select("id")
    .single()
  if (erroConvenio) throw erroConvenio
  const pacienteComConvenio = await novoPaciente(A, { nome: "Paciente com Convênio" })
  const { error: erroVinculo } = await admin.from("patients").update({ insurance_id: convenio.id }).eq("id", pacienteComConvenio)
  if (erroVinculo) throw erroVinculo
  const apagada = await registrar(A, pacienteComConvenio, { autor: "patient", texto: "Meu exame deu alterado", em: emMinutos(-40) })
  redigida = apagada.conversa
  const { error: erroRedacao } = await admin
    .from("messages")
    .update({ content_encrypted: null, content_redacted_at: new Date().toISOString() })
    .eq("id", apagada.mensagem)
  if (erroRedacao) throw erroRedacao
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("carregarConversa", () => {
  it("decifra, mantém a ordem do tempo e marca a entrega de cada resposta", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const aberta = await carregarConversa(owner as never, A.id, conversa)
    const logs = JSON.stringify(espiao.mock.calls)
    espiao.mockRestore()

    expect(aberta).not.toBeNull()
    const mensagens = aberta!.itens.filter((i) => i.tipo === "mensagem")
    expect(mensagens.map((m) => m.texto)).toEqual([
      "Quero marcar",
      "Claro!",
      "Amanhã?",
      "Temos às 15h",
      ROTULO_DA_MIDIA.audio,
      "Recebi seu áudio",
      TEXTO_ILEGIVEL,
    ])
    expect(mensagens[3]).toMatchObject({ entrega: "nao-entregue" })
    expect(mensagens[4]).toMatchObject({ midia: "audio" })
    expect(mensagens[5]).toMatchObject({ entrega: "enviando" })

    // A decifra que falhou loga só o tipo e a conversa, nunca o conteúdo.
    expect(logs).toContain("Falha ao decifrar mensagem")
    expect(logs).not.toContain("Segredo")
    expect(logs).not.toMatch(/AQ[A-Za-z0-9+/]{20,}/)
  })

  it("inclui os eventos de qualificação e de falha, e o do painel com o e-mail", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    await admin.from("conversations").update({ handled_by: "ai" }).eq("id", conversa)
    const { data } = await owner.rpc("assume_conversation", { p_conversation_id: conversa })
    expect(data).toBe("ok")

    const aberta = await carregarConversa(owner as never, A.id, conversa)
    // A ordem entre eles é do teste unitário: aqui, o evento do painel tem
    // a hora de agora, e as mensagens do cenário estão no futuro.
    const eventos = aberta!.itens.filter((i) => i.tipo === "evento")
    expect(eventos.map((e) => e.tipo === "evento" && e.evento).sort()).toEqual(
      ["falha_da_ia", "humano_assumiu", "qualificado"],
    )
    expect(eventos.find((e) => e.tipo === "evento" && e.evento === "humano_assumiu")).toMatchObject({
      detalhe: A.equipe.owner!.email,
    })
  })

  it("com exatamente o limite de mensagens, não há corte", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const aberta = await carregarConversa(owner as never, A.id, conversa, { limite: 7 })
    expect(aberta!.itens.filter((i) => i.tipo === "mensagem")).toHaveLength(7)
    expect(aberta!.historicoCortado).toBeUndefined()
    const cortada = await carregarConversa(owner as never, A.id, conversa, { limite: 6 })
    expect(cortada!.historicoCortado).toBe(true)
  })

  it("com limite, traz as mais recentes e avisa que cortou", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const aberta = await carregarConversa(owner as never, A.id, conversa, { limite: 2 })
    const mensagens = aberta!.itens.filter((i) => i.tipo === "mensagem")
    expect(mensagens.map((m) => m.texto)).toEqual(["Recebi seu áudio", TEXTO_ILEGIVEL])
    expect(aberta!.historicoCortado).toBe(true)
  })
})

describe("carregarFila", () => {
  it("com limite 1, a urgente antiga entra junto da mais recente", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const fila = await carregarFila(owner as never, A.id, { limite: 1 })
    expect(fila.map((c) => c.id).sort()).toEqual([antiga, conversa].sort())
    const principal = fila.find((c) => c.id === conversa)!
    // A prévia é a última mensagem visível, já decifrada (aqui, a ilegível).
    expect(principal.ultima).toMatchObject({ autor: "patient", previa: TEXTO_ILEGIVEL })
    expect(principal.paciente.nome).toBe("Paciente Principal")
  })

  // Antes, duas idas em série (as conversas e, com os ids, as prévias):
  // ~600 ms rodando do Brasil contra o Supabase em Oregon.
  it("sai numa ida só ao banco, pela RPC da fila, por POST", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const chamadas: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
      chamadas.push(`${init?.method ?? "GET"} ${new URL(String(entrada)).pathname}`)
      return original(entrada, init)
    }
    try {
      await carregarFila(owner as never, A.id)
    } finally {
      globalThis.fetch = original
    }
    expect(chamadas).toEqual(["POST /rest/v1/rpc/conversation_queue"])
  })

  it("traz o agente, o paciente e o estado de cada conversa", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const [fila, agente, paciente] = await Promise.all([
      carregarFila(owner as never, A.id),
      admin.from("conversations").select("agente:agents(name)").eq("id", conversa).single(),
      admin.from("conversations").select("paciente:patients(id, whatsapp_phone_number, created_at)").eq("id", conversa).single(),
    ])
    const principal = fila.find((c) => c.id === conversa)!
    const p = paciente.data!.paciente as unknown as { id: string; whatsapp_phone_number: string; created_at: string }
    expect(principal.agente).toBe((agente.data!.agente as unknown as { name: string }).name)
    expect(principal.paciente).toMatchObject({ id: p.id, telefone: p.whatsapp_phone_number, convenio: null, optOut: false })
    expect(new Date(principal.paciente.desde).getTime()).toBe(new Date(p.created_at).getTime())
    expect(principal).toMatchObject({ atendidaPor: "human", urgente: false })
    expect(fila.find((c) => c.id === antiga)).toMatchObject({ urgente: true, atendidaPor: "human" })
    expect(fila.map((c) => c.id).sort()).toEqual([antiga, buscada, conversa, ultimaFalhou, redigida].sort())
  })

  it("a resposta da IA que não chegou não vira prévia: fica a última que o paciente viu", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const fila = await carregarFila(owner as never, A.id)
    expect(fila.find((c) => c.id === ultimaFalhou)?.ultima).toMatchObject({ autor: "patient", previa: "Tem horário amanhã?" })
  })

  it("traz o convênio do paciente, e a prévia apagada a pedido dele não mostra o conteúdo", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const fila = await carregarFila(owner as never, A.id)
    const comConvenio = fila.find((c) => c.id === redigida)!
    expect(comConvenio.paciente.convenio).toBe("Convênio de Teste")
    expect(comConvenio.ultima).toMatchObject({ autor: "patient", previa: TEXTO_REDIGIDO })
    expect(JSON.stringify(fila)).not.toContain("Meu exame deu alterado")
  })
})

describe("buscarNaFila (por POST)", () => {
  it.each([
    ["pelo nome, sem maiúscula", "joana"],
    ["pelos 4 últimos dígitos", TELEFONE_BUSCADO.slice(-4)],
  ])("a busca %s acha a conversa fora das mais recentes", async (_caso, busca) => {
    const owner = await comoUsuario(A.equipe.owner!)
    const achadas = await buscarNaFila(owner as never, A.id, busca)
    expect(achadas.map((c) => c.id)).toEqual([buscada])
    expect(achadas[0].paciente.nome).toBe("Joana Buscável")
  })

  it.each([
    // Sem o escape, "%Jo%na%" casaria "Joana Buscável".
    ["curinga de LIKE escapado", "Jo%na"],
    ["sublinhado escapado", "Joana_"],
    ["termo sem busca possível", "81"],
  ])("%s não casa tudo", async (_caso, busca) => {
    const owner = await comoUsuario(A.equipe.owner!)
    expect(await buscarNaFila(owner as never, A.id, busca)).toEqual([])
  })

  it("o termo vai no corpo do POST da RPC, e nunca na URL", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const chamadas: { url: string; metodo: string; corpo: string }[] = []
    const original = globalThis.fetch
    globalThis.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
      chamadas.push({ url: String(entrada), metodo: init?.method ?? "GET", corpo: String(init?.body ?? "") })
      return original(entrada, init)
    }
    try {
      await buscarNaFila(owner as never, A.id, "Joana")
    } finally {
      globalThis.fetch = original
    }
    expect(chamadas.some((c) => c.metodo === "POST" && c.url.includes("/rpc/search_conversations") && c.corpo.includes("Joana"))).toBe(true)
    for (const c of chamadas) expect(decodeURIComponent(c.url)).not.toMatch(/joana/i)
  })

  it("outra clínica não acha, com qualquer clínica no filtro; anônimo e service_role não chamam", async () => {
    const ownerB = await comoUsuario(B.equipe.owner!)
    expect(await buscarNaFila(ownerB as never, A.id, "joana")).toEqual([])
    expect(await buscarNaFila(ownerB as never, B.id, "joana")).toEqual([])
    for (const cliente of [anonClient(), admin]) {
      const { data, error } = await cliente.rpc("search_conversations", { p_clinic_id: A.id, p_nome: "%joana%", p_telefone: null })
      expect(error).not.toBeNull()
      expect(data).toBeNull()
    }
  })
})

describe("isolamento", () => {
  it("o client de B, pedindo a clínica A, não recebe nada", async () => {
    const ownerB = await comoUsuario(B.equipe.owner!)
    expect(await carregarFila(ownerB as never, A.id)).toEqual([])
    expect(await carregarConversa(ownerB as never, A.id, conversa)).toBeNull()
  })

  it("anônimo e service_role não chamam a RPC da fila", async () => {
    for (const cliente of [anonClient(), admin]) {
      const { data, error } = await cliente.rpc("conversation_queue", { p_clinic_id: A.id, p_limit: 10 })
      expect(error).not.toBeNull()
      expect(data).toBeNull()
    }
  })

  it("com o próprio clinicId e o id da conversa de A, também não", async () => {
    const ownerB = await comoUsuario(B.equipe.owner!)
    expect(await carregarConversa(ownerB as never, B.id, conversa)).toBeNull()
    const fila = await carregarFila(ownerB as never, B.id)
    expect(fila.map((c) => c.id)).toEqual([conversaB])
  })
})

describe("carregarAvisosDeDesconexao", () => {
  it("avisa a desconexão da Meta e some depois da reconexão", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: `teste-painel-${Date.now()}` })
      .eq("id", A.agente)
    await admin.from("whatsapp_account_events").insert({
      clinic_id: A.id,
      agent_id: A.agente,
      event: "ACCOUNT_OFFBOARDED",
      agent_status_before: "draft",
      occurred_at: emMinutos(10),
    })
    expect(await carregarAvisosDeDesconexao(owner as never, A.id)).toEqual([
      { agenteId: A.agente, agente: "Recepção leitura-a", desde: expect.any(String) },
    ])

    await admin.from("whatsapp_account_events").insert({
      clinic_id: A.id,
      agent_id: A.agente,
      event: "ACCOUNT_RECONNECTED",
      occurred_at: emMinutos(20),
    })
    expect(await carregarAvisosDeDesconexao(owner as never, A.id)).toEqual([])
  })
})
