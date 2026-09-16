"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ZodError } from "zod"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"
import {
  AgentMutationError,
  connectWhatsapp,
  createAgent,
  deleteAgent,
  disconnectWhatsapp,
  pauseAgent,
  publishAgent,
  updateAgent,
} from "@/lib/agent-config/mutations"
import {
  DIAS,
  type BusinessHours,
  type Dia,
} from "@/lib/agent-config/schema"

export type AgentFormState = {
  error: string | null
  success: string | null
}

const estadoLimpo: AgentFormState = { error: null, success: null }

/**
 * Traduz a falha para algo exibível.
 *
 * Mesmo raciocínio das actions do perfil da clínica, com um motivo a
 * mais: aqui o `PostgrestError` cru carrega, em `message` e `details`, o
 * valor da linha rejeitada — que numa violação de UNIQUE inclui o
 * `whatsapp_phone_number_id`. Deixá-lo chegar à tela vazaria exatamente o
 * que `NUMERO_JA_CONECTADO` existe para não vazar.
 */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ZodError) {
    return erro.issues[0]?.message ?? "Confira os campos preenchidos."
  }
  // AgentMutationError carrega mensagem escrita à mão em TypeScript —
  // inclusive a neutra do número duplicado. É o único tipo cuja mensagem
  // chega à tela, e as mutations garantem que nada do banco entra nele
  // sem passar por `traduzirErro`.
  if (erro instanceof AgentMutationError) {
    return erro.message
  }
  // Erro do PostgREST é barrado pelo FORMATO, não pelo nome: no caminho
  // `const { data, error } = await …` ele é um objeto plano de JSON.parse,
  // sem `name` e sem ser `instanceof Error`. Um filtro por
  // `erro.name !== "PostgrestError"` nunca dispararia — e o `details` de
  // um 23505 carrega o valor rejeitado em claro.
  if (ehErroDoPostgrest(erro)) {
    return "Não foi possível salvar. Confira os dados e tente de novo."
  }
  if (erro instanceof Error) {
    return erro.message
  }
  return "Não foi possível salvar. Confira os dados e tente de novo."
}

async function executar(
  acao: () => Promise<unknown>,
  sucesso: string,
): Promise<AgentFormState> {
  try {
    await acao()
    revalidatePath("/dashboard/agents")
    return { error: null, success: sucesso }
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }
}

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim()
const marcado = (fd: FormData, campo: string) => fd.get(campo) === "on"

/**
 * Remonta o horário a partir dos campos do formulário.
 *
 * São três campos por dia (`seg_open`, `seg_start`, `seg_end`), porque um
 * `<input type="time">` não sabe emitir objeto. A validação de formato e
 * de ordem fica no Zod, que a mutation aplica.
 */
function horarioDoFormulario(fd: FormData): BusinessHours {
  const horario = {} as BusinessHours

  for (const dia of DIAS) {
    horario[dia as Dia] = {
      open: marcado(fd, `${dia}_open`),
      start: texto(fd, `${dia}_start`) || "08:00",
      end: texto(fd, `${dia}_end`) || "18:00",
    }
  }

  return horario
}

function agenteDoFormulario(fd: FormData) {
  return {
    name: texto(fd, "name"),
    specialty: texto(fd, "specialty"),
    persona_instructions: texto(fd, "persona_instructions"),
    greeting_message: texto(fd, "greeting_message"),
    business_hours: horarioDoFormulario(fd),
    handoff_enabled: marcado(fd, "handoff_enabled"),
    handoff_message: texto(fd, "handoff_message"),
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Cria e leva direto para a configuração do agente novo.
 *
 * O redirect é o comportamento certo aqui: criar é o começo de preencher,
 * não uma ação que se encerra em si. `redirect()` lança internamente, por
 * isso vive fora do try de `executar`.
 */
export async function criarAgenteAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  let destino: string

  try {
    const agente = await createAgent({
      name: texto(fd, "name"),
      specialty: texto(fd, "specialty"),
      // Os demais campos ficam para a tela de configuração: pedir persona
      // e horário num diálogo de criação transformaria "criar agente" num
      // formulário longo antes de a clínica ver qualquer coisa.
    } as never)
    destino = `/dashboard/agents/${agente.id}`
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }

  revalidatePath("/dashboard/agents")
  redirect(destino)
}

export async function salvarAgenteAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")
  const estado = await executar(
    () => updateAgent(id, agenteDoFormulario(fd) as never),
    "Configuração salva.",
  )
  revalidatePath(`/dashboard/agents/${id}`)
  return estado
}

export async function excluirAgenteAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")

  try {
    await deleteAgent(id)
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }

  revalidatePath("/dashboard/agents")
  redirect("/dashboard/agents")
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/**
 * Conecta o WhatsApp.
 *
 * O token passa por aqui a caminho de `cifrarSegredo()` e nada nesta
 * função o registra: sem log, sem devolvê-lo no estado do formulário, sem
 * `revalidatePath` que pudesse recolocá-lo numa resposta. Ele entra e não
 * volta (regra 7 de lgpd-security).
 */
export async function conectarWhatsappAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")
  const estado = await executar(
    () =>
      connectWhatsapp(id, {
        whatsapp_phone_number_id: texto(fd, "whatsapp_phone_number_id"),
        whatsapp_waba_id: texto(fd, "whatsapp_waba_id"),
        whatsapp_access_token: texto(fd, "whatsapp_access_token"),
      }),
    "WhatsApp conectado.",
  )
  revalidatePath(`/dashboard/agents/${id}`)
  return estado
}

export async function desconectarWhatsappAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")
  const estado = await executar(
    () => disconnectWhatsapp(id),
    "WhatsApp desconectado. O agente foi pausado.",
  )
  revalidatePath(`/dashboard/agents/${id}`)
  return estado
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export async function publicarAgenteAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")
  const estado = await executar(
    () => publishAgent(id),
    "Agente publicado: já responde no WhatsApp.",
  )
  revalidatePath(`/dashboard/agents/${id}`)
  return estado
}

export async function pausarAgenteAction(
  _anterior: AgentFormState,
  fd: FormData,
): Promise<AgentFormState> {
  const id = texto(fd, "agent_id")
  const estado = await executar(
    () => pauseAgent(id),
    "Agente pausado: parou de responder, sem perder a configuração.",
  )
  revalidatePath(`/dashboard/agents/${id}`)
  return estado
}
