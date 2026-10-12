import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { carregarConversa, carregarFila } from "@/lib/conversations/leitura"
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
 * A leitura do painel confere o token só pela assinatura (getClaims): um
 * logout em outro lugar, a troca de senha ou o banimento não param o token
 * já emitido até ele vencer (até 1 h). Quem fecha essa janela é o banco: as
 * funções de acesso da RLS exigem que a sessão do token ainda exista em
 * auth.sessions, e que o usuário não esteja banido. Vale para o app, para o
 * PostgREST direto e para o Realtime.
 *
 * Este arquivo faz dois logins do mesmo owner (são duas sessões, é o que se
 * testa) e um do staff.
 */

let C: ClinicaDeTeste
let conversa: string
/** A sessão que vai ficar com o token antigo. */
let antiga: SupabaseClient
let tokenAntigo: string

beforeAll(async () => {
  C = await montarClinica("sessao-ativa", ["owner", "staff"])
  const paciente = await novoPaciente(C, { nome: "Paciente da Sessão" })
  conversa = (await registrar(C, paciente, { autor: "patient", texto: "Oi", em: emMinutos(0) })).conversa

  antiga = anonClient()
  const { data, error } = await antiga.auth.signInWithPassword({ email: C.equipe.owner!.email, password: C.equipe.owner!.password })
  if (error) throw error
  tokenAntigo = data.session!.access_token
}, 60_000)

afterAll(async () => {
  await limparClinica(C)
}, 60_000)

/** Um client que só manda este token, sem renovar nada. */
const comToken = (token: string) =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

describe("sessão viva", () => {
  it("com a sessão aberta, o membro lê o vínculo, a fila e a conversa", async () => {
    const cliente = comToken(tokenAntigo)
    const { data: vinculo } = await cliente.from("clinic_members").select("clinic_id").eq("clinic_id", C.id)
    // O owner e o staff.
    expect(vinculo).toHaveLength(2)
    expect((await carregarFila(cliente as never, C.id)).map((c) => c.id)).toEqual([conversa])
    expect(await carregarConversa(cliente as never, C.id, conversa)).not.toBeNull()
  })

  it("depois do logout global em outra sessão, o token antigo, ainda bem assinado, não lê nem age", async () => {
    // Outra sessão do mesmo owner sai de todas.
    const outra = anonClient()
    const { error } = await outra.auth.signInWithPassword({ email: C.equipe.owner!.email, password: C.equipe.owner!.password })
    if (error) throw error
    await outra.auth.signOut({ scope: "global" })

    // A assinatura e a validade do token continuam boas: é a conferência
    // local que a leitura do app faz.
    const { data: claims } = await antiga.auth.getClaims(tokenAntigo)
    expect(claims?.claims.sub).toBe(C.equipe.owner!.id)

    // O banco recusa assim mesmo.
    const cliente = comToken(tokenAntigo)
    const { data: vinculo } = await cliente.from("clinic_members").select("clinic_id").eq("clinic_id", C.id)
    expect(vinculo).toEqual([])
    const { data: pacientes } = await cliente.from("patients").select("id").eq("clinic_id", C.id)
    expect(pacientes).toEqual([])
    expect(await carregarFila(cliente as never, C.id)).toEqual([])
    expect(await carregarConversa(cliente as never, C.id, conversa)).toBeNull()

    // As ações do painel e a gestão da equipe também param.
    const { data: assumir } = await cliente.rpc("assume_conversation", { p_conversation_id: conversa })
    expect(assumir).toBe("nao-encontrada")
    const { data: removidos } = await cliente.from("clinic_members").delete().eq("user_id", C.equipe.staff!.id).select("user_id")
    expect(removidos ?? []).toEqual([])
    const { count } = await admin.from("clinic_members").select("*", { count: "exact", head: true }).eq("clinic_id", C.id)
    expect(count).toBe(2)
  })

  it("usuário banido não lê, mesmo com a sessão aberta", async () => {
    const staff = await comoUsuario(C.equipe.staff!)
    const { data: antes } = await staff.from("clinic_members").select("clinic_id").eq("clinic_id", C.id)
    expect(antes).toHaveLength(2)

    const { error } = await admin.auth.admin.updateUserById(C.equipe.staff!.id, { ban_duration: "1h" })
    if (error) throw error
    const { data: depois } = await staff.from("clinic_members").select("clinic_id").eq("clinic_id", C.id)
    expect(depois ?? []).toEqual([])
  })

  it("sem token de usuário, nada muda: o anônimo continua sem acesso", async () => {
    const { data } = await anonClient().from("clinic_members").select("clinic_id").eq("clinic_id", C.id)
    expect(data).toEqual([])
  })
})
