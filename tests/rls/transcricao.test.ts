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
} from "@/tests/fixtures/clinica-de-conversas"

/**
 * Transcrição do áudio no banco (motor de conversa, parte 5b, tarefa 4),
 * contra o Supabase real: só o service_role grava, só com consentimento, a
 * equipe lê o texto cifrado só da própria clínica, e a exclusão do
 * paciente apaga a transcrição.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
const TRANSCRICAO = "queria marcar uma limpeza para sexta"

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("transcricao-a"), montarClinica("transcricao-b")])
})
afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B)])
})

async function audioDoPaciente(c: ClinicaDeTeste, consentimento: boolean, minuto: number) {
  const paciente = await novoPaciente(c)
  if (consentimento) {
    const { error } = await admin.from("patients").update({ consent_given_at: emMinutos(minuto) }).eq("id", paciente)
    if (error) throw error
  }
  const { mensagem, conversa } = await registrar(c, paciente, { autor: "patient", midia: "audio", em: emMinutos(minuto) })
  return { paciente, mensagem, conversa }
}

const gravar = (cliente: typeof admin, clinica: string, mensagem: string, texto = TRANSCRICAO) =>
  cliente.rpc("save_message_transcript", {
    p_clinic_id: clinica,
    p_message_id: mensagem,
    p_transcript_encrypted: cifrarConteudo(clinica, texto),
  })

async function transcricaoGravada(mensagem: string): Promise<string | null> {
  const { data, error } = await admin.from("messages").select("transcript_encrypted").eq("id", mensagem).single()
  if (error) throw error
  return data.transcript_encrypted
}

describe("save_message_transcript", () => {
  it("com consentimento, o service_role grava a transcrição cifrada", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 1)
    const { data, error } = await gravar(admin, A.id, mensagem)
    expect(error).toBeNull()
    expect(data).toBe(true)
    const gravada = await transcricaoGravada(mensagem)
    expect(gravada).not.toContain("limpeza")
    expect(decifrarConteudo(A.id, gravada!)).toBe(TRANSCRICAO)
  })

  it("sem consentimento, recusa sem erro e não grava", async () => {
    const { mensagem } = await audioDoPaciente(A, false, 2)
    const { data, error } = await gravar(admin, A.id, mensagem)
    expect(error).toBeNull()
    expect(data).toBe(false)
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })

  it("a equipe e o anon não chamam a função", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 3)
    const dono = await comoUsuario(A.equipe.owner!)
    expect((await gravar(dono as typeof admin, A.id, mensagem)).error?.code).toBe("42501")
    expect((await gravar(anonClient() as typeof admin, A.id, mensagem)).error?.code).toBe("42501")
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })

  it("mensagem de outra clínica não é gravada pelo clinic_id errado", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 4)
    expect((await gravar(admin, B.id, mensagem)).data).toBe(false)
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })

  it("mensagem de texto não recebe transcrição", async () => {
    const paciente = await novoPaciente(A)
    await admin.from("patients").update({ consent_given_at: emMinutos(5) }).eq("id", paciente)
    const { mensagem } = await registrar(A, paciente, { autor: "patient", texto: "oi", em: emMinutos(5) })
    expect((await gravar(admin, A.id, mensagem)).data).toBe(false)
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })

  it("o banco recusa transcrição fora de áudio do paciente, mesmo pela escrita direta", async () => {
    const paciente = await novoPaciente(A)
    const { mensagem } = await registrar(A, paciente, { autor: "patient", texto: "oi", em: emMinutos(6) })
    const { error } = await admin.from("messages").update({ transcript_encrypted: "blob" }).eq("id", mensagem)
    expect(error?.code).toBe("23514")
  })

  it("transcrição vazia é recusada", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 7)
    const { error } = await admin.rpc("save_message_transcript", {
      p_clinic_id: A.id,
      p_message_id: mensagem,
      p_transcript_encrypted: "",
    })
    expect(error?.code).toBe("22023")
  })
})

describe("leitura pela equipe", () => {
  it("o membro lê a transcrição cifrada da própria clínica, e não a de outra", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 8)
    await gravar(admin, A.id, mensagem)

    const deA = await comoUsuario(A.equipe.owner!)
    const propria = await deA.from("messages").select("transcript_encrypted").eq("id", mensagem).single()
    expect(propria.error).toBeNull()
    expect(decifrarConteudo(A.id, propria.data!.transcript_encrypted)).toBe(TRANSCRICAO)

    const deB = await comoUsuario(B.equipe.owner!)
    const alheia = await deB.from("messages").select("transcript_encrypted").eq("id", mensagem)
    expect(alheia.data).toEqual([])
  })

  it("a equipe não escreve a transcrição direto", async () => {
    const { mensagem } = await audioDoPaciente(A, true, 9)
    const dono = await comoUsuario(A.equipe.owner!)
    const { error } = await dono.from("messages").update({ transcript_encrypted: "blob" }).eq("id", mensagem)
    // A equipe só tem SELECT em messages: a escrita nem chega à RLS.
    expect(error?.code).toBe("42501")
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })
})

describe("direito de exclusão", () => {
  const marcador = () => `+999${String(Date.now()).slice(-11).padStart(11, "0")}`

  it("anonimizar apaga a transcrição, e depois disso nada mais é gravado", async () => {
    const { paciente, mensagem } = await audioDoPaciente(A, true, 10)
    await gravar(admin, A.id, mensagem)
    expect(await transcricaoGravada(mensagem)).not.toBeNull()

    const dono = await comoUsuario(A.equipe.owner!)
    const { error } = await dono.rpc("anonymize_patient", { p_patient_id: paciente, p_phone_marker: marcador() })
    expect(error).toBeNull()
    expect(await transcricaoGravada(mensagem)).toBeNull()

    // A execução que transcreveu antes da exclusão não grava depois dela.
    expect((await gravar(admin, A.id, mensagem)).data).toBe(false)
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })

  it("a exclusão é só a anonimização: redact_patient_messages não existe mais", async () => {
    const dono = await comoUsuario(A.equipe.owner!)
    const { paciente } = await audioDoPaciente(A, true, 11)
    const { error } = await dono.rpc("redact_patient_messages", { p_patient_id: paciente })
    // PGRST202: a função não está no schema (apagada em 20261103130000).
    expect(error?.code).toBe("PGRST202")
  })

  it("paciente anonimizado não recebe transcrição, mesmo com o consentimento ainda preenchido", async () => {
    const { paciente, mensagem } = await audioDoPaciente(A, true, 12)
    // Estado que a anonimização não produz (ela zera o consentimento): a
    // condição `anonymized_at is null` da função é a única que barra aqui.
    const { error } = await admin.from("patients").update({ anonymized_at: emMinutos(12) }).eq("id", paciente)
    if (error) throw error
    expect((await gravar(admin, A.id, mensagem)).data).toBe(false)
    expect(await transcricaoGravada(mensagem)).toBeNull()
  })
})
