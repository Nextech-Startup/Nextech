import { decifrarSegredo } from "@/lib/security/tenant-secrets"
import { categoriaDaMeta, statusDoEvento } from "./templates/eventos"
import type { CategoriaDoTemplate, StatusDoTemplate } from "./templates/tipos"

/**
 * Client da Cloud API da Meta (skill `integrations`). Cada agente é um
 * `phone_number_id`; o token é da clínica, cifrado no banco, e só é
 * decifrado aqui dentro (lgpd-security, regra 7).
 *
 * Nenhuma mensagem de erro leva o token, o número do paciente nem o texto:
 * a `message` do erro da Meta cita o número, e por isso só o `code` dela é
 * lido.
 */

const GRAPH = "https://graph.facebook.com"
export const TEMPO_MAXIMO_DA_META_MS = 15_000
/** Código da Meta para limite de taxa: a mensagem certamente não saiu. */
const LIMITE_DE_TAXA = "130429"

export class MetaError extends Error {
  readonly code: string
  readonly status: number | null
  readonly repetivel: boolean
  /** `error_subcode` da Meta, quando vier (ex.: 2388024, nome de template já usado). */
  readonly subcode: string | null

  constructor(code: string, status: number | null, repetivel: boolean, subcode: string | null = null) {
    super("Falha ao falar com a Cloud API da Meta.")
    this.name = "MetaError"
    this.code = code
    this.status = status
    this.repetivel = repetivel
    this.subcode = subcode
  }
}

function versao(): string {
  const v = process.env.WHATSAPP_API_VERSION
  if (!v) throw new MetaError("configuracao", null, false)
  return v
}

/** Código ou id da Meta: às vezes número, às vezes texto. */
function codigo(bruto: unknown): string | null {
  return (typeof bruto === "number" && Number.isFinite(bruto)) || (typeof bruto === "string" && bruto !== "")
    ? String(bruto)
    : null
}

async function chamar(url: string, init: RequestInit, buscar: typeof fetch): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await buscar(url, { ...init, signal: AbortSignal.timeout(TEMPO_MAXIMO_DA_META_MS) })
  } catch {
    // Sem resposta, não dá para saber se a mensagem saiu: não repete.
    throw new MetaError("rede", null, false)
  }

  const corpo = (await resposta.json().catch(() => null)) as
    | { error?: { code?: unknown; error_subcode?: unknown } }
    | null
  if (!resposta.ok) {
    const code = codigo(corpo?.error?.code) ?? `http-${resposta.status}`
    // 429 ou 130429: limite de taxa, a Meta recusou antes de enviar. Um 5xx
    // pode ter enviado, e repetir mandaria a mesma mensagem duas vezes.
    throw new MetaError(
      code,
      resposta.status,
      resposta.status === 429 || code === LIMITE_DE_TAXA,
      codigo(corpo?.error?.error_subcode),
    )
  }
  return corpo
}

/** Envia texto livre. Só dentro da janela de 24h (quem chama decide). */
export async function enviarTexto(
  p: { phoneNumberId: string; tokenCifrado: string; para: string; texto: string },
  opcoes: { fetch?: typeof fetch } = {},
): Promise<{ waMessageId: string }> {
  const v = versao()
  const token = decifrarSegredo(p.tokenCifrado)
  const corpo = (await chamar(
    `${GRAPH}/${v}/${p.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: p.para,
        type: "text",
        text: { preview_url: false, body: p.texto },
      }),
    },
    opcoes.fetch ?? fetch,
  )) as { messages?: Array<{ id?: unknown }> } | null

  const id = corpo?.messages?.[0]?.id
  if (typeof id !== "string" || !id) throw new MetaError("resposta-sem-id", 200, false)
  return { waMessageId: id }
}

/**
 * Prova de posse na conexão: o número pertence ao WABA, e o token
 * informado enxerga os dois. Sem isto, uma clínica que digitasse o
 * `phone_number_id` de outra receberia as mensagens dela.
 */
export async function numeroPertenceAoWaba(
  p: { wabaId: string; phoneNumberId: string; token: string },
  opcoes: { fetch?: typeof fetch } = {},
): Promise<boolean> {
  const v = versao()
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(p.wabaId)}/phone_numbers?fields=id&limit=100`,
    { method: "GET", headers: { Authorization: `Bearer ${p.token}` } },
    opcoes.fetch ?? fetch,
  )) as { data?: Array<{ id?: unknown }> } | null

  return (corpo?.data ?? []).some((n) => n.id === p.phoneNumberId)
}

// ─────────────────────────────────────────────────────────────
// Templates (whatsapp-templates-v1). O token precisa da permissão
// whatsapp_business_management. Os ids da Meta vão sempre por
// encodeURIComponent: vêm do banco, mas não se confia no formato.
// ─────────────────────────────────────────────────────────────

type CredencialDaWaba = { wabaId: string; tokenCifrado: string }
type OpcoesDeRede = { fetch?: typeof fetch }

export type TemplateNaMeta = {
  metaTemplateId: string
  status: StatusDoTemplate | null
  categoria: CategoriaDoTemplate | null
}

function autorizacao(tokenCifrado: string, json = false): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${decifrarSegredo(tokenCifrado)}` }
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

function statusDaMeta(v: unknown): StatusDoTemplate | null {
  return typeof v === "string" ? statusDoEvento(v) : null
}

/** Cria o template na WABA. A Meta pode já devolver APPROVED ou REJECTED. */
export async function submeterTemplate(
  c: CredencialDaWaba,
  payload: Record<string, unknown>,
  opcoes: OpcoesDeRede = {},
): Promise<TemplateNaMeta> {
  const v = versao()
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(c.wabaId)}/message_templates`,
    { method: "POST", headers: autorizacao(c.tokenCifrado, true), body: JSON.stringify(payload) },
    opcoes.fetch ?? fetch,
  )) as { id?: unknown; status?: unknown; category?: unknown } | null

  const id = codigo(corpo?.id)
  if (!id) throw new MetaError("resposta-sem-id", 200, false)
  return { metaTemplateId: id, status: statusDaMeta(corpo?.status), categoria: categoriaDaMeta(corpo?.category) }
}

/**
 * Edita o template rejeitado ou pausado, mantendo id e nome. Só os
 * componentes: a Meta não aceita trocar nome nem idioma na edição, e a
 * categoria passou a ser dela.
 */
export async function editarTemplate(
  c: CredencialDaWaba & { metaTemplateId: string },
  componentes: Record<string, unknown>[],
  opcoes: OpcoesDeRede = {},
): Promise<void> {
  const v = versao()
  await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(c.metaTemplateId)}`,
    { method: "POST", headers: autorizacao(c.tokenCifrado, true), body: JSON.stringify({ components: componentes }) },
    opcoes.fetch ?? fetch,
  )
}

/** Status, categoria e motivo atuais ("Conferir agora"). */
export async function consultarTemplate(
  c: CredencialDaWaba & { metaTemplateId: string },
  opcoes: OpcoesDeRede = {},
): Promise<{ status: StatusDoTemplate | null; categoria: CategoriaDoTemplate | null; motivo: string | null }> {
  const v = versao()
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(c.metaTemplateId)}?fields=status,category,rejected_reason`,
    { method: "GET", headers: autorizacao(c.tokenCifrado) },
    opcoes.fetch ?? fetch,
  )) as { status?: unknown; category?: unknown; rejected_reason?: unknown } | null

  const status = statusDaMeta(corpo?.status)
  const motivo = typeof corpo?.rejected_reason === "string" ? corpo.rejected_reason : null
  return {
    status,
    categoria: categoriaDaMeta(corpo?.category),
    motivo: status === "rejected" && motivo && motivo !== "NONE" ? motivo : null,
  }
}

/**
 * Procura na WABA o template com este nome e este corpo. Serve à
 * idempotência da submissão: se a Meta criou e o banco não gravou, o
 * reenvio esbarra no nome repetido, e o template certo é reconhecido pelo
 * corpo (um homônimo criado fora do Nextech não é adotado).
 */
export async function buscarTemplatePorNome(
  c: CredencialDaWaba & { name: string; body: string },
  opcoes: OpcoesDeRede = {},
): Promise<TemplateNaMeta | null> {
  const v = versao()
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(c.wabaId)}/message_templates?name=${encodeURIComponent(c.name)}&fields=id,name,language,status,category,components&limit=100`,
    { method: "GET", headers: autorizacao(c.tokenCifrado) },
    opcoes.fetch ?? fetch,
  )) as { data?: Array<Record<string, unknown>> } | null

  const achado = (corpo?.data ?? []).find((t) => {
    const componentes = Array.isArray(t.components) ? (t.components as Array<Record<string, unknown>>) : []
    const corpoNaMeta = componentes.find((x) => x.type === "BODY")?.text
    return t.name === c.name && t.language === "pt_BR" && corpoNaMeta === c.body
  })
  const id = codigo(achado?.id)
  if (!achado || !id) return null
  return { metaTemplateId: id, status: statusDaMeta(achado.status), categoria: categoriaDaMeta(achado.category) }
}

/** Exclui da WABA só este template (pelo id), não os outros idiomas do nome. */
export async function excluirTemplateNaMeta(
  c: CredencialDaWaba & { metaTemplateId: string; name: string },
  opcoes: OpcoesDeRede = {},
): Promise<void> {
  const v = versao()
  await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(c.wabaId)}/message_templates?hsm_id=${encodeURIComponent(c.metaTemplateId)}&name=${encodeURIComponent(c.name)}`,
    { method: "DELETE", headers: autorizacao(c.tokenCifrado) },
    opcoes.fetch ?? fetch,
  )
}

/**
 * A porta única de envio de template (whatsapp-templates-v1,
 * comportamento 8). Só é chamada depois que `prepararEnvioDeTemplate`
 * (lib/whatsapp/templates/envio.ts) devolveu `ok`, com os `parametros` que
 * ela montou: template aprovado, da WABA do agente, uso no plano, paciente
 * que não saiu. Nunca há alternativa de texto livre. O teste de
 * arquitetura `tests/architecture/envio-de-template.test.ts` restringe
 * quem chama.
 *
 * O 131049 (limite de marketing por usuário da Meta) sai como MetaError
 * não repetível, como todo erro que não é limite de taxa.
 */
export async function enviarTemplate(
  p: { phoneNumberId: string; tokenCifrado: string; para: string; name: string; parametros: readonly string[] },
  opcoes: OpcoesDeRede = {},
): Promise<{ waMessageId: string }> {
  const v = versao()
  const template: Record<string, unknown> = { name: p.name, language: { code: "pt_BR" } }
  if (p.parametros.length > 0) {
    template.components = [{ type: "body", parameters: p.parametros.map((t) => ({ type: "text", text: t })) }]
  }
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(p.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: autorizacao(p.tokenCifrado, true),
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: p.para, type: "template", template }),
    },
    opcoes.fetch ?? fetch,
  )) as { messages?: Array<{ id?: unknown }> } | null

  const id = corpo?.messages?.[0]?.id
  if (typeof id !== "string" || !id) throw new MetaError("resposta-sem-id", 200, false)
  return { waMessageId: id }
}
