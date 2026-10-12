import { chaveDoDia } from "@/lib/formatters/data"
import type { AdminAction } from "./audit"
import { MOTIVOS_DE_SUPORTE, ROTULO_DO_MOTIVO, type AcaoDeSuporte, type MotivoDeSuporte } from "./acesso-de-suporte"

export type AcaoDaTrilha = AdminAction | AcaoDeSuporte

/** Um registro de `admin_audit_log`, com o autor e a clínica já resolvidos em nome. */
export type RegistroDaTrilha = {
  id: string
  instante: string
  autor: string
  /** `actor_user_id`: distingue duas pessoas sem nome cadastrado. */
  autorId?: string
  /**
   * A coluna é texto: uma versão futura (ou um engano) pode gravar uma ação
   * que esta tela não conhece. Ela aparece como não reconhecida, sem sumir.
   */
  acao: AcaoDaTrilha | (string & {})
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
    case "clinic.prepare_demo":
      return {
        acao: "Preparou a conta de demonstração",
        detalhe: r.metadata.vinculo === "criado" ? "Passou a responder pela clínica." : "Já respondia pela clínica.",
        suporte: false,
      }
    case "clinic.demo_channel_connect":
      return { acao: "Conectou o canal de demonstração", suporte: false }
    case "clinic.demo_channel_clear": {
      const n = Number(r.metadata.pacientes_apagados ?? 0)
      return {
        acao: "Limpou o canal de demonstração",
        detalhe: n === 1 ? "1 paciente apagado." : `${n} pacientes apagados.`,
        suporte: false,
      }
    }
    case "conversation.list":
      return { acao: "Abriu as conversas", detalhe: justificativa(r), suporte: true }
    case "conversation.list_view":
      return { acao: "Viu a lista de conversas", detalhe: justificativa(r), suporte: true }
    case "conversation.view":
      return { acao: "Abriu uma conversa", detalhe: justificativa(r), suporte: true }
    default:
      return { acao: "Ação não reconhecida", detalhe: `Código: ${r.acao}`, suporte: false }
  }
}

/** Ações que sempre têm clínica: sem ela, a clínica foi apagada (`on delete set null`). */
const ACOES_DE_CLINICA: readonly string[] = [
  "clinic.create",
  "clinic.update_status",
  "member.invite",
  "clinic.prepare_demo",
  "clinic.demo_channel_connect",
  "clinic.demo_channel_clear",
  "conversation.list",
  "conversation.list_view",
  "conversation.view",
]

/** A coluna da clínica: o nome, "Clínica removida" ou vazia (`null`) quando a ação não tem clínica. */
export function clinicaDoRegistro(r: RegistroDaTrilha): string | null {
  if (r.clinica) return r.clinica
  return ACOES_DE_CLINICA.includes(r.acao) ? "Clínica removida" : null
}

/** Um item da tela: um registro, ou uma sequência de consultas iguais da mesma pessoa. */
export type ItemDaTrilha = {
  /** O mais recente da sequência: é a hora que a linha mostra. */
  registro: RegistroDaTrilha
  vezes: number
  /** O instante do mais antigo da sequência. */
  desde: string
}

/** Só consulta se agrupa: ação que muda algo aparece sempre sozinha. */
const AGRUPAVEIS: readonly string[] = ["clinic.list"]

/**
 * Cada abertura de `/admin` grava um `clinic.list`; sem agrupar, a trilha
 * vira uma parede de "Abriu a lista de clínicas". Junta as seguidas (sem
 * outro registro no meio) da mesma pessoa, no mesmo dia. Recebe a trilha
 * do mais recente para o mais antigo.
 */
export function agruparRepeticoes(registros: readonly RegistroDaTrilha[]): ItemDaTrilha[] {
  const itens: ItemDaTrilha[] = []
  for (const r of registros) {
    const ultimo = itens[itens.length - 1]
    const junta =
      ultimo !== undefined &&
      AGRUPAVEIS.includes(r.acao) &&
      ultimo.registro.acao === r.acao &&
      (ultimo.registro.autorId ?? ultimo.registro.autor) === (r.autorId ?? r.autor) &&
      chaveDoDia(ultimo.registro.instante) === chaveDoDia(r.instante)
    if (junta) {
      ultimo.vezes += 1
      ultimo.desde = r.instante
    } else {
      itens.push({ registro: r, vezes: 1, desde: r.instante })
    }
  }
  return itens
}

/** O `created_at` como o Postgres devolve, com fração de até microssegundo. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

/**
 * O cursor de "Ver registros anteriores", vindo da URL. Volta como veio,
 * sem passar por `Date`: o arredondamento para milissegundo pularia os
 * registros do mesmo milissegundo na virada de página. O que não é um
 * instante válido é descartado, e a página volta ao começo.
 */
export function lerCursor(bruto: string | string[] | undefined): string | undefined {
  if (typeof bruto !== "string" || !INSTANTE.test(bruto)) return undefined
  return Number.isNaN(Date.parse(bruto)) ? undefined : bruto
}

export type TipoDeRegistro = "todos" | "suporte" | "clinicas"

/** A trilha do mais recente para o mais antigo, com os recortes da tela. */
export function filtrarTrilha(
  registros: readonly RegistroDaTrilha[],
  filtro: { tipo: TipoDeRegistro; clinica?: string; autor?: string },
): RegistroDaTrilha[] {
  return registros
    // Suporte é o que a descrição marca como suporte: uma regra só, que cobre toda AcaoDeSuporte.
    .filter((r) => filtro.tipo === "todos" || (filtro.tipo === "suporte") === descreverRegistro(r).suporte)
    .filter((r) => filtro.clinica === undefined || r.clinica === filtro.clinica)
    .filter((r) => filtro.autor === undefined || r.autor === filtro.autor)
    .sort((a, b) => new Date(b.instante).getTime() - new Date(a.instante).getTime())
}
