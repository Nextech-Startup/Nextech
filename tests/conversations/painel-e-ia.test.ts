import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import {
  admin,
  comoUsuario,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * As ações do painel encadeadas com a resposta da IA (conversation-engine-v1,
 * comportamento 3; parte 4, decisão 7), contra o banco real: a reserva da
 * resposta é a palavra final, e ela precisa enxergar o que a equipe fez.
 *
 * Datas no relógio real, e não no futuro: a ação do painel grava now(), e a
 * retomada em 24h conta dele.
 */

const PHONE = `teste-painel-ia-${Date.now()}`
let A: ClinicaDeTeste
let paciente: string
let conversa: string
let primeira: string

const minutosAtras = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/** A reserva que a resposta da IA pede antes de enviar, como em lib/conversations/resposta.ts. */
async function reservar(mensagem: string) {
  const { data, error } = await admin.rpc("reserve_ai_reply", {
    p_clinic_id: A.id,
    p_conversation_id: conversa,
    p_reply_to_message_id: mensagem,
    p_content_encrypted: cifrarConteudo(A.id, "Resposta da IA"),
    p_occurred_at: new Date().toISOString(),
    p_within_window: true,
    p_billable: false,
    p_phone_number_id: PHONE,
  })
  if (error) throw error
  return (data as { message_id: string | null; motivo: string | null }[])[0]
}

beforeAll(async () => {
  A = await montarClinica("painel-ia", ["owner"])
  const { error } = await admin
    .from("agents")
    .update({
      whatsapp_phone_number_id: PHONE,
      whatsapp_waba_id: "102290129340398",
      whatsapp_access_token_encrypted: cifrarSegredo("token-de-teste"),
      persona_instructions: "Seja acolhedor.",
      greeting_message: "Olá!",
      status: "active",
    })
    .eq("id", A.agente)
  if (error) throw error

  paciente = await novoPaciente(A)
  const r = await registrar(A, paciente, { autor: "patient", texto: "Quero marcar", em: minutosAtras(3) })
  conversa = r.conversa
  primeira = r.mensagem
}, 60_000)

afterAll(async () => {
  await limparClinica(A)
}, 60_000)

describe("o painel e a reserva da resposta da IA", () => {
  it("depois de assumir pelo painel, a reserva recusa: a equipe está atendendo", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data } = await owner.rpc("assume_conversation", { p_conversation_id: conversa })
    expect(data).toBe("ok")
    expect(await reservar(primeira)).toMatchObject({ message_id: null, motivo: "humano-atendendo" })
  })

  it("depois de devolver, a próxima mensagem do paciente é reservada, e a anterior não", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data } = await owner.rpc("return_conversation_to_ai", { p_conversation_id: conversa })
    expect(data).toBe("ok")

    const segunda = (await registrar(A, paciente, { autor: "patient", texto: "Amanhã cedo?", em: minutosAtras(1) })).mensagem
    const reservada = await reservar(segunda)
    expect(reservada.motivo).toBeNull()
    expect(reservada.message_id).toEqual(expect.any(String))

    // A pendente de antes da devolução não responde: o paciente já escreveu de novo.
    expect((await reservar(primeira)).motivo).not.toBeNull()
  })
})
