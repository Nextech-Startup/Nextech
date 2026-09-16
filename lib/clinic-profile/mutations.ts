import { createHash } from "node:crypto"
import { requireClinicContext } from "@/lib/auth/context"
import {
  consentTextSchema,
  insuranceSchema,
  procedureSchema,
  professionalSchema,
  regulatoryIdentitySchema,
  schedulingPolicySchema,
  urgencyRuleSchema,
  CONSENT_TEXT_COLUMNS,
  INSURANCE_COLUMNS,
  PROCEDURE_COLUMNS,
  PROFESSIONAL_COLUMNS,
  SCHEDULING_POLICY_COLUMNS,
  URGENCY_RULE_COLUMNS,
  type ConsentText,
  type ConsentTextInput,
  type Insurance,
  type InsuranceInput,
  type Procedure,
  type ProcedureInput,
  type Professional,
  type ProfessionalInput,
  type RegulatoryIdentityInput,
  type SchedulingPolicy,
  type SchedulingPolicyInput,
  type UrgencyRule,
  type UrgencyRuleInput,
} from "./schema"

/**
 * Escrita no perfil é sempre do owner.
 *
 * Perfil regulatório, equipe e — sobretudo — protocolo de urgência não são
 * edição de rotina de recepção. As policies de RLS já exigem o mesmo; esta
 * checagem existe para dar erro legível antes de o banco recusar, e para
 * que a intenção fique explícita no código.
 */
async function contextoDeEdicao() {
  const ctx = await requireClinicContext()
  if (ctx.role !== "owner") {
    throw new Error("Apenas o responsável pela clínica edita o perfil.")
  }
  return ctx
}

// ---------------------------------------------------------------------------
// 1. Identidade regulatória
// ---------------------------------------------------------------------------

export async function updateRegulatoryIdentity(
  input: RegulatoryIdentityInput,
): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = regulatoryIdentitySchema.parse(input)

  const { error } = await supabase
    .from("clinics")
    .update({
      technical_responsible_name: parsed.technical_responsible_name,
      technical_responsible_council: parsed.council,
      technical_responsible_registration_number: parsed.registration_number,
      sanitary_license: parsed.sanitary_license,
    })
    .eq("id", clinicId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// 2. Convênios
// ---------------------------------------------------------------------------

export async function createInsurance(input: InsuranceInput): Promise<Insurance> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = insuranceSchema.parse(input)

  const { data, error } = await supabase
    .from("insurances")
    // O clinic_id vem do contexto, nunca do input — o schema é .strict()
    // justamente para que um clinic_id forjado no formulário não chegue aqui.
    .insert({ clinic_id: clinicId, ...parsed })
    .select(INSURANCE_COLUMNS)
    .single()

  if (error) throw error
  return data as Insurance
}

export async function updateInsurance(
  insuranceId: string,
  input: InsuranceInput,
): Promise<Insurance> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = insuranceSchema.parse(input)

  const { data, error } = await supabase
    .from("insurances")
    .update(parsed)
    .eq("id", insuranceId)
    // Redundante com a RLS, e deliberado: sem isto, um id de outra clínica
    // viraria update silencioso de zero linhas em vez de erro.
    .eq("clinic_id", clinicId)
    .select(INSURANCE_COLUMNS)
    .single()

  if (error) throw error
  return data as Insurance
}

/**
 * Desativa em vez de apagar.
 *
 * Apagar levaria junto os vínculos (as FKs são `on delete cascade`) e
 * zeraria o `insurance_id` dos pacientes já cadastrados — reescrevendo o
 * histórico de quem foi atendido por aquele convênio. Desativar tira o
 * convênio das telas de escolha sem tocar no passado.
 */
export async function deactivateInsurance(insuranceId: string): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { error } = await supabase
    .from("insurances")
    .update({ active: false })
    .eq("id", insuranceId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Vínculos de convênio
// ---------------------------------------------------------------------------

/**
 * Reescreve os vínculos de convênio de um profissional ou procedimento.
 *
 * Apaga e insere em vez de calcular a diferença: a lista é curta (dezenas,
 * não milhares) e o resultado é o mesmo, sem o risco de um diff errado
 * deixar vínculo órfão.
 *
 * O `clinic_id` vai em toda linha inserida, e a FK composta da migration
 * exige que profissional e convênio sejam AMBOS dessa clínica — então um
 * `insurance_id` de outro tenant é recusado pelo banco, não só por aqui.
 */
async function reescreverVinculos(
  supabase: Awaited<ReturnType<typeof requireClinicContext>>["supabase"],
  clinicId: string,
  tabela: "professional_insurances" | "procedure_insurances",
  coluna: "professional_id" | "procedure_id",
  donoId: string,
  insuranceIds: readonly string[],
): Promise<void> {
  const { error: erroDelete } = await supabase
    .from(tabela)
    .delete()
    .eq(coluna, donoId)
    .eq("clinic_id", clinicId)

  if (erroDelete) throw erroDelete

  // Duplicata no array violaria a PK composta e derrubaria o insert inteiro.
  const unicos = [...new Set(insuranceIds)]
  if (unicos.length === 0) return

  const { error: erroInsert } = await supabase.from(tabela).insert(
    unicos.map((insurance_id) => ({
      clinic_id: clinicId,
      [coluna]: donoId,
      insurance_id,
    })),
  )

  if (erroInsert) throw erroInsert
}

// ---------------------------------------------------------------------------
// 3. Equipe
// ---------------------------------------------------------------------------

export async function createProfessional(
  input: ProfessionalInput,
): Promise<Professional> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const { insurance_ids, ...campos } = professionalSchema.parse(input)

  const { data, error } = await supabase
    .from("professionals")
    .insert({ clinic_id: clinicId, ...campos })
    .select(PROFESSIONAL_COLUMNS)
    .single()

  if (error) throw error

  const profissional = data as Professional

  await reescreverVinculos(
    supabase,
    clinicId,
    "professional_insurances",
    "professional_id",
    profissional.id,
    insurance_ids,
  )

  return profissional
}

export async function updateProfessional(
  professionalId: string,
  input: ProfessionalInput,
): Promise<Professional> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const { insurance_ids, ...campos } = professionalSchema.parse(input)

  const { data, error } = await supabase
    .from("professionals")
    .update(campos)
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .select(PROFESSIONAL_COLUMNS)
    .single()

  if (error) throw error

  await reescreverVinculos(
    supabase,
    clinicId,
    "professional_insurances",
    "professional_id",
    professionalId,
    insurance_ids,
  )

  return data as Professional
}

/**
 * Desativa o profissional. Mesma razão do convênio: o histórico de
 * agendamento continua apontando para ele, e apagá-lo o quebraria.
 */
export async function deactivateProfessional(
  professionalId: string,
): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { error } = await supabase
    .from("professionals")
    .update({ active: false })
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// 4. Procedimentos
// ---------------------------------------------------------------------------

export async function createProcedure(input: ProcedureInput): Promise<Procedure> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const { insurance_ids, ...campos } = procedureSchema.parse(input)

  const { data, error } = await supabase
    .from("procedures")
    .insert({ clinic_id: clinicId, ...campos })
    .select(PROCEDURE_COLUMNS)
    .single()

  if (error) throw error

  const procedimento = data as Procedure

  await reescreverVinculos(
    supabase,
    clinicId,
    "procedure_insurances",
    "procedure_id",
    procedimento.id,
    insurance_ids,
  )

  return procedimento
}

export async function updateProcedure(
  procedureId: string,
  input: ProcedureInput,
): Promise<Procedure> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const { insurance_ids, ...campos } = procedureSchema.parse(input)

  const { data, error } = await supabase
    .from("procedures")
    .update(campos)
    .eq("id", procedureId)
    .eq("clinic_id", clinicId)
    .select(PROCEDURE_COLUMNS)
    .single()

  if (error) throw error

  await reescreverVinculos(
    supabase,
    clinicId,
    "procedure_insurances",
    "procedure_id",
    procedureId,
    insurance_ids,
  )

  return data as Procedure
}

export async function deactivateProcedure(procedureId: string): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { error } = await supabase
    .from("procedures")
    .update({ active: false })
    .eq("id", procedureId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// 5. Política de agendamento
// ---------------------------------------------------------------------------

/**
 * Uma linha por clínica, garantida pela PK ser o próprio clinic_id.
 * `upsert` porque a primeira gravação cria e as seguintes atualizam — e
 * duas requisições simultâneas não podem virar duas linhas.
 */
export async function saveSchedulingPolicy(
  input: SchedulingPolicyInput,
): Promise<SchedulingPolicy> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = schedulingPolicySchema.parse(input)

  const { data, error } = await supabase
    .from("scheduling_policies")
    .upsert({ clinic_id: clinicId, ...parsed }, { onConflict: "clinic_id" })
    .select(SCHEDULING_POLICY_COLUMNS)
    .single()

  if (error) throw error
  return data as SchedulingPolicy
}

// ---------------------------------------------------------------------------
// 6. Triagem de urgência
// ---------------------------------------------------------------------------

/**
 * Digest do conteúdo confirmado. Precisa produzir exatamente o mesmo valor
 * que `private.urgency_rule_content_hash` no banco — se divergir, o
 * trigger derruba a confirmação no mesmo instante em que ela é gravada, e
 * a regra nunca ativa.
 *
 * md5 pela mesma razão explicada na migration: detecta edição, não guarda
 * segredo.
 */
export function hashDoConteudo(
  protocolMessage: string,
  keywords: readonly string[],
): string {
  return createHash("md5")
    .update(`${protocolMessage}\x1e${keywords.join("\x1f")}`)
    .digest("hex")
}

/**
 * Cria a regra SEMPRE inativa.
 *
 * Critério de aceite 3: a regra não fica ativa sem confirmação explícita
 * da clínica. Nascer inativa é o que garante que o caminho "cadastrou e
 * esqueceu" não deixe um protocolo no ar sem ninguém ter lido.
 */
export async function createUrgencyRule(
  input: UrgencyRuleInput,
): Promise<UrgencyRule> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = urgencyRuleSchema.parse(input)

  const { data, error } = await supabase
    .from("urgency_rules")
    .insert({ clinic_id: clinicId, ...parsed, active: false })
    .select(URGENCY_RULE_COLUMNS)
    .single()

  if (error) throw error
  return data as UrgencyRule
}

/**
 * Edita o conteúdo da regra.
 *
 * Limpa a trilha de confirmação explicitamente e desativa. O trigger
 * `urgency_rules_revalidate` faria o mesmo sozinho ao ver o hash divergir
 * — isto aqui é o cinto, não o suspensório: deixa o comportamento visível
 * no código em vez de depender de quem lê saber do trigger.
 *
 * Quem edita precisa confirmar de novo. Sem isso, alguém confirmaria um
 * texto adequado e o trocaria depois, mantendo a regra ativa com uma
 * aprovação que já não corresponde ao conteúdo.
 */
export async function updateUrgencyRule(
  ruleId: string,
  input: UrgencyRuleInput,
): Promise<UrgencyRule> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = urgencyRuleSchema.parse(input)

  const { data, error } = await supabase
    .from("urgency_rules")
    .update({
      ...parsed,
      active: false,
      confirmed_by: null,
      confirmed_at: null,
      confirmed_content_hash: null,
    })
    .eq("id", ruleId)
    .eq("clinic_id", clinicId)
    .select(URGENCY_RULE_COLUMNS)
    .single()

  if (error) throw error
  return data as UrgencyRule
}

/**
 * Confirma e ativa a regra.
 *
 * O ponto mais sensível da spec: texto de urgência mal configurado é risco
 * de responsabilidade clínica. Por isso:
 *
 * 1. Só o owner chega aqui (`contextoDeEdicao`).
 * 2. Quem confirmou fica registrado em `confirmed_by` — a pergunta "quem
 *    da clínica assumiu este protocolo" precisa ter resposta.
 * 3. O hash é calculado sobre o texto LIDO DO BANCO, não sobre o que veio
 *    da tela. Confirmar o que o formulário diz permitiria ativar uma
 *    redação diferente da que está gravada.
 */
export async function confirmUrgencyRule(ruleId: string): Promise<UrgencyRule> {
  const { supabase, clinicId, userId } = await contextoDeEdicao()

  const { data: atual, error: erroLeitura } = await supabase
    .from("urgency_rules")
    .select("protocol_message, keywords")
    .eq("id", ruleId)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (erroLeitura) throw erroLeitura
  if (!atual) throw new Error("Regra de urgência não encontrada.")

  const { data, error } = await supabase
    .from("urgency_rules")
    .update({
      active: true,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
      confirmed_content_hash: hashDoConteudo(
        atual.protocol_message as string,
        atual.keywords as string[],
      ),
    })
    .eq("id", ruleId)
    .eq("clinic_id", clinicId)
    .select(URGENCY_RULE_COLUMNS)
    .single()

  if (error) throw error
  return data as UrgencyRule
}

/**
 * Desativa sem apagar a regra nem a trilha do que foi confirmado antes.
 *
 * Reativar exige passar por `confirmUrgencyRule` de novo: a CHECK
 * constraint exige `confirmed_at`, e este update o zera.
 */
export async function deactivateUrgencyRule(ruleId: string): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { error } = await supabase
    .from("urgency_rules")
    .update({
      active: false,
      confirmed_by: null,
      confirmed_at: null,
      confirmed_content_hash: null,
    })
    .eq("id", ruleId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

export async function deleteUrgencyRule(ruleId: string): Promise<void> {
  const { supabase, clinicId } = await contextoDeEdicao()

  const { error } = await supabase
    .from("urgency_rules")
    .delete()
    .eq("id", ruleId)
    .eq("clinic_id", clinicId)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// 7. Consentimento
// ---------------------------------------------------------------------------

/**
 * Salva o termo da clínica. `version` fica de fora do payload de propósito
 * — quem a incrementa é o trigger `consent_texts_bump_version`, e a coluna
 * está revogada do `authenticated`. Deixá-la gravável permitiria publicar
 * um texto novo sob a versão antiga, e aí o aceite registrado do paciente
 * deixaria de dizer com o que ele concordou.
 */
export async function saveConsentText(
  input: ConsentTextInput,
): Promise<ConsentText> {
  const { supabase, clinicId } = await contextoDeEdicao()
  const parsed = consentTextSchema.parse(input)

  const { data, error } = await supabase
    .from("consent_texts")
    .upsert({ clinic_id: clinicId, ...parsed }, { onConflict: "clinic_id" })
    .select(CONSENT_TEXT_COLUMNS)
    .single()

  if (error) throw error
  return data as ConsentText
}
