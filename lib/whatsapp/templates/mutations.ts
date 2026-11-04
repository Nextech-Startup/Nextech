import { z } from "zod"
import type { ClinicPlan } from "@/lib/agent-config/schema"
import { requireClinicContextForWrite, type ClinicRole } from "@/lib/auth/context"
import { serviceContext } from "@/lib/auth/service-context"
import { USOS_DE_TEMPLATE } from "@/lib/billing/plan-limits"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"
import { canalDoAgente } from "../canal"
import {
  MetaError,
  buscarTemplatePorNome,
  consultarTemplate,
  editarTemplate,
  excluirTemplateNaMeta,
  submeterTemplate,
} from "../client"
import { MENSAGEM_DO_PROBLEMA_NO_TEMPLATE, problemasNoTemplate, type ProblemaNoTemplate } from "./catalogo"
import { montarComponentes, montarSubmissao } from "./submissao"
import {
  CATEGORIAS,
  USOS,
  VARIAVEIS_DO_CATALOGO,
  type CategoriaDoTemplate,
  type StatusDoTemplate,
  type UsoDoTemplate,
  type VariavelDoCatalogo,
} from "./tipos"

/**
 * Escrita dos templates (whatsapp-templates-v1). Só o owner escreve: a
 * trava fica aqui, porque server action é POST público, e no banco, onde a
 * sessão só tem SELECT. Grava pelo service_role com o `clinic_id` da
 * sessão de escrita (`getUser`), nunca do navegador.
 *
 * A rede da Meta fica em lib/whatsapp/client.ts; o token é decifrado só
 * lá. Aqui, o erro da Meta vira código, nunca mensagem.
 */

export type CodigoDeErroDoTemplate =
  | "so_owner"
  | "demonstracao"
  | "nao_encontrado"
  | "uso_fora_do_plano"
  | "limite"
  | "nome_em_uso"
  | "invalido"
  | "agente_sem_whatsapp"
  | "canal_sem_template"
  | "outra_conta"
  | "estado_nao_permite"
  | "meta_recusou"
  | "meta_fora"

const MENSAGEM: Record<CodigoDeErroDoTemplate, string> = {
  so_owner: "Só o responsável pela clínica altera templates.",
  demonstracao: "A conta de demonstração não envia templates à Meta.",
  nao_encontrado: "Template não encontrado.",
  uso_fora_do_plano: "Este tipo de envio não está no plano da clínica.",
  limite: "A clínica chegou ao limite de 30 templates. Exclua um que não usa mais.",
  nome_em_uso: "Já existe um template com este nome.",
  invalido: "Confira os campos do template.",
  agente_sem_whatsapp: "Conecte o WhatsApp do agente antes de enviar o template.",
  canal_sem_template: "O canal de demonstração não tem templates da Meta.",
  outra_conta: "O agente foi conectado a outra conta do WhatsApp. Duplique o template para usar na conta nova.",
  estado_nao_permite: "Não é possível fazer isso com o template neste status.",
  meta_recusou: "A Meta recusou o pedido. Confira o template e tente de novo.",
  meta_fora: "Não conseguimos falar com a Meta agora. Tente de novo em alguns minutos.",
}

/** A mensagem é escrita aqui, à mão: é o único erro cuja mensagem chega à tela. */
export class TemplateMutationError extends Error {
  readonly codigo: CodigoDeErroDoTemplate

  constructor(codigo: CodigoDeErroDoTemplate, mensagem: string = MENSAGEM[codigo]) {
    super(mensagem)
    this.name = "TemplateMutationError"
    this.codigo = codigo
  }
}

/** Subcódigo da Meta para nome de template já usado na WABA. */
const NOME_JA_USADO_NA_META = "2388024"

/**
 * Margem do `status_changed_at` gravado no envio: evento da Meta anterior
 * ao envio (de antes do reenvio) é ignorado, mas o relógio da Meta um
 * pouco atrás do nosso não descarta a resposta do envio atual.
 */
const MARGEM_DO_RELOGIO_MS = 60_000

export type EntradaDoTemplate = {
  agentId: string
  name: string
  usage: UsoDoTemplate
  category: CategoriaDoTemplate
  body: string
  variables: VariavelDoCatalogo[]
}

const entradaSchema = z.object({
  agentId: z.string().uuid("Escolha o agente."),
  name: z.string().trim().min(1, "Dê um nome ao template.").max(512),
  usage: z.enum(USOS, { message: "Escolha o tipo de envio." }),
  category: z.enum(CATEGORIAS, { message: "Escolha a categoria." }),
  body: z.string().max(1024, "A Meta aceita até 1024 caracteres."),
  variables: z.array(z.enum(VARIAVEIS_DO_CATALOGO)).max(20),
})

const idSchema = z.string().uuid()

/** O que pode faltar num rascunho: o resto barra até o salvar. */
const PROBLEMAS_DE_RASCUNHO: readonly ProblemaNoTemplate[] = [
  "fora_de_sequencia",
  "comeca_com_variavel",
  "termina_com_variavel",
  "variavel_sem_associacao",
]

type Sessao = { clinicId: string; role: ClinicRole; plan: ClinicPlan; userId: string; isDemo: boolean }

type Meta = {
  submeter: typeof submeterTemplate
  editar: typeof editarTemplate
  consultar: typeof consultarTemplate
  buscarPorNome: typeof buscarTemplatePorNome
  excluir: typeof excluirTemplateNaMeta
}

export type DependenciasDosTemplates = {
  sessao: () => Promise<Sessao>
  banco: () => ReturnType<typeof serviceContext>["supabase"]
  meta: Meta
  agora: () => Date
}

export const DEPENDENCIAS_DOS_TEMPLATES: DependenciasDosTemplates = {
  // A sessão de escrita: confirma no Auth que a sessão ainda existe.
  sessao: () => requireClinicContextForWrite(),
  banco: () => serviceContext().supabase,
  meta: {
    submeter: submeterTemplate,
    editar: editarTemplate,
    consultar: consultarTemplate,
    buscarPorNome: buscarTemplatePorNome,
    excluir: excluirTemplateNaMeta,
  },
  agora: () => new Date(),
}

type Linha = {
  id: string
  clinic_id: string
  agent_id: string
  name: string
  usage: UsoDoTemplate
  category: CategoriaDoTemplate
  body: string
  variables: VariavelDoCatalogo[]
  status: StatusDoTemplate
  meta_template_id: string | null
  waba_id: string | null
}

type Agente = {
  id: string
  whatsapp_waba_id: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_access_token_encrypted: string | null
}

const COLUNAS = "id, clinic_id, agent_id, name, usage, category, body, variables, status, meta_template_id, waba_id"

// ─────────────────────────────────────────────────────────────
// Peças comuns
// ─────────────────────────────────────────────────────────────

async function sessaoDeOwner(deps: DependenciasDosTemplates): Promise<Sessao> {
  const s = await deps.sessao()
  if (s.role !== "owner") throw new TemplateMutationError("so_owner")
  if (s.isDemo) throw new TemplateMutationError("demonstracao")
  return s
}

async function carregar(deps: DependenciasDosTemplates, s: Sessao, id: unknown): Promise<Linha> {
  const valido = idSchema.safeParse(id)
  if (!valido.success) throw new TemplateMutationError("nao_encontrado")
  const { data, error } = await deps
    .banco()
    .from("whatsapp_templates")
    .select(COLUNAS)
    .eq("id", valido.data)
    .eq("clinic_id", s.clinicId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new TemplateMutationError("nao_encontrado")
  return data as Linha
}

async function carregarAgente(deps: DependenciasDosTemplates, s: Sessao, agentId: string): Promise<Agente> {
  const { data, error } = await deps
    .banco()
    .from("agents")
    .select("id, whatsapp_waba_id, whatsapp_phone_number_id, whatsapp_access_token_encrypted")
    .eq("id", agentId)
    .eq("clinic_id", s.clinicId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new TemplateMutationError("invalido", "Escolha um agente da clínica.")
  return data as Agente
}

/** Credencial da Cloud API do agente, ou o motivo de não haver. */
function credencial(agente: Agente): { wabaId: string; tokenCifrado: string } {
  if (agente.whatsapp_phone_number_id && canalDoAgente(agente.whatsapp_phone_number_id) === "evolution") {
    throw new TemplateMutationError("canal_sem_template")
  }
  if (!agente.whatsapp_waba_id || !agente.whatsapp_access_token_encrypted) {
    throw new TemplateMutationError("agente_sem_whatsapp")
  }
  return { wabaId: agente.whatsapp_waba_id, tokenCifrado: agente.whatsapp_access_token_encrypted }
}

function exigirUsoNoPlano(s: Sessao, uso: UsoDoTemplate): void {
  if (!USOS_DE_TEMPLATE[s.plan].includes(uso)) throw new TemplateMutationError("uso_fora_do_plano")
}

/** Valida a entrada. `completo`: tudo o que a Meta exige (envio); senão, o mínimo de um rascunho. */
function validar(input: unknown, completo: boolean): EntradaDoTemplate {
  const r = entradaSchema.safeParse(input)
  if (!r.success) throw new TemplateMutationError("invalido", r.error.issues[0]?.message ?? MENSAGEM.invalido)
  const entrada = { ...r.data, name: r.data.name.trim() }
  const problemas = problemasNoTemplate(entrada).filter((p) => completo || !PROBLEMAS_DE_RASCUNHO.includes(p))
  if (problemas.length > 0) throw new TemplateMutationError("invalido", MENSAGEM_DO_PROBLEMA_NO_TEMPLATE[problemas[0]])
  return entrada
}

/** Erro do banco que tem tradução; o resto sobe como está (a action o esconde). */
function traduzirErroDoBanco(erro: unknown): never {
  if (ehErroDoPostgrest(erro)) {
    if (erro.code === "23505") throw new TemplateMutationError("nome_em_uso")
    if (erro.code === "P0001") {
      if (erro.message === "limite de templates") throw new TemplateMutationError("limite")
      if (erro.message === "uso fora do plano") throw new TemplateMutationError("uso_fora_do_plano")
      throw new TemplateMutationError("invalido")
    }
    if (erro.code === "23514") throw new TemplateMutationError("invalido")
  }
  throw erro
}

/** Erro da Meta vira código: 4xx é recusa; rede, 5xx e configuração, indisponibilidade. */
function traduzirErroDaMeta(erro: unknown): never {
  if (erro instanceof MetaError) {
    const recusa = erro.status !== null && erro.status >= 400 && erro.status < 500 && erro.status !== 429
    throw new TemplateMutationError(recusa ? "meta_recusou" : "meta_fora")
  }
  throw erro
}

// ─────────────────────────────────────────────────────────────
// Ações
// ─────────────────────────────────────────────────────────────

/** Novo rascunho. */
export async function criarTemplate(
  input: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<{ id: string }> {
  const s = await sessaoDeOwner(deps)
  const entrada = validar(input, false)
  exigirUsoNoPlano(s, entrada.usage)
  await carregarAgente(deps, s, entrada.agentId)

  const { data, error } = await deps
    .banco()
    .from("whatsapp_templates")
    .insert({
      clinic_id: s.clinicId,
      agent_id: entrada.agentId,
      name: entrada.name,
      usage: entrada.usage,
      category: entrada.category,
      body: entrada.body,
      variables: entrada.variables,
      created_by: s.userId,
    })
    .select("id")
    .single()
  if (error) traduzirErroDoBanco(error)
  return { id: data!.id as string }
}

/**
 * Salva o texto. Rascunho muda tudo; rejeitado e pausado já existem na Meta
 * com nome, agente e uso fixos, e só o corpo e as variáveis mudam (o
 * reenvio é pela edição da Meta, decisão 7). Aprovado não se edita na v1.
 */
export async function salvarTemplate(
  id: unknown,
  input: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<void> {
  const s = await sessaoDeOwner(deps)
  const atual = await carregar(deps, s, id)
  if (!["draft", "rejected", "paused"].includes(atual.status)) throw new TemplateMutationError("estado_nao_permite")
  const entrada = validar(input, false)

  let mudanca: Record<string, unknown>
  if (atual.status === "draft") {
    exigirUsoNoPlano(s, entrada.usage)
    await carregarAgente(deps, s, entrada.agentId)
    mudanca = {
      agent_id: entrada.agentId,
      name: entrada.name,
      usage: entrada.usage,
      category: entrada.category,
      body: entrada.body,
      variables: entrada.variables,
    }
  } else {
    if (entrada.name !== atual.name || entrada.agentId !== atual.agent_id || entrada.usage !== atual.usage) {
      throw new TemplateMutationError(
        "estado_nao_permite",
        "Depois do envio à Meta, o nome, o agente e o tipo de envio não mudam. Duplique para mudar.",
      )
    }
    mudanca = { body: entrada.body, variables: entrada.variables }
  }

  const { error } = await deps
    .banco()
    .from("whatsapp_templates")
    .update(mudanca)
    .eq("id", atual.id)
    .eq("clinic_id", s.clinicId)
    .eq("status", atual.status)
  if (error) traduzirErroDoBanco(error)
}

/**
 * Envia para aprovação. Rascunho (ou template de outra WABA) é criado na
 * Meta; rejeitado e pausado são reenviados pela edição, com o mesmo id.
 */
export async function enviarParaAprovacao(
  id: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<void> {
  const s = await sessaoDeOwner(deps)
  const t = await carregar(deps, s, id)
  if (!["draft", "rejected", "paused"].includes(t.status)) throw new TemplateMutationError("estado_nao_permite")
  exigirUsoNoPlano(s, t.usage)
  validar(
    { agentId: t.agent_id, name: t.name, usage: t.usage, category: t.category, body: t.body, variables: t.variables },
    true,
  )
  const c = credencial(await carregarAgente(deps, s, t.agent_id))

  const agora = deps.agora()
  const envio = {
    status: "pending_review" as StatusDoTemplate,
    rejection_reason: null,
    rejection_detail: null,
    pending_category: null,
    pending_category_at: null,
    submitted_at: agora.toISOString(),
    status_changed_at: new Date(agora.getTime() - MARGEM_DO_RELOGIO_MS).toISOString(),
  }

  if (t.status !== "draft" && t.waba_id === c.wabaId && t.meta_template_id) {
    try {
      await deps.meta.editar({ ...c, metaTemplateId: t.meta_template_id }, montarComponentes(t))
    } catch (erro) {
      traduzirErroDaMeta(erro)
    }
    const { error } = await deps
      .banco()
      .from("whatsapp_templates")
      .update(envio)
      .eq("id", t.id)
      .eq("clinic_id", s.clinicId)
      .eq("status", t.status)
    if (error) traduzirErroDoBanco(error)
    return
  }

  const criado = await criarNaMeta(deps, c, t)
  const { error } = await deps
    .banco()
    .from("whatsapp_templates")
    .update({
      ...envio,
      status: criado.status ?? "pending_review",
      category: criado.categoria ?? t.category,
      meta_template_id: criado.metaTemplateId,
      waba_id: c.wabaId,
    })
    .eq("id", t.id)
    .eq("clinic_id", s.clinicId)
    .eq("status", t.status)
  if (error) traduzirErroDoBanco(error)
}

/**
 * Cria na Meta. Se a Meta criou numa tentativa anterior e o banco não
 * gravou, o nome já existe: o template é reconhecido pelo corpo e
 * adotado, sem criar outro (idempotência da submissão).
 */
async function criarNaMeta(
  deps: DependenciasDosTemplates,
  c: { wabaId: string; tokenCifrado: string },
  t: Linha,
) {
  try {
    return await deps.meta.submeter(c, montarSubmissao(t))
  } catch (erro) {
    if (!(erro instanceof MetaError) || erro.subcode !== NOME_JA_USADO_NA_META) traduzirErroDaMeta(erro)
    let existente
    try {
      existente = await deps.meta.buscarPorNome({ ...c, name: t.name, body: t.body })
    } catch (erroDaBusca) {
      traduzirErroDaMeta(erroDaBusca)
    }
    if (!existente) {
      throw new TemplateMutationError(
        "nome_em_uso",
        "Este nome já existe nesta conta do WhatsApp (ou foi excluído há menos de 30 dias). Escolha outro.",
      )
    }
    return existente
  }
}

/** "Conferir agora": consulta a Meta e aplica pelo mesmo caminho do webhook. */
export async function conferirNaMeta(
  id: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<void> {
  const s = await sessaoDeOwner(deps)
  const t = await carregar(deps, s, id)
  if (t.status !== "pending_review" || !t.meta_template_id) throw new TemplateMutationError("estado_nao_permite")
  const c = credencial(await carregarAgente(deps, s, t.agent_id))
  if (c.wabaId !== t.waba_id) throw new TemplateMutationError("outra_conta")

  let atual
  try {
    atual = await deps.meta.consultar({ ...c, metaTemplateId: t.meta_template_id })
  } catch (erro) {
    traduzirErroDaMeta(erro)
  }
  if (!atual.status && !atual.categoria) return

  const { error } = await deps.banco().rpc("apply_template_event", {
    p_waba_id: t.waba_id,
    p_meta_template_id: t.meta_template_id,
    p_occurred_at: deps.agora().toISOString(),
    p_status: atual.status,
    p_category: atual.categoria,
    p_rejection_reason: atual.motivo,
    p_rejection_detail: null,
    p_pending_category: null,
    p_pending_category_at: null,
    p_clear_pending: false,
  })
  if (error) throw error
}

/** O nome de base sem o sufixo de versão (`_v2`, `_v3`…). */
function semVersao(nome: string): string {
  return nome.replace(/_v\d+$/, "")
}

/** Rascunho novo com o mesmo conteúdo e o primeiro nome livre: `nome_v2`, `nome_v3`… */
export async function duplicarTemplate(
  id: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<{ id: string }> {
  const s = await sessaoDeOwner(deps)
  const t = await carregar(deps, s, id)
  exigirUsoNoPlano(s, t.usage)

  const base = semVersao(t.name).slice(0, 500)
  const { data: nomes, error: erroNomes } = await deps
    .banco()
    .from("whatsapp_templates")
    .select("name")
    .eq("clinic_id", s.clinicId)
    .like("name", `${base.replace(/_/g, "\\_")}%`)
  if (erroNomes) throw erroNomes
  const usados = new Set((nomes ?? []).map((n) => n.name as string))
  let versao = 2
  while (usados.has(`${base}_v${versao}`)) versao++

  const { data, error } = await deps
    .banco()
    .from("whatsapp_templates")
    .insert({
      clinic_id: s.clinicId,
      agent_id: t.agent_id,
      name: `${base}_v${versao}`,
      usage: t.usage,
      category: t.category,
      body: t.body,
      variables: t.variables,
      created_by: s.userId,
    })
    .select("id")
    .single()
  if (error) traduzirErroDoBanco(error)
  return { id: data!.id as string }
}

/**
 * Exclui. Rascunho: só no banco. Enviado: primeiro na Meta, depois no
 * banco. Se o agente já não tem acesso à WABA do template (desconectado ou
 * em outra conta), sai só do banco: a clínica ainda controla aquela conta
 * no WhatsApp Manager.
 */
export async function excluirTemplate(
  id: unknown,
  deps: DependenciasDosTemplates = DEPENDENCIAS_DOS_TEMPLATES,
): Promise<void> {
  const s = await sessaoDeOwner(deps)
  const t = await carregar(deps, s, id)

  if (t.meta_template_id && t.waba_id) {
    const agente = await carregarAgente(deps, s, t.agent_id)
    const temAcesso =
      agente.whatsapp_waba_id === t.waba_id &&
      Boolean(agente.whatsapp_access_token_encrypted) &&
      canalDoAgente(agente.whatsapp_phone_number_id ?? "") === "meta"
    if (temAcesso) {
      try {
        await deps.meta.excluir({
          wabaId: t.waba_id,
          tokenCifrado: agente.whatsapp_access_token_encrypted!,
          metaTemplateId: t.meta_template_id,
          name: t.name,
        })
      } catch (erro) {
        traduzirErroDaMeta(erro)
      }
    }
  }

  const { error } = await deps.banco().from("whatsapp_templates").delete().eq("id", t.id).eq("clinic_id", s.clinicId)
  if (error) throw error
}
