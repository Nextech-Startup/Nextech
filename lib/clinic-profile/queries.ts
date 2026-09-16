import { requireClinicContext } from "@/lib/auth/context"
import { serviceContext } from "@/lib/auth/service-context"
import {
  CONSENT_TEXT_COLUMNS,
  INSURANCE_COLUMNS,
  PROCEDURE_COLUMNS,
  PROFESSIONAL_COLUMNS,
  SCHEDULING_POLICY_COLUMNS,
  URGENCY_RULE_COLUMNS,
  POLITICA_PADRAO,
  type ConsentText,
  type Insurance,
  type Procedure,
  type ProcedureComConvenios,
  type Professional,
  type ProfessionalComConvenios,
  type SchedulingPolicy,
  type UrgencyRule,
} from "./schema"

/** Identidade regulatória, lida junto com o que já existia em `clinics`. */
export type RegulatoryIdentity = {
  id: string
  legal_name: string
  cnpj: string | null
  status: "draft" | "active"
  technical_responsible_name: string | null
  technical_responsible_council: string | null
  technical_responsible_registration_number: string | null
  sanitary_license: string | null
}

const REGULATORY_COLUMNS =
  "id, legal_name, cnpj, status, technical_responsible_name, technical_responsible_council, technical_responsible_registration_number, sanitary_license"

/**
 * Identidade regulatória da clínica da sessão.
 *
 * Nenhuma função deste módulo recebe clinic_id: ele vem do vínculo do
 * usuário autenticado (regra 2 do CLAUDE.md), e a RLS é a segunda barreira.
 */
export async function getRegulatoryIdentity(): Promise<RegulatoryIdentity> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("clinics")
    .select(REGULATORY_COLUMNS)
    .eq("id", clinicId)
    .single()

  if (error) throw error
  return data as RegulatoryIdentity
}

// ---------------------------------------------------------------------------
// Convênios
// ---------------------------------------------------------------------------

/**
 * Convênios da clínica. `apenasAtivos` para os lugares que oferecem
 * escolha — um convênio desativado continua existindo para não invalidar
 * vínculo histórico, mas não deve aparecer como opção nova.
 */
export async function listInsurances(apenasAtivos = false): Promise<Insurance[]> {
  const { supabase, clinicId } = await requireClinicContext()

  let query = supabase
    .from("insurances")
    .select(INSURANCE_COLUMNS)
    .eq("clinic_id", clinicId)

  if (apenasAtivos) query = query.eq("active", true)

  const { data, error } = await query.order("name", { ascending: true })

  if (error) throw error
  return (data ?? []) as Insurance[]
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

/**
 * Equipe com os convênios de cada profissional.
 *
 * Os vínculos vêm numa segunda consulta, e não num join por linha: com N
 * profissionais, uma consulta por profissional seria o problema N+1 na
 * tela que a clínica mais abre.
 */
export async function listProfessionals(
  apenasAtivos = false,
): Promise<ProfessionalComConvenios[]> {
  const { supabase, clinicId } = await requireClinicContext()

  let query = supabase
    .from("professionals")
    .select(PROFESSIONAL_COLUMNS)
    .eq("clinic_id", clinicId)

  if (apenasAtivos) query = query.eq("active", true)

  const { data, error } = await query.order("name", { ascending: true })
  if (error) throw error

  const profissionais = (data ?? []) as Professional[]
  if (profissionais.length === 0) return []

  const { data: vinculos, error: erroVinculos } = await supabase
    .from("professional_insurances")
    .select("professional_id, insurance_id")
    .eq("clinic_id", clinicId)

  if (erroVinculos) throw erroVinculos

  const porProfissional = new Map<string, string[]>()
  for (const v of vinculos ?? []) {
    const lista = porProfissional.get(v.professional_id) ?? []
    lista.push(v.insurance_id)
    porProfissional.set(v.professional_id, lista)
  }

  return profissionais.map((p) => ({
    ...p,
    insurance_ids: porProfissional.get(p.id) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Procedimentos
// ---------------------------------------------------------------------------

export async function listProcedures(
  apenasAtivos = false,
): Promise<ProcedureComConvenios[]> {
  const { supabase, clinicId } = await requireClinicContext()

  let query = supabase
    .from("procedures")
    .select(PROCEDURE_COLUMNS)
    .eq("clinic_id", clinicId)

  if (apenasAtivos) query = query.eq("active", true)

  const { data, error } = await query.order("name", { ascending: true })
  if (error) throw error

  const procedimentos = (data ?? []) as Procedure[]
  if (procedimentos.length === 0) return []

  const { data: vinculos, error: erroVinculos } = await supabase
    .from("procedure_insurances")
    .select("procedure_id, insurance_id")
    .eq("clinic_id", clinicId)

  if (erroVinculos) throw erroVinculos

  const porProcedimento = new Map<string, string[]>()
  for (const v of vinculos ?? []) {
    const lista = porProcedimento.get(v.procedure_id) ?? []
    lista.push(v.insurance_id)
    porProcedimento.set(v.procedure_id, lista)
  }

  return procedimentos.map((p) => ({
    ...p,
    insurance_ids: porProcedimento.get(p.id) ?? [],
  }))
}

/**
 * Duração de um procedimento, para o motor de agendamento (fase 5).
 *
 * Roda no cron e no webhook, sem sessão, então o clinicId chega explícito
 * — e por isso entra no filtro à mão: service_role ignora RLS, e ler a
 * duração do procedimento de outra clínica montaria a agenda errada.
 *
 * Cai na duração padrão da política quando o procedimento não existe, em
 * vez de devolver null: o agendamento precisa de um número, e recusar o
 * agendamento porque o cadastro está incompleto seria pior do que usar o
 * bloco padrão que a própria clínica configurou.
 */
export async function getDuracaoDoProcedimento(
  clinicId: string,
  procedureId: string | null,
): Promise<number> {
  const { supabase } = serviceContext()

  if (procedureId) {
    const { data, error } = await supabase
      .from("procedures")
      .select("duration_minutes")
      .eq("id", procedureId)
      // service_role ignora RLS: o filtro por clínica é manual e obrigatório.
      .eq("clinic_id", clinicId)
      .maybeSingle()

    if (error) throw error
    if (data) return data.duration_minutes as number
  }

  const { data: politica, error: erroPolitica } = await supabase
    .from("scheduling_policies")
    .select("default_slot_duration_minutes")
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (erroPolitica) throw erroPolitica

  return (
    (politica?.default_slot_duration_minutes as number | undefined) ??
    POLITICA_PADRAO.default_slot_duration_minutes
  )
}

// ---------------------------------------------------------------------------
// Política de agendamento
// ---------------------------------------------------------------------------

/**
 * Política da clínica, ou os valores de partida se ela ainda não salvou
 * nenhuma. Nunca devolve null: todo consumidor precisaria repetir o mesmo
 * fallback, e um deles esqueceria.
 */
export async function getSchedulingPolicy(): Promise<SchedulingPolicy> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("scheduling_policies")
    .select(SCHEDULING_POLICY_COLUMNS)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (error) throw error

  return (data as SchedulingPolicy) ?? { clinic_id: clinicId, ...POLITICA_PADRAO }
}

// ---------------------------------------------------------------------------
// Triagem de urgência
// ---------------------------------------------------------------------------

export async function listUrgencyRules(): Promise<UrgencyRule[]> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("urgency_rules")
    .select(URGENCY_RULE_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as UrgencyRule[]
}

/**
 * Regras ATIVAS de uma clínica, para o motor de conversa (fase 3b).
 *
 * Roda no webhook, sem sessão. O filtro `active = true` é da consulta, e
 * não de quem chama: regra não confirmada pela clínica nunca deve
 * escalar, e depender de todo chamador lembrar disso é depender de ninguém
 * esquecer.
 */
export async function listActiveUrgencyRules(
  clinicId: string,
): Promise<UrgencyRule[]> {
  const { supabase } = serviceContext()

  const { data, error } = await supabase
    .from("urgency_rules")
    .select(URGENCY_RULE_COLUMNS)
    // service_role ignora RLS: sem este filtro, o protocolo de uma clínica
    // responderia ao paciente de outra.
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as UrgencyRule[]
}

// ---------------------------------------------------------------------------
// Consentimento
// ---------------------------------------------------------------------------

export async function getConsentText(): Promise<ConsentText | null> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("consent_texts")
    .select(CONSENT_TEXT_COLUMNS)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (error) throw error
  return (data as ConsentText) ?? null
}

/**
 * Termo de consentimento para o motor de conversa apresentar ao paciente.
 * Sem sessão — o gatilho é o paciente escrevendo pela primeira vez.
 */
export async function getConsentTextForClinic(
  clinicId: string,
): Promise<ConsentText | null> {
  const { supabase } = serviceContext()

  const { data, error } = await supabase
    .from("consent_texts")
    .select(CONSENT_TEXT_COLUMNS)
    // service_role ignora RLS: apresentar o termo de outra clínica ao
    // paciente seria pedir consentimento sobre o documento errado.
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (error) throw error
  return (data as ConsentText) ?? null
}
