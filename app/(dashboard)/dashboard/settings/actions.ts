"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"
import {
  confirmUrgencyRule,
  createInsurance,
  createProcedure,
  createProfessional,
  createUrgencyRule,
  deactivateInsurance,
  deactivateProcedure,
  deactivateProfessional,
  deactivateUrgencyRule,
  deleteUrgencyRule,
  saveConsentText,
  saveSchedulingPolicy,
  updateInsurance,
  updateProcedure,
  updateProfessional,
  updateRegulatoryIdentity,
  updateUrgencyRule,
} from "@/lib/clinic-profile/mutations"

export type ProfileFormState = {
  error: string | null
  success: string | null
}

const estadoLimpo: ProfileFormState = { error: null, success: null }

/**
 * Traduz a falha para algo exibível.
 *
 * Erro de validação e de negócio têm mensagem própria, escrita para ser
 * lida. Qualquer outro vira texto genérico: o `PostgrestError` do Supabase
 * carrega `message` e `details` com o valor da linha rejeitada — que neste
 * módulo inclui nome de responsável técnico e de profissional, ou seja,
 * PII (regra 1 de lgpd-security).
 */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ZodError) {
    return erro.issues[0]?.message ?? "Confira os campos preenchidos."
  }
  // Barrado pelo FORMATO: o erro do PostgREST não é `instanceof Error` e
  // não tem `name` — um filtro por `erro.name !== "PostgrestError"` nunca
  // dispararia, e o `details` traz o valor rejeitado (aqui, PII).
  if (ehErroDoPostgrest(erro)) {
    return "Não foi possível salvar. Confira os dados e tente de novo."
  }
  if (erro instanceof Error) {
    return erro.message
  }
  return "Não foi possível salvar. Confira os dados e tente de novo."
}

/**
 * Casca comum das actions: executa, revalida a tela e traduz a falha.
 *
 * Nenhuma delas recebe `clinic_id` do formulário — as mutations o obtêm de
 * `requireClinicContext()` (regra 2 do CLAUDE.md), e os schemas são
 * `.strict()` para que um campo forjado não passe despercebido.
 */
async function executar(
  acao: () => Promise<unknown>,
  sucesso: string,
): Promise<ProfileFormState> {
  try {
    await acao()
    revalidatePath("/dashboard/settings")
    return { error: null, success: sucesso }
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }
}

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim()
const marcado = (fd: FormData, campo: string) => fd.get(campo) === "on"

/** Checkboxes de convênio: o mesmo `name` repetido, um por convênio marcado. */
const convenios = (fd: FormData) =>
  fd.getAll("insurance_ids").map(String).filter(Boolean)

// ---------------------------------------------------------------------------
// 1. Identidade regulatória
// ---------------------------------------------------------------------------

export async function salvarIdentidadeAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      updateRegulatoryIdentity({
        technical_responsible_name: texto(formData, "technical_responsible_name"),
        council: (texto(formData, "council") || null) as never,
        registration_number: texto(formData, "registration_number"),
        sanitary_license: texto(formData, "sanitary_license"),
      }),
    "Identidade regulatória salva.",
  )
}

// ---------------------------------------------------------------------------
// 2. Convênios
// ---------------------------------------------------------------------------

export async function criarConvenioAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => createInsurance({ name: texto(formData, "name") }),
    "Convênio adicionado.",
  )
}

export async function salvarConvenioAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      updateInsurance(texto(formData, "id"), {
        name: texto(formData, "name"),
        active: marcado(formData, "active"),
      }),
    "Convênio atualizado.",
  )
}

export async function desativarConvenioAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => deactivateInsurance(texto(formData, "id")),
    "Convênio desativado. O histórico de quem foi atendido por ele continua intacto.",
  )
}

// ---------------------------------------------------------------------------
// 3. Equipe
// ---------------------------------------------------------------------------

function camposDoProfissional(formData: FormData) {
  return {
    name: texto(formData, "name"),
    specialty: texto(formData, "specialty"),
    council: (texto(formData, "council") || null) as never,
    registration_number: texto(formData, "registration_number"),
    photo_url: texto(formData, "photo_url"),
    google_calendar_id: texto(formData, "google_calendar_id"),
    insurance_ids: convenios(formData),
  }
}

export async function criarProfissionalAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => createProfessional(camposDoProfissional(formData)),
    "Profissional adicionado à equipe.",
  )
}

export async function salvarProfissionalAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      updateProfessional(texto(formData, "id"), {
        ...camposDoProfissional(formData),
        active: marcado(formData, "active"),
      }),
    "Profissional atualizado.",
  )
}

export async function desativarProfissionalAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => deactivateProfessional(texto(formData, "id")),
    "Profissional desativado.",
  )
}

// ---------------------------------------------------------------------------
// 4. Procedimentos
// ---------------------------------------------------------------------------

function camposDoProcedimento(formData: FormData) {
  return {
    name: texto(formData, "name"),
    specialty: texto(formData, "specialty"),
    duration_minutes: texto(formData, "duration_minutes"),
    price: texto(formData, "price"),
    insurance_ids: convenios(formData),
  }
}

export async function criarProcedimentoAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => createProcedure(camposDoProcedimento(formData)),
    "Procedimento adicionado.",
  )
}

export async function salvarProcedimentoAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      updateProcedure(texto(formData, "id"), {
        ...camposDoProcedimento(formData),
        active: marcado(formData, "active"),
      }),
    "Procedimento atualizado.",
  )
}

export async function desativarProcedimentoAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => deactivateProcedure(texto(formData, "id")),
    "Procedimento desativado.",
  )
}

// ---------------------------------------------------------------------------
// 5. Política de agendamento
// ---------------------------------------------------------------------------

export async function salvarPoliticaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      saveSchedulingPolicy({
        default_slot_duration_minutes: texto(
          formData,
          "default_slot_duration_minutes",
        ),
        min_advance_hours: texto(formData, "min_advance_hours"),
        min_cancellation_hours: texto(formData, "min_cancellation_hours"),
        no_show_policy: texto(formData, "no_show_policy") as never,
      }),
    "Política de agendamento salva.",
  )
}

// ---------------------------------------------------------------------------
// 6. Triagem de urgência
// ---------------------------------------------------------------------------

export async function criarRegraUrgenciaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      createUrgencyRule({
        label: texto(formData, "label"),
        keywords: texto(formData, "keywords"),
        protocol_message: texto(formData, "protocol_message"),
      }),
    "Regra criada — e inativa. Ela só entra no ar depois que alguém da clínica confirmar o texto.",
  )
}

export async function salvarRegraUrgenciaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      updateUrgencyRule(texto(formData, "id"), {
        label: texto(formData, "label"),
        keywords: texto(formData, "keywords"),
        protocol_message: texto(formData, "protocol_message"),
      }),
    "Regra atualizada. Como o texto mudou, a confirmação caiu e ela saiu do ar — confirme de novo para reativar.",
  )
}

/**
 * Ativa a regra.
 *
 * A caixa de responsabilidade é exigida aqui, e não só no HTML: `required`
 * num checkbox é validação de navegador, e quem chama a action por outro
 * caminho passaria direto. É o único lugar da spec em que "o formulário
 * validou" não é garantia suficiente.
 */
export async function confirmarRegraUrgenciaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  if (!marcado(formData, "responsabilidade")) {
    return {
      ...estadoLimpo,
      error:
        "Marque a confirmação de que o texto é da clínica antes de colocar a regra no ar.",
    }
  }

  return executar(
    () => confirmUrgencyRule(texto(formData, "id")),
    "Regra confirmada e ativa.",
  )
}

export async function desativarRegraUrgenciaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => deactivateUrgencyRule(texto(formData, "id")),
    "Regra desativada. Reativar exige confirmar o texto de novo.",
  )
}

export async function excluirRegraUrgenciaAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () => deleteUrgencyRule(texto(formData, "id")),
    "Regra excluída.",
  )
}

// ---------------------------------------------------------------------------
// 7. Consentimento
// ---------------------------------------------------------------------------

export async function salvarConsentimentoAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return executar(
    () =>
      saveConsentText({
        body: texto(formData, "body"),
        retention_years: texto(formData, "retention_years"),
      }),
    "Termo de consentimento salvo.",
  )
}
