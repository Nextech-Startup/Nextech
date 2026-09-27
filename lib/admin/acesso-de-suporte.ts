/**
 * Por que alguém da equipe Nextech abre conversas de uma clínica. É uma
 * lista fechada: texto livre levaria nome de paciente para a trilha de
 * auditoria (desenho de navegação, seção 3; lgpd-security).
 */
export const MOTIVOS_DE_SUPORTE = [
  "ia-nao-respondeu",
  "resposta-errada",
  "falha-de-envio",
  "pedido-da-clinica",
  "outro",
] as const

export type MotivoDeSuporte = (typeof MOTIVOS_DE_SUPORTE)[number]

export const ROTULO_DO_MOTIVO: Record<MotivoDeSuporte, string> = {
  "ia-nao-respondeu": "A IA não respondeu",
  "resposta-errada": "A IA respondeu errado",
  "falha-de-envio": "A mensagem não chegou ao paciente",
  "pedido-da-clinica": "Pedido da clínica",
  outro: "Outro motivo",
}

export type Justificativa = { motivo: MotivoDeSuporte; chamado: string }

/** Na fase 3b, estas ações se juntam ao `AdminAction` de `audit.ts`. */
export type AcaoDeSuporte = "conversation.list" | "conversation.view"

/** Tempo para investigar um chamado sem justificar de novo a cada conversa. */
export const DURACAO_DO_ACESSO_MS = 30 * 60 * 1000

/** Só dígitos, com "#" opcional: o chamado é um número, nunca uma descrição. */
const CHAMADO = /^#?\s*(\d{1,10})$/

const ehMotivo = (m: string): m is MotivoDeSuporte => (MOTIVOS_DE_SUPORTE as readonly string[]).includes(m)

/** Sem justificativa, não abre: é bloqueio, não aviso. */
export function validarJustificativa(bruto: {
  motivo: string
  chamado: string
}): { ok: true; justificativa: Justificativa } | { ok: false; erro: string } {
  if (!ehMotivo(bruto.motivo)) return { ok: false, erro: "Escolha o motivo do acesso." }
  const m = CHAMADO.exec(bruto.chamado.trim())
  if (!m) return { ok: false, erro: "Informe o número do chamado, só com dígitos." }
  return { ok: true, justificativa: { motivo: bruto.motivo, chamado: m[1] } }
}

/** Um acesso concedido: vem dos registros `conversation.list` de quem está logado. */
export type AcessoDeSuporte = { clinicaId: string; concedidoEm: string; justificativa: Justificativa }

const ms = (iso: string) => new Date(iso).getTime()

/**
 * O acesso que libera a lista de conversas desta clínica agora: o mais
 * recente com menos de 30 min. `expiraEm` sai em ISO (UTC); a tela formata.
 */
export function acessoVigente(
  acessos: readonly AcessoDeSuporte[],
  clinicaId: string,
  agora: string,
): (AcessoDeSuporte & { expiraEm: string }) | null {
  const t = ms(agora)
  const vigente = acessos
    .filter((a) => a.clinicaId === clinicaId && ms(a.concedidoEm) <= t && t - ms(a.concedidoEm) < DURACAO_DO_ACESSO_MS)
    .sort((a, b) => ms(b.concedidoEm) - ms(a.concedidoEm))[0]
  if (!vigente) return null
  return { ...vigente, expiraEm: new Date(ms(vigente.concedidoEm) + DURACAO_DO_ACESSO_MS).toISOString() }
}

/** O formato que `registrarAcao` (lib/admin/audit.ts) recebe. */
export type RegistroDeSuporte = {
  action: AcaoDeSuporte
  clinicId: string
  targetTable?: "conversations"
  targetId?: string
  metadata: { motivo: MotivoDeSuporte; chamado: string }
}

/**
 * O registro de cada acesso: ver a lista (sem alvo) ou abrir uma conversa
 * (com o id dela). Responde quem, quando, qual clínica, qual conversa e
 * por quê, e nada além disso.
 */
export function registroDeSuporte(p: {
  clinicaId: string
  justificativa: Justificativa
  conversaId?: string
}): RegistroDeSuporte {
  const metadata = { motivo: p.justificativa.motivo, chamado: p.justificativa.chamado }
  if (p.conversaId === undefined) return { action: "conversation.list", clinicId: p.clinicaId, metadata }
  return {
    action: "conversation.view",
    clinicId: p.clinicaId,
    targetTable: "conversations",
    targetId: p.conversaId,
    metadata,
  }
}
