"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { erroParaLog } from "@/lib/security/erro-para-log"
import {
  TemplateMutationError,
  conferirNaMeta,
  criarTemplate,
  duplicarTemplate,
  enviarParaAprovacao,
  excluirTemplate,
  salvarTemplate,
} from "@/lib/whatsapp/templates/mutations"

/**
 * Server actions da tela de Templates (whatsapp-templates-v1). Server
 * action é POST público: o papel, o plano e a clínica são conferidos nas
 * mutations, pela sessão de escrita, nunca pelo que vem do formulário.
 */

export type EstadoDoTemplate = { erro: string | null; sucesso: string | null }

const ROTA = "/dashboard/templates"
const GENERICO = "Não foi possível concluir. Tente de novo em instantes."

/**
 * Só a mensagem do `TemplateMutationError`, escrita à mão, chega à tela. O
 * resto (PostgREST, que carrega o valor rejeitado em `details`; erro de
 * rede) vira a mensagem genérica, e o log leva só o metadado.
 */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof TemplateMutationError) return erro.message
  console.error("[templates]", { etapa: "acao", ...erroParaLog(erro) })
  return GENERICO
}

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === "string" ? v : ""
}

/** Os `<select name="variables">`, um por `{{n}}`, na ordem do corpo. */
function entradaDoFormulario(fd: FormData) {
  return {
    agentId: texto(fd, "agent_id"),
    name: texto(fd, "name"),
    usage: texto(fd, "usage"),
    category: texto(fd, "category"),
    body: texto(fd, "body"),
    variables: fd.getAll("variables").filter((v): v is string => typeof v === "string"),
  }
}

const destino = (id: string) => `${ROTA}?t=${encodeURIComponent(id)}`

/**
 * O formulário do editor: `intent` = "salvar" ou "enviar". Enviar salva o
 * texto da tela antes, para a Meta receber o que a clínica está vendo. Um
 * template novo (sem id) é criado e a tela vai para ele.
 */
export async function salvarOuEnviarAction(_anterior: EstadoDoTemplate, fd: FormData): Promise<EstadoDoTemplate> {
  const id = texto(fd, "template_id")
  const enviar = texto(fd, "intent") === "enviar"
  const status = texto(fd, "status")
  let novo: string | null = null

  try {
    if (id) {
      // Em análise, aprovado e desativado não se salvam; a mutation recusa.
      if (!enviar || ["draft", "rejected", "paused"].includes(status)) {
        await salvarTemplate(id, entradaDoFormulario(fd))
      }
    } else {
      novo = (await criarTemplate(entradaDoFormulario(fd))).id
    }
    if (enviar) await enviarParaAprovacao(id || novo!)
  } catch (erro) {
    revalidatePath(ROTA)
    // O rascunho novo já existe mesmo que o envio tenha falhado: a tela vai
    // para ele, e o erro aparece lá ao tentar de novo.
    if (novo) redirect(destino(novo))
    return { erro: mensagemDeErro(erro), sucesso: null }
  }

  revalidatePath(ROTA)
  if (novo) redirect(destino(novo))
  return { erro: null, sucesso: enviar ? "Enviado para a análise da Meta." : "Rascunho salvo." }
}

export async function conferirAction(_anterior: EstadoDoTemplate, fd: FormData): Promise<EstadoDoTemplate> {
  try {
    await conferirNaMeta(texto(fd, "template_id"))
  } catch (erro) {
    return { erro: mensagemDeErro(erro), sucesso: null }
  }
  revalidatePath(ROTA)
  return { erro: null, sucesso: "Status conferido na Meta." }
}

export async function duplicarAction(_anterior: EstadoDoTemplate, fd: FormData): Promise<EstadoDoTemplate> {
  let id: string
  try {
    id = (await duplicarTemplate(texto(fd, "template_id"))).id
  } catch (erro) {
    return { erro: mensagemDeErro(erro), sucesso: null }
  }
  revalidatePath(ROTA)
  redirect(destino(id))
}

export async function excluirAction(_anterior: EstadoDoTemplate, fd: FormData): Promise<EstadoDoTemplate> {
  try {
    await excluirTemplate(texto(fd, "template_id"))
  } catch (erro) {
    return { erro: mensagemDeErro(erro), sucesso: null }
  }
  revalidatePath(ROTA)
  redirect(ROTA)
}
