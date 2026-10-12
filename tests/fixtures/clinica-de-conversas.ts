import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { ClinicRole } from "@/lib/auth/context"
import { cifrarConteudo } from "@/lib/conversations/conteudo"

/**
 * Cenário dos testes de banco da tela de Conversas (parte 4 do motor):
 * clínica com equipe, agente, pacientes e conversas gravadas pelo mesmo
 * caminho do webhook (`register_whatsapp_message`, com `service_role`).
 *
 * As datas ficam no futuro, calculadas na execução: o pg_cron real fecha
 * sessão parada há mais de 1h20 e varre resposta `pending` com mais de
 * 5 min no meio da rodada.
 */

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
}

/** Amanhã, à hora cheia, mais `minutos`. */
const BASE = (() => {
  const d = new Date(Date.now() + 24 * 3_600_000)
  d.setUTCMinutes(0, 0, 0)
  return d.getTime()
})()
export const emMinutos = (minutos: number) => new Date(BASE + minutos * 60_000).toISOString()

export type Usuario = { id: string; email: string; password: string }

const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

export async function criarUsuario(rotulo: string): Promise<Usuario> {
  const email = `teste-painel-${rotulo}-${sufixo}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

// Um login por usuário no arquivo inteiro: um por caso esgota o limite de
// requisições do Supabase Auth quando a suíte roda toda. O vitest isola os
// módulos por arquivo, então o cache também é por arquivo.
const sessoes = new Map<string, Promise<SupabaseClient>>()

export function comoUsuario(u: Usuario): Promise<SupabaseClient> {
  let sessao = sessoes.get(u.email)
  if (!sessao) {
    sessao = (async () => {
      const client = anonClient()
      const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password })
      if (error) throw error
      return client
    })()
    sessoes.set(u.email, sessao)
  }
  return sessao
}

export type ClinicaDeTeste = {
  id: string
  agente: string
  equipe: Partial<Record<ClinicRole, Usuario>>
  /** Usuários criados aqui, para apagar no fim. */
  usuarios: Usuario[]
}

export async function montarClinica(rotulo: string, papeis: readonly ClinicRole[] = ["owner"]): Promise<ClinicaDeTeste> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (painel de conversas)`, status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1

  const equipe: ClinicaDeTeste["equipe"] = {}
  const usuarios: Usuario[] = []
  for (const papel of papeis) {
    const u = await criarUsuario(`${rotulo}-${papel}`)
    usuarios.push(u)
    equipe[papel] = u
    const { error } = await admin.from("clinic_members").insert({ clinic_id: clinica.id, user_id: u.id, role: papel })
    if (error) throw error
  }

  const { data: agente, error: e2 } = await admin
    .from("agents")
    .insert({ clinic_id: clinica.id, name: `Recepção ${rotulo}`, specialty: "odontologia" })
    .select("id")
    .single()
  if (e2) throw e2

  return { id: clinica.id, agente: agente.id, equipe, usuarios }
}

let contador = 0

export async function novoPaciente(
  c: Pick<ClinicaDeTeste, "id">,
  p: { nome?: string | null; telefone?: string } = {},
): Promise<string> {
  contador++
  const telefone = p.telefone ?? `+55819${String(Date.now()).slice(-6)}${String(contador).padStart(2, "0")}`
  const { data, error } = await admin
    .from("patients")
    .insert({ clinic_id: c.id, whatsapp_phone_number: telefone, name: p.nome ?? null })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** Mensagem do paciente ou eco da equipe, pelo caminho do webhook. */
export async function registrar(
  c: Pick<ClinicaDeTeste, "id" | "agente">,
  paciente: string,
  m: { autor: "patient" | "human"; texto?: string; midia?: "text" | "audio"; em: string },
): Promise<{ conversa: string; mensagem: string }> {
  contador++
  const midia = m.midia ?? "text"
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: paciente,
    p_wa_message_id: `wamid.painel.${sufixo}.${contador}`,
    p_author: m.autor,
    p_media_type: midia,
    p_content_encrypted: m.texto ? cifrarConteudo(c.id, m.texto) : null,
    p_occurred_at: m.em,
  })
  if (error) throw error
  return { conversa: data[0].conversation_id, mensagem: data[0].message_id }
}

/** Resposta da IA já com a instrumentação que o banco exige. */
export async function respostaDaIa(
  c: Pick<ClinicaDeTeste, "id">,
  conversa: string,
  respondeA: string,
  r: { texto: string; em: string; status: "pending" | "sent" | "read" | "failed" },
): Promise<string> {
  contador++
  const { data, error } = await admin
    .from("messages")
    .insert({
      clinic_id: c.id,
      conversation_id: conversa,
      direction: "outbound",
      author: "ai",
      wa_message_id: r.status === "pending" ? null : `wamid.painel.ia.${sufixo}.${contador}`,
      content_encrypted: cifrarConteudo(c.id, r.texto),
      media_type: "text",
      occurred_at: r.em,
      delivery_status: r.status,
      delivery_error_code: r.status === "failed" ? "131047" : null,
      category: "SERVICE",
      within_24h_window: true,
      billable: false,
      reply_to_message_id: respondeA,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** Conversas, mensagens e eventos caem em cascata com a clínica; os usuários, depois. */
export async function limparClinica(c: ClinicaDeTeste | undefined): Promise<void> {
  if (!c) return
  await admin.from("agents").delete().eq("clinic_id", c.id)
  await admin.from("clinics").delete().eq("id", c.id)
  for (const u of c.usuarios) await admin.auth.admin.deleteUser(u.id)
}
