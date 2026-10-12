import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { dentroDoTeto, inicioDoDiaEmSaoPaulo, passarParaEquipePorTeto } from "@/lib/conversations/teto"

/**
 * O teto diário de respostas da IA (evolution-demo-v1, comportamento 5),
 * contra o banco real, com clínicas temporárias.
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
// Datas no futuro, calculadas na execução: o pg_cron fecha a sessão parada
// e varre a resposta pendente. O teto conta pelo `created_at`, não por estas.
const DIA = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10)

type Clinica = { id: string; agente: string; paciente: string; conversa: string }
let A: Clinica
let B: Clinica
let mensagens = 0

async function montarClinica(rotulo: string, digito: string): Promise<Clinica> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (teto)`, status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1
  const { data: agente, error: e2 } = await admin
    .from("agents")
    .insert({
      clinic_id: clinica.id,
      name: `Recepção ${rotulo}`,
      specialty: "odontologia",
      whatsapp_phone_number_id: `7${SUFIXO}${digito}`,
      whatsapp_waba_id: `6${SUFIXO}${digito}`,
      whatsapp_access_token_encrypted: "blob-do-token-de-teste",
      status: "active",
    })
    .select("id")
    .single()
  if (e2) throw e2
  const { data: paciente, error: e3 } = await admin
    .from("patients")
    .insert({ clinic_id: clinica.id, whatsapp_phone_number: `+5500${SUFIXO.slice(-7)}${digito}` })
    .select("id")
    .single()
  if (e3) throw e3
  const base = { id: clinica.id, agente: agente.id, paciente: paciente.id }
  const primeira = await doPaciente(base)
  return { ...base, conversa: primeira.conversation_id }
}

async function doPaciente(c: { id: string; agente: string; paciente: string }) {
  mensagens += 1
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: c.paciente,
    p_wa_message_id: `wamid.teto.${SUFIXO}.${mensagens}`,
    p_author: "patient",
    p_media_type: "text",
    p_content_encrypted: "blob-da-mensagem",
    p_occurred_at: `${DIA}T10:00:${String(mensagens % 60).padStart(2, "0")}Z`,
  })
  if (error) throw error
  return data[0] as { conversation_id: string; message_id: string }
}

/** Uma resposta da IA, já enviada, a uma mensagem nova do paciente. `criadaEm` simula ontem. */
async function respostaDaIa(c: Clinica, criadaEm?: string) {
  const pergunta = await doPaciente(c)
  const { error } = await admin.from("messages").insert({
    clinic_id: c.id,
    conversation_id: c.conversa,
    direction: "outbound",
    author: "ai",
    media_type: "text",
    content_encrypted: "blob-da-resposta",
    occurred_at: `${DIA}T11:00:00Z`,
    delivery_status: "sent",
    category: "SERVICE",
    within_24h_window: true,
    billable: false,
    reply_to_message_id: pergunta.message_id,
    ...(criadaEm ? { created_at: criadaEm } : {}),
  })
  if (error) throw error
}

const agora = () => new Date().toISOString()

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("A", "1"), montarClinica("B", "2")])
})

afterAll(async () => {
  await admin.from("clinics").delete().in("id", [A.id, B.id])
})

describe("dentroDoTeto", () => {
  it("sem resposta hoje, está dentro", async () => {
    expect(await dentroDoTeto(A.id, 2, agora())).toBe(true)
  })

  it("resposta de ontem não conta", async () => {
    const ontem = new Date(new Date(inicioDoDiaEmSaoPaulo(agora())).getTime() - 60_000).toISOString()
    await respostaDaIa(A, ontem)
    await respostaDaIa(A, ontem)
    expect(await dentroDoTeto(A.id, 2, agora())).toBe(true)
  })

  it("resposta de outra clínica não conta", async () => {
    await Promise.all([respostaDaIa(B), respostaDaIa(B), respostaDaIa(B)])
    expect(await dentroDoTeto(A.id, 2, agora())).toBe(true)
    expect(await dentroDoTeto(B.id, 2, agora())).toBe(false)
  })

  it("abaixo do teto está dentro, e no teto está fora", async () => {
    await respostaDaIa(A)
    expect(await dentroDoTeto(A.id, 2, agora())).toBe(true)
    await respostaDaIa(A)
    expect(await dentroDoTeto(A.id, 2, agora())).toBe(false)
    expect(await dentroDoTeto(A.id, 3, agora())).toBe(true)
  })
})

describe("passarParaEquipePorTeto", () => {
  async function estado(c: Clinica) {
    const { data, error } = await admin
      .from("conversations")
      .select("handled_by, ai_failed_at")
      .eq("id", c.conversa)
      .single()
    if (error) throw error
    return data
  }

  it("não mexe em conversa de outra clínica", async () => {
    await passarParaEquipePorTeto(A.id, B.conversa)
    expect(await estado(B)).toEqual({ handled_by: "ai", ai_failed_at: null })
  })

  it("passa a conversa da clínica para a equipe, com o marco da falha", async () => {
    await passarParaEquipePorTeto(A.id, A.conversa)
    const depois = await estado(A)
    expect(depois.handled_by).toBe("human")
    expect(depois.ai_failed_at).not.toBeNull()
    expect(await estado(B)).toEqual({ handled_by: "ai", ai_failed_at: null })
  })
})
