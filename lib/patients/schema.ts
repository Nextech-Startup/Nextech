import { z } from "zod"

/** Formato aceito pelo banco e pela Cloud API: E.164. */
const E164 = /^\+[1-9][0-9]{7,14}$/

/**
 * Normaliza um telefone brasileiro para E.164.
 *
 * Existe porque o critério de aceite exige não duplicar paciente por
 * número já existente, e o mesmo número chega escrito de formas
 * diferentes: `(81) 99911-2895` digitado pela recepção, `5581999112895`
 * vindo da Cloud API, `+55 81 99911-2895` colado de algum lugar. Sem uma
 * forma canônica, cada variação viraria um cadastro.
 *
 * Devolve `null` quando não dá para afirmar qual é o número — nunca um
 * palpite. Um palpite errado aqui manda mensagem para outra pessoa.
 */
export function normalizarTelefone(valor: string): string | null {
  const bruto = valor.trim()
  if (!bruto) return null

  // O + só vale na primeira posição; no meio, é lixo de digitação.
  const temMais = bruto.startsWith("+")
  const digitos = bruto.replace(/\D/g, "")
  if (!digitos) return null

  // Já veio internacional: confia no que foi declarado, só valida.
  if (temMais) {
    const candidato = `+${digitos}`
    return E164.test(candidato) ? candidato : null
  }

  // Sem o +, o único país que sabemos assumir é o Brasil — é o mercado do
  // produto. Qualquer outro precisa vir com + explícito.
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    // 55 + DDD (2) + número (8 ou 9)
    return `+${digitos}`
  }

  // Número nacional com DDD, sem o código do país.
  if (digitos.length === 10 || digitos.length === 11) {
    return `+55${digitos}`
  }

  // 8 ou 9 dígitos é número sem DDD: não dá para saber a região, e chutar
  // o DDD da clínica mandaria mensagem para o número errado em outra cidade.
  return null
}

/**
 * Entrada do primeiro contato, vinda do webhook do WhatsApp.
 *
 * `.strict()` pelo mesmo motivo de `clinicUpdateSchema`: o `clinic_id`
 * nunca vem daqui — vem do contexto do servidor (regra 2 do CLAUDE.md).
 */
export const patientIdentifySchema = z
  .object({
    whatsapp_phone_number: z
      .string()
      .transform((v) => normalizarTelefone(v))
      .refine((v): v is string => v !== null, "Número de WhatsApp inválido"),
    name: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type PatientIdentifyInput = z.input<typeof patientIdentifySchema>

/**
 * Edição manual, pela tela da clínica. O telefone fica de fora: é o
 * identificador do cadastro, e trocá-lo significaria fundir ou dividir
 * pacientes — decisão que a v1 não tomou (ver "Em aberto" na spec).
 */
export const patientUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Nome não pode ficar vazio").nullable(),
    insurance_id: z.string().uuid("Convênio inválido").nullable(),
  })
  .partial()
  .strict()

export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>

export type Patient = {
  id: string
  clinic_id: string
  whatsapp_phone_number: string
  name: string | null
  insurance_id: string | null
  created_at: string
  last_contact_at: string
  consent_given_at: string | null
  opted_out: boolean
}

/** Colunas lidas em toda consulta de paciente. */
export const PATIENT_COLUMNS =
  "id, clinic_id, whatsapp_phone_number, name, insurance_id, created_at, last_contact_at, consent_given_at, opted_out"

/**
 * Mascara o telefone para exibição em log ou tela de suporte.
 * Regra 1 de lgpd-security: metadado sim, PII em texto puro não.
 */
export function mascararTelefone(e164: string): string {
  if (e164.length < 4) return "***"
  return `${e164.slice(0, 3)}${"*".repeat(e164.length - 6)}${e164.slice(-3)}`
}
