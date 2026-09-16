import { serviceContext } from "@/lib/auth/service-context"
import { requireClinicContext } from "@/lib/auth/context"
import {
  patientIdentifySchema,
  patientUpdateSchema,
  PATIENT_COLUMNS,
  type Patient,
  type PatientIdentifyInput,
  type PatientUpdateInput,
} from "./schema"

/** Violação de restrição unique no Postgres. */
const UNIQUE_VIOLATION = "23505"

/**
 * Encontra ou cria o paciente do número que acabou de escrever.
 *
 * Roda no webhook do WhatsApp, onde não existe sessão: o `clinicId` foi
 * resolvido a partir do próprio dado da mensagem (phone_number_id ->
 * agente -> clínica) e chega explícito, porque o client de service_role
 * ignora RLS e o banco não vai filtrar nada aqui.
 *
 * Idempotente por (clinic_id, telefone): duas mensagens do mesmo paciente
 * chegando juntas não podem virar dois cadastros. O `select` antes do
 * `insert` não basta — entre um e outro a outra requisição insere. Por
 * isso a violação de unique é tratada como caminho normal, não como erro:
 * significa que a corrida foi perdida, e o vencedor já criou o cadastro
 * que queríamos.
 */
export async function identifyPatient(
  clinicId: string,
  input: PatientIdentifyInput,
): Promise<Patient> {
  const { whatsapp_phone_number, name } = patientIdentifySchema.parse(input)
  const { supabase } = serviceContext()

  const existente = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("whatsapp_phone_number", whatsapp_phone_number)
    .maybeSingle()

  if (existente.data) return existente.data as Patient

  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      whatsapp_phone_number,
      // Só grava o nome se veio; não sobrescreve nada, porque aqui a linha
      // está nascendo.
      ...(name ? { name } : {}),
    })
    .select(PATIENT_COLUMNS)
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // Corrida perdida: outra requisição criou entre o select e o insert.
      const { data: vencedor, error: erroLeitura } = await supabase
        .from("patients")
        .select(PATIENT_COLUMNS)
        .eq("clinic_id", clinicId)
        .eq("whatsapp_phone_number", whatsapp_phone_number)
        .single()

      if (erroLeitura) throw erroLeitura
      return vencedor as Patient
    }
    throw error
  }

  return data as Patient
}

/**
 * Marca que o paciente escreveu agora.
 *
 * Só para mensagem RECEBIDA. Chamar isto quando a IA responde faria a
 * clínica nunca enxergar um paciente inativo: a própria sequência de
 * reativação reiniciaria o relógio que ela usa para decidir quem alcançar.
 */
export async function touchLastContact(
  clinicId: string,
  patientId: string,
): Promise<void> {
  const { supabase } = serviceContext()

  const { error } = await supabase
    .from("patients")
    .update({ last_contact_at: new Date().toISOString() })
    .eq("id", patientId)
    // service_role ignora RLS: sem este filtro, um id de outra clínica
    // escreveria na linha dela. E esta é a coluna que decide quem a
    // sequência de reativação alcança.
    .eq("clinic_id", clinicId)

  if (error) throw error
}

/**
 * Registra o consentimento do paciente ao texto da clínica.
 *
 * Não regrava se já existe: a data do primeiro aceite é a que vale como
 * prova, e sobrescrevê-la a cada nova conversa apagaria desde quando o
 * consentimento existe.
 */
export async function registerConsent(
  clinicId: string,
  patientId: string,
): Promise<void> {
  const { supabase } = serviceContext()

  const { error } = await supabase
    .from("patients")
    .update({ consent_given_at: new Date().toISOString() })
    .eq("id", patientId)
    // service_role ignora RLS. Sem este filtro, um id de outra clínica
    // gravaria consentimento que aquele paciente nunca deu — e é este
    // campo que a regra 3 de lgpd-security consulta para decidir se pode
    // persistir transcrição de áudio.
    .eq("clinic_id", clinicId)
    .is("consent_given_at", null)

  if (error) throw error
}

/**
 * Opt-out de sequências (regra 8 de lgpd-security).
 *
 * Vale imediatamente e em todas as sequências, não só naquela em que o
 * paciente respondeu. Roda com service_role porque o gatilho normal é o
 * paciente respondendo "PARAR" no WhatsApp — não há sessão nenhuma.
 */
export async function optOut(clinicId: string, patientId: string): Promise<void> {
  const { supabase } = serviceContext()

  const { error } = await supabase
    .from("patients")
    .update({ opted_out: true })
    .eq("id", patientId)
    // service_role ignora RLS: o clinic_id precisa vir no filtro à mão.
    .eq("clinic_id", clinicId)

  if (error) throw error
}

/**
 * Desfaz o opt-out. Exige sessão e papel de `owner` de propósito: a regra
 * 8 diz que o sistema nunca reativa sozinho — só ação explícita da
 * clínica. Por isso não roda com service_role, ao contrário de `optOut`.
 */
export async function undoOptOut(patientId: string): Promise<void> {
  const { supabase, clinicId, role } = await requireClinicContext()

  if (role !== "owner") {
    throw new Error("Apenas o owner reverte o opt-out de um paciente.")
  }

  const { error } = await supabase
    .from("patients")
    .update({ opted_out: false })
    .eq("id", patientId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

/**
 * Edição manual pela tela da clínica: corrigir nome, vincular convênio.
 * O telefone não é editável — ver `patientUpdateSchema`.
 */
export async function updatePatient(
  patientId: string,
  input: PatientUpdateInput,
): Promise<Patient> {
  const { supabase, clinicId } = await requireClinicContext()
  const parsed = patientUpdateSchema.parse(input)

  const { data, error } = await supabase
    .from("patients")
    .update(parsed)
    .eq("id", patientId)
    // Redundante com a RLS, e deliberado: sem isto, um id de outra clínica
    // viraria um update silencioso de zero linhas em vez de um erro.
    .eq("clinic_id", clinicId)
    .select(PATIENT_COLUMNS)
    .single()

  if (error) throw error
  return data as Patient
}

/**
 * Direito de exclusão da LGPD.
 *
 * Anonimiza em vez de apagar: a linha sustenta referências de conversa e
 * agendamento, e apagá-la levaria junto o histórico de atendimento da
 * clínica, que tem base legal própria para existir. O que sai é a PII.
 *
 * O telefone vira um marcador único e irreversível — não pode ser nulo
 * (a coluna é `not null`) nem repetido (a restrição unique), e precisa
 * não parecer um telefone real para ninguém tentar escrever para ele.
 * `opted_out` fica true para que nenhuma sequência futura o alcance.
 */
export async function anonymizePatient(patientId: string): Promise<void> {
  const { supabase, clinicId, role } = await requireClinicContext()

  if (role !== "owner") {
    throw new Error("Apenas o owner atende a um pedido de exclusão de dado.")
  }

  // Deriva do próprio id, que já é único: a restrição unique passa a ser
  // garantida por construção, e não improvável por sorte como seria com
  // timestamp e random. 14 dígitos hexadecimais convertidos para decimal
  // cabem no limite de E.164 (15 dígitos com o prefixo 999).
  const marcador = BigInt(`0x${patientId.replace(/-/g, "").slice(0, 9)}`)
    .toString()
    .padStart(11, "0")
    .slice(0, 11)

  const { error } = await supabase
    .from("patients")
    .update({
      // O + e os dígitos satisfazem o check de E.164; o prefixo 999 não é
      // país nenhum, então nunca colide com número real.
      whatsapp_phone_number: `+999${marcador}`,
      name: null,
      consent_given_at: null,
      opted_out: true,
    })
    .eq("id", patientId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}
