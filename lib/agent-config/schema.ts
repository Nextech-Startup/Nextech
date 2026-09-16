import { z } from "zod"

/**
 * Validação e vocabulário do agente de IA.
 *
 * Espelha `supabase/migrations/20260916240000_agent_config.sql`. Onde o
 * banco tem CHECK, aqui tem a mesma regra — não por duplicação, mas para
 * dar mensagem legível antes de o Postgres recusar com um texto que
 * ninguém deveria ler numa tela.
 */

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

/**
 * Catálogo de especialidades do Nextech, espelhando o enum
 * `public.medical_specialty` e `components/especialidades.tsx` da landing.
 *
 * Não se confunde com o conselho de classe (`professional_council` em
 * lib/clinic-profile): conselho é o registro de uma pessoa, especialidade
 * é o tipo de atendimento que o agente conduz.
 */
export const ESPECIALIDADES = [
  "clinicas_medicas",
  "odontologia",
  "estetica_dermato",
  "laboratorios",
  "nutricao",
  "fisioterapia",
  "saude_mental",
] as const

export type MedicalSpecialty = (typeof ESPECIALIDADES)[number]

export const ROTULO_DA_ESPECIALIDADE: Record<MedicalSpecialty, string> = {
  clinicas_medicas: "Clínicas Médicas",
  odontologia: "Odontologia",
  estetica_dermato: "Estética & Dermato",
  laboratorios: "Laboratórios",
  nutricao: "Nutrição",
  fisioterapia: "Fisioterapia",
  saude_mental: "Saúde Mental",
}

export const STATUS_DE_AGENTE = ["draft", "active", "paused"] as const
export type AgentStatus = (typeof STATUS_DE_AGENTE)[number]

export const ROTULO_DO_STATUS: Record<AgentStatus, string> = {
  draft: "rascunho",
  active: "ativo",
  paused: "pausado",
}

export const PLANOS = ["starter", "pro", "healthtech"] as const
export type ClinicPlan = (typeof PLANOS)[number]

export const ROTULO_DO_PLANO: Record<ClinicPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  healthtech: "HealthTech",
}

/**
 * Quantos agentes cada plano permite. `null` = ilimitado.
 *
 * Espelha `private.agent_plan_limit()`. A trava real é o trigger no banco
 * — este mapa existe para a tela poder dizer "1 de 1 agente" antes de o
 * usuário preencher um formulário que seria recusado no fim.
 */
export const LIMITE_DE_AGENTES: Record<ClinicPlan, number | null> = {
  starter: 1,
  pro: 3,
  healthtech: null,
}

export function podeCriarAgente(plano: ClinicPlan, atuais: number): boolean {
  const limite = LIMITE_DE_AGENTES[plano]
  return limite === null || atuais < limite
}

// ---------------------------------------------------------------------------
// Horário de atendimento
// ---------------------------------------------------------------------------

export const DIAS = [
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
  "dom",
] as const

export type Dia = (typeof DIAS)[number]

export const ROTULO_DO_DIA: Record<Dia, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
}

/** "HH:MM" em 24h. O formato que um <input type="time"> devolve. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

const faixaDoDia = z
  .object({
    open: z.boolean(),
    // Presentes mesmo com open=false: fechar um dia não deve apagar o
    // horário que a clínica já tinha configurado nele.
    start: z.string().regex(HORA, "Horário inválido (use HH:MM)."),
    end: z.string().regex(HORA, "Horário inválido (use HH:MM)."),
  })
  .strict()
  .refine((d) => !d.open || d.start < d.end, {
    message: "O fim do atendimento precisa ser depois do início.",
    path: ["end"],
  })

/**
 * Horário de atendimento humano, por dia da semana.
 *
 * Serve ao handoff: é como o motor de conversa (fase 3b) sabe se há
 * alguém para receber a transferência agora. Fora dessa janela a IA
 * responde que a equipe retorna no próximo horário.
 *
 * Comparação lexicográfica de "HH:MM" funciona porque o formato é
 * zero-padded e de tamanho fixo — "09:00" < "17:30" como string.
 */
export const businessHoursSchema = z.record(z.enum(DIAS), faixaDoDia)

export type BusinessHours = z.infer<typeof businessHoursSchema>

/** Comercial padrão, para um agente recém-criado não nascer vazio. */
export const HORARIO_PADRAO: BusinessHours = {
  seg: { open: true, start: "08:00", end: "18:00" },
  ter: { open: true, start: "08:00", end: "18:00" },
  qua: { open: true, start: "08:00", end: "18:00" },
  qui: { open: true, start: "08:00", end: "18:00" },
  sex: { open: true, start: "08:00", end: "18:00" },
  sab: { open: false, start: "08:00", end: "12:00" },
  dom: { open: false, start: "08:00", end: "12:00" },
}

/**
 * Lê o horário vindo do banco, onde é `jsonb` e pode ser qualquer coisa.
 *
 * Nunca lança: um horário malformado — de uma versão anterior do formato,
 * ou de escrita por service_role — não deve impedir a tela de abrir. Cai
 * no padrão, que a clínica corrige vendo.
 */
export function lerBusinessHours(bruto: unknown): BusinessHours {
  const parsed = businessHoursSchema.safeParse(bruto)
  if (!parsed.success) return HORARIO_PADRAO
  return { ...HORARIO_PADRAO, ...parsed.data }
}

// ---------------------------------------------------------------------------
// Campos de texto
// ---------------------------------------------------------------------------

/** Campo em branco na tela chega como "" e vira null. */
const textoOpcional = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)

// ---------------------------------------------------------------------------
// Agente
// ---------------------------------------------------------------------------

/**
 * `.strict()` pelo mesmo motivo de todo schema deste projeto: rejeita
 * chave desconhecida, de modo que um `clinic_id` ou `status` forjado no
 * formulário não chegue à mutation. O clinic_id real vem sempre de
 * `requireClinicContext()` (regra 2 do CLAUDE.md), e o status só muda
 * pelas mutations de publicar/pausar.
 */
export const agentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Dê um nome ao agente.")
      .max(120, "Nome: no máximo 120 caracteres."),

    specialty: z.enum(ESPECIALIDADES, {
      errorMap: () => ({ message: "Escolha a especialidade do agente." }),
    }),

    persona_instructions: textoOpcional(4000, "Persona"),
    greeting_message: textoOpcional(1000, "Saudação"),

    business_hours: businessHoursSchema.default(HORARIO_PADRAO),

    handoff_enabled: z.boolean().default(false),
    handoff_message: textoOpcional(1000, "Mensagem de transferência"),
  })
  .strict()
  // Mesma regra da constraint `agents_handoff_completo`: handoff ligado
  // sem mensagem deixaria a IA transferir em silêncio, e o paciente veria
  // a conversa parar sem explicação.
  .refine((a) => !a.handoff_enabled || a.handoff_message !== null, {
    message:
      "Escreva a mensagem que o paciente recebe ao ser transferido para um atendente.",
    path: ["handoff_message"],
  })

export type AgentInput = z.input<typeof agentSchema>
export type AgentParsed = z.output<typeof agentSchema>

// ---------------------------------------------------------------------------
// Credenciais da Meta
// ---------------------------------------------------------------------------

/**
 * O que a clínica cola ao conectar o WhatsApp.
 *
 * Os três chegam juntos: conectar é um ato só. O token sai daqui direto
 * para `cifrarSegredo()` e nunca volta para a tela (regra 7 de
 * lgpd-security) — por isso não existe schema de "edição parcial" que
 * permitiria alterar o número mantendo o token antigo.
 */
export const whatsappCredentialsSchema = z
  .object({
    whatsapp_phone_number_id: z
      .string()
      .trim()
      .min(1, "Informe o Phone Number ID do WhatsApp.")
      // Ids da Meta são numéricos. Validar o formato evita que um erro de
      // cópia vire um UNIQUE ocupado por lixo.
      .regex(/^\d{5,25}$/, "O Phone Number ID da Meta é só dígitos."),

    whatsapp_waba_id: z
      .string()
      .trim()
      .min(1, "Informe o WABA ID da sua conta na Meta.")
      .regex(/^\d{5,25}$/, "O WABA ID da Meta é só dígitos."),

    whatsapp_access_token: z
      .string()
      .trim()
      .min(20, "O token de acesso parece incompleto."),
  })
  .strict()

export type WhatsappCredentialsInput = z.input<typeof whatsappCredentialsSchema>

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Colunas lidas do banco.
 *
 * `whatsapp_access_token_encrypted` NÃO está aqui, e não é descuido: a
 * coluna está fora do grant de SELECT de `authenticated`, então pedi-la
 * faria a consulta inteira falhar com `permission denied`. Um `select *`
 * falha pelo mesmo motivo — descoberto testando contra o banco real.
 *
 * É a garantia funcionando: a aplicação da clínica não tem como ler o
 * token de volta, nem cifrado.
 */
export const AGENT_COLUMNS =
  "id, clinic_id, name, specialty, persona_instructions, greeting_message, " +
  "business_hours, handoff_enabled, handoff_message, whatsapp_phone_number_id, " +
  "whatsapp_waba_id, status, first_published_at, created_at, updated_at"

export type Agent = {
  id: string
  clinic_id: string
  name: string
  specialty: MedicalSpecialty
  persona_instructions: string | null
  greeting_message: string | null
  business_hours: unknown
  handoff_enabled: boolean
  handoff_message: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_waba_id: string | null
  status: AgentStatus
  first_published_at: string | null
  created_at: string
  updated_at: string
}

/**
 * O agente tem WhatsApp conectado?
 *
 * Só o `phone_number_id` responde, porque é a única coluna visível à
 * aplicação — o token, por construção, não é legível daqui. A constraint
 * `agents_credenciais_coerentes` garante que um número gravado sem token
 * não existe, então a pergunta é honesta.
 */
export function estaConectado(agent: Agent): boolean {
  return agent.whatsapp_phone_number_id !== null
}

/**
 * O que IMPEDE este agente de ser publicado.
 *
 * Só o que o trigger `private.agent_enforce_publish()` de fato recusa —
 * hoje, a conexão do WhatsApp. A tela antecipa a recusa do banco; ela não
 * inventa regra própria, senão o botão ficaria desabilitado por um motivo
 * que `service_role` ignora, e as duas camadas diriam coisas diferentes
 * sobre o que "pode publicar" significa.
 *
 * Lista vazia = pode publicar. O que é recomendável mas não bloqueia está
 * em `recomendacoesAntesDePublicar`.
 */
export function pendenciasParaPublicar(agent: Agent): string[] {
  const pendencias: string[] = []

  if (!estaConectado(agent)) {
    pendencias.push("Conecte um número de WhatsApp.")
  }

  return pendencias
}

/**
 * O que é ruim publicar sem, mas não impede.
 *
 * Um agente sem saudação nem persona responde — só responde mal. Bloquear
 * seria inventar uma regra que o banco não tem; ficar calado deixaria a
 * clínica descobrir pelo paciente. Então avisa, e deixa publicar.
 */
export function recomendacoesAntesDePublicar(agent: Agent): string[] {
  const avisos: string[] = []

  if (!agent.greeting_message) {
    avisos.push("Sem mensagem de saudação, o agente abre a conversa sem se apresentar.")
  }
  if (!agent.persona_instructions) {
    avisos.push("Sem persona, o tom das respostas fica por conta do modelo.")
  }

  return avisos
}
