import { z } from "zod"

/**
 * Conselhos de classe reconhecidos. Espelha o enum
 * `public.professional_council` da migration — a ordem importa só para a
 * UI, que lista nesta sequência.
 *
 * É atributo do PROFISSIONAL, não da clínica: clínica multi-especialidade
 * tem CRM, CRO e CREFITO na mesma equipe (edge case da spec).
 */
export const CONSELHOS = [
  "CRM",
  "CRO",
  "CREFITO",
  "CRP",
  "CRN",
  "COREN",
  "CREF",
  "CRFa",
  "CRBM",
  "CRMV",
  "OUTRO",
] as const

export type ProfessionalCouncil = (typeof CONSELHOS)[number]

/** Nome por extenso, para a UI não exibir só a sigla. */
export const ROTULO_DO_CONSELHO: Record<ProfessionalCouncil, string> = {
  CRM: "CRM — Medicina",
  CRO: "CRO — Odontologia",
  CREFITO: "CREFITO — Fisioterapia e Terapia Ocupacional",
  CRP: "CRP — Psicologia",
  CRN: "CRN — Nutrição",
  COREN: "COREN — Enfermagem",
  CREF: "CREF — Educação Física",
  CRFa: "CRFa — Fonoaudiologia",
  CRBM: "CRBM — Biomedicina",
  CRMV: "CRMV — Medicina Veterinária",
  OUTRO: "Outro conselho",
}

export const NO_SHOW_POLICIES = ["fee", "block_rebooking", "none"] as const
export type NoShowPolicy = (typeof NO_SHOW_POLICIES)[number]

export const ROTULO_DO_NO_SHOW: Record<NoShowPolicy, string> = {
  fee: "Cobrar taxa de falta",
  block_rebooking: "Bloquear novo agendamento",
  none: "Sem consequência",
}

const conselhoSchema = z.enum(CONSELHOS)

/**
 * Número que pode chegar como texto — que é o caso de todo campo numérico
 * de formulário HTML.
 *
 * Existe em vez de `z.coerce.number()` porque o tipo de ENTRADA do coerce
 * é `number`: a server action, que só tem strings em mãos, passaria a
 * mentir para o TypeScript. Aqui o tipo de entrada é honesto, e texto não
 * numérico vira NaN, que a validação seguinte recusa em vez de aceitar
 * como zero.
 */
const numeroDeFormulario = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : Number(v.trim())))

/** Texto opcional: campo em branco na tela chega como "" e vira null. */
const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)

/**
 * Conselho e número de registro formam um par.
 *
 * "CRM" sem número não identifica ninguém, e um número solto não diz de
 * qual conselho é. Os dois nulos é estado válido — a clínica preenche o
 * perfil aos poucos. A mesma regra está numa CHECK constraint: isto aqui
 * é para dar mensagem legível antes de o banco recusar.
 */
function exigeParConselho<
  T extends { council: string | null; registration_number: string | null },
>(valor: T, ctx: z.RefinementCtx) {
  if (valor.council && !valor.registration_number) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registration_number"],
      message: "Informe o número de registro no conselho.",
    })
  }
  if (valor.registration_number && !valor.council) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["council"],
      message: "Informe a qual conselho o registro pertence.",
    })
  }
}

// ---------------------------------------------------------------------------
// 1. Identidade regulatória
// ---------------------------------------------------------------------------

/**
 * `.strict()` em todos os schemas deste arquivo, pelo mesmo motivo de
 * `clinicUpdateSchema`: rejeita chave desconhecida, de modo que um
 * `clinic_id` ou `status` forjado no formulário não passe. O clinic_id
 * real vem sempre de `requireClinicContext()` (regra 2 do CLAUDE.md).
 */
export const regulatoryIdentitySchema = z
  .object({
    technical_responsible_name: textoOpcional,
    council: conselhoSchema.nullable().optional().transform((v) => v ?? null),
    registration_number: textoOpcional,
    sanitary_license: textoOpcional,
  })
  .strict()
  .superRefine(exigeParConselho)

export type RegulatoryIdentityInput = z.input<typeof regulatoryIdentitySchema>

/**
 * A clínica está pronta para sair de `draft`?
 *
 * Comportamento 2 da spec: CNPJ e responsável técnico são obrigatórios
 * para publicar o primeiro agente. Devolve o que falta, e não um booleano,
 * porque a tela precisa dizer o que preencher — "perfil incompleto" sem
 * dizer o quê obriga a clínica a adivinhar.
 *
 * A mesma regra está no trigger `clinics_enforce_activation`. Esta função
 * existe para a UI antecipar o resultado, não para substituí-lo.
 */
export function pendenciasRegulatorias(clinic: {
  cnpj: string | null
  technical_responsible_name: string | null
  technical_responsible_council: string | null
  technical_responsible_registration_number: string | null
}): string[] {
  const faltando: string[] = []

  if (!clinic.cnpj) faltando.push("CNPJ")
  if (!clinic.technical_responsible_name) {
    faltando.push("Nome do responsável técnico")
  }
  if (!clinic.technical_responsible_council) {
    faltando.push("Conselho do responsável técnico")
  }
  if (!clinic.technical_responsible_registration_number) {
    faltando.push("Número de registro do responsável técnico")
  }

  return faltando
}

// ---------------------------------------------------------------------------
// 2. Convênios
// ---------------------------------------------------------------------------

export const insuranceSchema = z
  .object({
    name: z.string().trim().min(1, "Nome do convênio é obrigatório").max(120),
    active: z.boolean().optional().default(true),
  })
  .strict()

export type InsuranceInput = z.input<typeof insuranceSchema>

export type Insurance = {
  id: string
  clinic_id: string
  name: string
  active: boolean
  created_at: string
}

export const INSURANCE_COLUMNS = "id, clinic_id, name, active, created_at"

// ---------------------------------------------------------------------------
// 3. Equipe
// ---------------------------------------------------------------------------

export const professionalSchema = z
  .object({
    name: z.string().trim().min(1, "Nome do profissional é obrigatório").max(160),
    specialty: textoOpcional,
    council: conselhoSchema.nullable().optional().transform((v) => v ?? null),
    registration_number: textoOpcional,
    // Só https: url http vazaria o caminho da foto em texto claro na rede,
    // e foto de pessoa identificável é PII.
    photo_url: z
      .string()
      .trim()
      .url("Endereço de foto inválido")
      .startsWith("https://", "A foto precisa estar em https")
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" || v === undefined ? null : v)),
    google_calendar_id: textoOpcional,
    active: z.boolean().optional().default(true),
    /** Convênios que ESTE profissional atende — pode diferir do resto da equipe. */
    insurance_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .strict()
  .superRefine(exigeParConselho)

export type ProfessionalInput = z.input<typeof professionalSchema>

export type Professional = {
  id: string
  clinic_id: string
  name: string
  specialty: string | null
  council: ProfessionalCouncil | null
  registration_number: string | null
  photo_url: string | null
  google_calendar_id: string | null
  active: boolean
  created_at: string
}

export type ProfessionalComConvenios = Professional & {
  insurance_ids: string[]
}

export const PROFESSIONAL_COLUMNS =
  "id, clinic_id, name, specialty, council, registration_number, photo_url, google_calendar_id, active, created_at"

// ---------------------------------------------------------------------------
// 4. Procedimentos
// ---------------------------------------------------------------------------

/**
 * Preço em reais, aceito como o brasileiro digita: `180,00`, `1.180,50`,
 * `180`. Vira número ou null.
 *
 * Existe porque `Number("1.180,50")` é `NaN` e `Number("180,00")` também
 * — e um preço que vira NaN silenciosamente viraria null no banco, ou
 * seja, "não divulgado" em vez de R$ 180.
 */
export function parsePreco(valor: string): number | null {
  const bruto = valor.trim()
  if (!bruto) return null

  // Separador decimal brasileiro: o último separador é o decimal, os
  // demais são de milhar.
  const normalizado = bruto
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")

  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero < 0) return null

  // Duas casas: centavos. Mais que isso é erro de digitação, não preço.
  return Math.round(numero * 100) / 100
}

export const procedureSchema = z
  .object({
    name: z.string().trim().min(1, "Nome do procedimento é obrigatório").max(160),
    specialty: textoOpcional,
    // O motor de agendamento (fase 5) consome esta duração. Sem ela não há
    // como montar horário, por isso não é opcional.
    //
    // Aceita número ou texto: o formulário HTML manda tudo como string.
    // Declarado como union em vez de `z.coerce.number()` porque o tipo de
    // ENTRADA de coerce é `number`, e a action passaria a mentir para o
    // TypeScript sobre o que realmente envia.
    duration_minutes: numeroDeFormulario
      .pipe(
        z
          .number()
          .int("Duração precisa ser um número inteiro de minutos")
          .min(1, "Duração precisa ser de pelo menos 1 minuto")
          .max(1440, "Duração não pode passar de 24 horas"),
      ),
    price: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .transform((v) => {
        if (v === null || v === undefined) return null
        return typeof v === "number" ? v : parsePreco(v)
      })
      .refine((v) => v === null || v >= 0, "Preço não pode ser negativo"),
    active: z.boolean().optional().default(true),
    /** Convênios que cobrem este procedimento. */
    insurance_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .strict()

export type ProcedureInput = z.input<typeof procedureSchema>

export type Procedure = {
  id: string
  clinic_id: string
  name: string
  specialty: string | null
  duration_minutes: number
  price: number | null
  active: boolean
  created_at: string
}

export type ProcedureComConvenios = Procedure & {
  insurance_ids: string[]
}

export const PROCEDURE_COLUMNS =
  "id, clinic_id, name, specialty, duration_minutes, price, active, created_at"

// ---------------------------------------------------------------------------
// 5. Política de agendamento
// ---------------------------------------------------------------------------

export const schedulingPolicySchema = z
  .object({
    default_slot_duration_minutes: numeroDeFormulario.pipe(
      z
        .number()
        .int()
        .min(1, "A duração padrão precisa ser de pelo menos 1 minuto")
        .max(1440, "A duração padrão não pode passar de 24 horas"),
    ),
    min_advance_hours: numeroDeFormulario.pipe(
      z
        .number()
        .int()
        .min(0, "A antecedência não pode ser negativa")
        .max(8760, "A antecedência não pode passar de um ano"),
    ),
    min_cancellation_hours: numeroDeFormulario.pipe(
      z
        .number()
        .int()
        .min(0, "O prazo de cancelamento não pode ser negativo")
        .max(8760, "O prazo de cancelamento não pode passar de um ano"),
    ),
    no_show_policy: z.enum(NO_SHOW_POLICIES),
  })
  .strict()

export type SchedulingPolicyInput = z.input<typeof schedulingPolicySchema>

export type SchedulingPolicy = {
  clinic_id: string
  default_slot_duration_minutes: number
  min_advance_hours: number
  min_cancellation_hours: number
  no_show_policy: NoShowPolicy
}

export const SCHEDULING_POLICY_COLUMNS =
  "clinic_id, default_slot_duration_minutes, min_advance_hours, min_cancellation_hours, no_show_policy"

/** Valores de partida quando a clínica ainda não configurou nada. */
export const POLITICA_PADRAO: Omit<SchedulingPolicy, "clinic_id"> = {
  default_slot_duration_minutes: 30,
  min_advance_hours: 2,
  min_cancellation_hours: 24,
  no_show_policy: "none",
}

// ---------------------------------------------------------------------------
// 6. Triagem de urgência
// ---------------------------------------------------------------------------

/**
 * Normaliza um termo de urgência para comparação: minúsculas, sem acento,
 * sem espaço duplicado.
 *
 * O paciente escreve "Dor No Peito", "dor no peito" e "dôr no peito" — e
 * uma regra de urgência que só casa com a grafia exata cadastrada falha
 * justamente no caso em que não pode falhar.
 */
export function normalizarTermo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Converte o textarea de palavras-chave em lista limpa.
 *
 * Aceita uma por linha ou separadas por vírgula. Descarta vazias e
 * duplicadas: uma palavra vazia casaria com QUALQUER mensagem e faria
 * toda conversa escalar como urgência.
 */
export function parseKeywords(bruto: string): string[] {
  const vistos = new Set<string>()
  const saida: string[] = []

  for (const pedaco of bruto.split(/[\n,;]/)) {
    const termo = pedaco.trim()
    if (!termo) continue

    // Deduplica pela forma normalizada: "Dor no peito" e "dor no peito"
    // são o mesmo termo, e guardar os dois só engorda a lista.
    const chave = normalizarTermo(termo)
    if (!chave || vistos.has(chave)) continue

    vistos.add(chave)
    saida.push(termo)
  }

  return saida
}

export const urgencyRuleSchema = z
  .object({
    label: z.string().trim().min(1, "Dê um nome à regra").max(120),
    keywords: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? parseKeywords(v.join("\n")) : parseKeywords(v)))
      .refine((v) => v.length > 0, "Informe ao menos uma palavra-chave"),
    protocol_message: z
      .string()
      .trim()
      .min(1, "O texto do protocolo é obrigatório")
      .max(4000),
  })
  .strict()

export type UrgencyRuleInput = z.input<typeof urgencyRuleSchema>

export type UrgencyRule = {
  id: string
  clinic_id: string
  label: string
  keywords: string[]
  protocol_message: string
  active: boolean
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
}

export const URGENCY_RULE_COLUMNS =
  "id, clinic_id, label, keywords, protocol_message, active, confirmed_by, confirmed_at, created_at"

/**
 * A mensagem do paciente dispara alguma destas regras?
 *
 * Só olha regra ATIVA: regra não confirmada pela clínica não escala nada.
 * Devolve a primeira que casar — escalar é escalar, não há grau.
 *
 * Compara sobre a forma normalizada dos dois lados, e por substring: o
 * paciente escreve "estou com uma dor no peito forte", não a palavra-chave
 * isolada.
 */
export function detectarUrgencia(
  mensagem: string,
  regras: readonly UrgencyRule[],
): UrgencyRule | null {
  const texto = normalizarTermo(mensagem)
  if (!texto) return null

  for (const regra of regras) {
    if (!regra.active) continue

    for (const keyword of regra.keywords) {
      const termo = normalizarTermo(keyword)
      if (termo && texto.includes(termo)) return regra
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// 7. Consentimento
// ---------------------------------------------------------------------------

/**
 * Prazo de retenção usado quando a clínica não definiu o próprio.
 *
 * A spec é explícita: cada conselho tem regra própria (o CFM exige 20 anos
 * para prontuário médico) e o produto não deve fixar um número. Este valor
 * é só o piso genérico da regra 5 de lgpd-security, e **perde** para o
 * `retention_years` da clínica sempre que ele existir — ver
 * `prazoDeRetencao`.
 */
export const RETENCAO_PADRAO_ANOS = 5

export const consentTextSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "O texto do termo é obrigatório")
      .max(20000),
    // Campo em branco é "não informado", e cai no default genérico. Por
    // isso não usa `z.coerce.number()`: ele converteria "" em 0, que seria
    // recusado como fora da faixa em vez de aceito como ausente.
    //
    // Texto não numérico vira NaN e é barrado pelo refine — "vinte" não
    // pode passar por "não informado", ou a clínica pensaria ter definido
    // 20 anos enquanto o sistema aplica o default.
    retention_years: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined) return null
        if (typeof v === "string") {
          const limpo = v.trim()
          if (limpo === "") return null
          return Number(limpo)
        }
        return v
      })
      .refine(
        (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 100),
        "O prazo de retenção precisa ser de 1 a 100 anos",
      ),
  })
  .strict()

export type ConsentTextInput = z.input<typeof consentTextSchema>

export type ConsentText = {
  clinic_id: string
  body: string
  retention_years: number | null
  version: number
  updated_at: string
}

export const CONSENT_TEXT_COLUMNS =
  "clinic_id, body, retention_years, version, updated_at"

/**
 * Prazo de retenção que vale para esta clínica.
 *
 * O valor da clínica PREVALECE sobre o default genérico (edge case da
 * spec). Existe como função, e não como leitura direta da coluna, para
 * que nenhum módulo futuro decida essa precedência por conta própria — o
 * risco é alguém apagar dado de prontuário antes do prazo do conselho.
 */
export function prazoDeRetencao(
  consent: { retention_years: number | null } | null,
): number {
  return consent?.retention_years ?? RETENCAO_PADRAO_ANOS
}
