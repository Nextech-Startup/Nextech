import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminAction } from "@/lib/admin/audit"
import { HORARIO_PADRAO } from "@/lib/agent-config/schema"
import { hashDoConteudo } from "@/lib/clinic-profile/mutations"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { PREFIXO_DO_CANAL } from "@/lib/whatsapp/evolution-webhook"
import { CanalRecusado, contaDaEquipe, exigirClinicaDeDemonstracao, falha, NOME_DO_AGENTE } from "./comum"

/**
 * Conecta o canal de demonstração antes da apresentação
 * (docs/specs/evolution-demo-v1.md, "Conexão e limpeza"):
 * - cria ou atualiza, na clínica de demonstração, o agente do canal, com
 *   persona, saudação e horário fictícios, ligado à instância da Evolution
 *   e publicado;
 * - garante a regra de urgência "Dor forte" ativa, com palavras e protocolo
 *   fictícios e a confirmação completa;
 * - grava a conexão na trilha.
 *
 * Idempotente: rodar de novo deixa o mesmo estado. O token da instância é
 * credencial do agente e fica cifrado (lgpd-security, regra 7); não vai
 * para a trilha nem para a saída do script.
 */

const CONEXAO: AdminAction = "clinic.demo_channel_connect"
const INSTANCIA = /^[A-Za-z0-9_-]{1,64}$/

export const AGENTE_DO_CANAL = {
  name: NOME_DO_AGENTE,
  specialty: "odontologia",
  persona_instructions:
    "Você é a recepção da Clínica Demonstração Nextech, uma clínica fictícia usada para mostrar o atendimento pelo WhatsApp. Responda com cordialidade e objetividade, ajude a marcar avaliações e passe para a equipe quando o paciente relatar dor forte.",
  greeting_message: "Olá! Aqui é a recepção da Clínica Demonstração Nextech. Como posso ajudar?",
  business_hours: { ...HORARIO_PADRAO, sab: { open: true, start: "08:00", end: "12:00" } },
  handoff_enabled: true,
  handoff_message: "Vou chamar alguém da nossa equipe para continuar com você.",
} as const

export const REGRA_DE_URGENCIA = {
  label: "Dor forte",
  keywords: ["dor forte", "dor muito forte", "sangramento", "inchaço no rosto"],
  protocol_message:
    "Entendi que é urgente. Já avisei a equipe da clínica, que vai falar com você em instantes. Se a dor estiver muito forte ou houver sangramento que não para, procure o pronto-socorro mais próximo.",
}

export type RelatorioDaConexao = { agente: "criado" | "atualizado"; regra: "criada" | "ja-existia" }

export async function conectarCanalDeDemonstracao(
  db: SupabaseClient,
  p: {
    clinicId: string
    instancia: string
    tokenDaInstancia: string
    confirmadorEmail: string
    dominioDaEquipe?: string
  },
): Promise<RelatorioDaConexao> {
  // Tudo que pode recusar vem antes da primeira escrita.
  if (!INSTANCIA.test(p.instancia)) throw new CanalRecusado("Nome de instância inválido.")
  if (!p.tokenDaInstancia.trim()) throw new CanalRecusado("Falta o token da instância.")
  await exigirClinicaDeDemonstracao(db, p.clinicId)
  const confirmador = await contaDaEquipe(db, p.confirmadorEmail, p.dominioDaEquipe)

  const canal = `${PREFIXO_DO_CANAL}${p.instancia}`
  const conexao = {
    ...AGENTE_DO_CANAL,
    whatsapp_phone_number_id: canal,
    // Sem WABA na Evolution: o mesmo identificador, que a recepção confere.
    whatsapp_waba_id: canal,
    whatsapp_access_token_encrypted: cifrarSegredo(p.tokenDaInstancia.trim()),
    status: "active",
  }

  const { data: existente, error: erroLeitura } = await db
    .from("agents")
    .select("id")
    .eq("clinic_id", p.clinicId)
    .eq("name", NOME_DO_AGENTE)
    .maybeSingle()
  if (erroLeitura) throw falha("ler o agente do canal", erroLeitura)

  let agente: RelatorioDaConexao["agente"]
  if (existente) {
    const { error } = await db.from("agents").update(conexao).eq("id", existente.id).eq("clinic_id", p.clinicId)
    if (error) throw falha("atualizar o agente do canal", error)
    agente = "atualizado"
  } else {
    const { error } = await db.from("agents").insert({ ...conexao, clinic_id: p.clinicId })
    if (error) throw falha("criar o agente do canal", error)
    agente = "criado"
  }

  const regra = await garantirRegraDeUrgencia(db, p.clinicId, confirmador)

  const { error: erroTrilha } = await db.from("admin_audit_log").insert({
    actor_user_id: confirmador,
    action: CONEXAO,
    clinic_id: p.clinicId,
    metadata: { agente, regra },
  })
  if (erroTrilha) throw falha("registrar na trilha de auditoria", erroTrilha)

  return { agente, regra }
}

/**
 * A regra fica com o conteúdo daqui, ativa e confirmada pelo hash do
 * conteúdo: o gatilho do banco derruba a confirmação que não bate com ele.
 */
async function garantirRegraDeUrgencia(
  db: SupabaseClient,
  clinicId: string,
  confirmador: string,
): Promise<RelatorioDaConexao["regra"]> {
  const confirmada = {
    ...REGRA_DE_URGENCIA,
    active: true,
    confirmed_by: confirmador,
    confirmed_at: new Date().toISOString(),
    confirmed_content_hash: hashDoConteudo(REGRA_DE_URGENCIA.protocol_message, REGRA_DE_URGENCIA.keywords),
  }

  const { data: existente, error: erroLeitura } = await db
    .from("urgency_rules")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("label", REGRA_DE_URGENCIA.label)
    .maybeSingle()
  if (erroLeitura) throw falha("ler a regra de urgência", erroLeitura)

  if (existente) {
    const { error } = await db.from("urgency_rules").update(confirmada).eq("id", existente.id).eq("clinic_id", clinicId)
    if (error) throw falha("atualizar a regra de urgência", error)
    return "ja-existia"
  }
  const { error } = await db.from("urgency_rules").insert({ ...confirmada, clinic_id: clinicId })
  if (error) throw falha("criar a regra de urgência", error)
  return "criada"
}
