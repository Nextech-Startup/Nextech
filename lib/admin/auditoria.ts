import type { AdminAction } from "./audit"
import { MOTIVOS_DE_SUPORTE, ROTULO_DO_MOTIVO, type AcaoDeSuporte, type MotivoDeSuporte } from "./acesso-de-suporte"

export type AcaoDaTrilha = AdminAction | AcaoDeSuporte

/** Um registro de `admin_audit_log`, com o autor e a clínica já resolvidos em nome. */
export type RegistroDaTrilha = {
  id: string
  instante: string
  autor: string
  acao: AcaoDaTrilha
  /** `null` quando a ação não tem clínica (listar clínicas) ou a clínica foi removida. */
  clinica: string | null
  /** O id do alvo, quando há (a conversa aberta). */
  alvo: string | null
  metadata: Record<string, string | number | boolean>
}

export type DescricaoDoRegistro = { acao: string; detalhe?: string; suporte: boolean }

const ehMotivo = (m: unknown): m is MotivoDeSuporte =>
  typeof m === "string" && (MOTIVOS_DE_SUPORTE as readonly string[]).includes(m)

function justificativa(r: RegistroDaTrilha): string {
  const { motivo, chamado } = r.metadata
  if (!ehMotivo(motivo) || typeof chamado !== "string") return "Sem justificativa registrada"
  return `${ROTULO_DO_MOTIVO[motivo]}, chamado #${chamado}`
}

/**
 * O que a pessoa fez, em uma frase sem sujeito nem clínica: a tela mostra
 * os dois em colunas próprias. Sem artigo antes do nome da clínica, que
 * pode ser "Clínica", "Instituto" ou "Consultório".
 */
export function descreverRegistro(r: RegistroDaTrilha): DescricaoDoRegistro {
  switch (r.acao) {
    case "clinic.list":
      return { acao: "Abriu a lista de clínicas", suporte: false }
    case "clinic.create":
      return { acao: "Criou a clínica", suporte: false }
    case "clinic.update_status":
      return {
        acao: r.metadata.status === "active" ? "Ativou a clínica" : "Voltou a clínica para rascunho",
        suporte: false,
      }
    case "member.invite":
      return {
        acao: "Convidou o responsável",
        detalhe: r.metadata.usuario_novo ? "Conta nova, com senha provisória." : "Pessoa que já tinha conta.",
        suporte: false,
      }
    case "conversation.list":
      return { acao: "Abriu as conversas", detalhe: justificativa(r), suporte: true }
    case "conversation.view":
      return { acao: "Abriu uma conversa", detalhe: justificativa(r), suporte: true }
  }
}

export type TipoDeRegistro = "todos" | "suporte" | "clinicas"

const ehSuporte = (a: AcaoDaTrilha) => a === "conversation.list" || a === "conversation.view"

/** A trilha do mais recente para o mais antigo, com os recortes da tela. */
export function filtrarTrilha(
  registros: readonly RegistroDaTrilha[],
  filtro: { tipo: TipoDeRegistro; clinica?: string; autor?: string },
): RegistroDaTrilha[] {
  return registros
    .filter((r) => filtro.tipo === "todos" || (filtro.tipo === "suporte") === ehSuporte(r.acao))
    .filter((r) => filtro.clinica === undefined || r.clinica === filtro.clinica)
    .filter((r) => filtro.autor === undefined || r.autor === filtro.autor)
    .sort((a, b) => new Date(b.instante).getTime() - new Date(a.instante).getTime())
}
