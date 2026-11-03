import type { Etapa, MotivoDePerda, Oportunidade, Referencia } from "@/lib/crm/tipos"
import { CONVERSAS } from "./conversas"
import { MEMBROS } from "./equipe"
import { pacientePorId } from "./pacientes"

/**
 * O funil de exemplo da conta de demonstração (spec crm-v1, parte 1). Mesmos
 * pacientes, conversas e equipe das outras telas: o id aponta para a mesma
 * pessoa em todas. Datas em torno do "agora" das fixtures (28/09/2026,
 * 14:32), deslocadas para hoje pelo relógio da demonstração. Notas
 * fictícias, sem data escrita no texto.
 */

export const PROCEDIMENTOS_DO_CRM: Referencia[] = [
  { id: "proc-avaliacao", nome: "Limpeza e avaliação" },
  { id: "proc-clareamento", nome: "Clareamento dental" },
  { id: "proc-implante", nome: "Implante dentário" },
  { id: "proc-ortodontia", nome: "Aparelho ortodôntico" },
  { id: "proc-harmonizacao", nome: "Harmonização facial" },
  { id: "proc-toxina", nome: "Toxina botulínica" },
]

function procedimento(id: string): Referencia {
  const p = PROCEDIMENTOS_DO_CRM.find((x) => x.id === id)
  if (!p) throw new Error(`Procedimento de protótipo inexistente: ${id}`)
  return p
}

function membro(id: string): Referencia {
  const m = MEMBROS.find((x) => x.id === id)
  if (!m) throw new Error(`Membro de protótipo inexistente: ${id}`)
  return { id: m.id, nome: m.nome }
}

/** [etapa, instante, autor]: autor nulo é o sistema. O primeiro passo é a abertura. */
type Passo = [para: Etapa, em: string, autor: string | null]

type Base = {
  id: string
  paciente: string
  conversa?: string
  procedimento?: string
  valorCentavos?: number
  responsavel?: string
  proximaAcao?: string
  motivo?: MotivoDePerda
  nota?: string
  /** Quando difere da última mudança de etapa: mensagem do paciente depois dela. */
  ultimaAtividade?: string
}

function oportunidade(b: Base, passos: Passo[]): Oportunidade {
  const p = pacientePorId(b.paciente)
  const [para, em] = passos.at(-1)!
  const final = para === "ganho" || para === "perdido"
  const urgente = CONVERSAS.find((c) => c.id === b.conversa)?.urgente ?? false
  return {
    id: b.id,
    paciente: { id: p.id, nome: p.name, telefone: p.whatsapp_phone_number, optOut: p.opted_out },
    conversaId: b.conversa ?? null,
    etapa: para,
    etapaDesde: em,
    ultimaAtividade: b.ultimaAtividade ?? em,
    abertaEm: passos[0][1],
    encerradaEm: final ? em : null,
    procedimento: b.procedimento ? procedimento(b.procedimento) : null,
    valorCentavos: b.valorCentavos ?? null,
    responsavel: b.responsavel ? membro(b.responsavel) : null,
    proximaAcao: b.proximaAcao ?? null,
    motivoDePerda: b.motivo ?? null,
    nota: b.nota ?? null,
    urgente,
    eventos: passos.map(([etapa, quando, autor], i) => ({
      id: `${b.id}-e${i + 1}`,
      de: i === 0 ? null : passos[i - 1][0],
      para: etapa,
      em: quando,
      autor: autor ? membro(autor) : null,
    })),
  }
}

export const OPORTUNIDADES: Oportunidade[] = [
  // --- Novo
  oportunidade({ id: "op-01", paciente: "pac-05", conversa: "c-falha", ultimaAtividade: "2026-09-28T14:05:00-03:00" }, [
    ["novo", "2026-09-28T13:40:00-03:00", null],
  ]),
  oportunidade({ id: "op-02", paciente: "pac-07", conversa: "c-audio" }, [["novo", "2026-09-28T12:10:00-03:00", null]]),
  oportunidade({ id: "op-03", paciente: "pac-10", nota: "Pediu para não receber mensagens automáticas." }, [
    ["novo", "2026-08-14T09:45:00-03:00", null],
  ]),
  // --- Qualificado
  oportunidade(
    { id: "op-04", paciente: "pac-04", conversa: "c-urgente", procedimento: "proc-implante", ultimaAtividade: "2026-09-28T14:20:00-03:00" },
    [
      ["novo", "2026-09-28T13:55:00-03:00", null],
      ["qualificado", "2026-09-28T14:02:00-03:00", null],
    ],
  ),
  oportunidade(
    { id: "op-05", paciente: "pac-02", conversa: "c-agendando", procedimento: "proc-clareamento", valorCentavos: 120000, responsavel: "m-carla", ultimaAtividade: "2026-09-28T14:29:00-03:00" },
    [
      ["novo", "2026-09-28T14:00:00-03:00", null],
      ["qualificado", "2026-09-28T14:12:00-03:00", null],
    ],
  ),
  oportunidade(
    {
      id: "op-06",
      paciente: "pac-06",
      conversa: "c-quase",
      procedimento: "proc-harmonizacao",
      valorCentavos: 250000,
      responsavel: "m-diego",
      proximaAcao: "2026-09-29T10:00:00-03:00",
      nota: "Quer fazer em duas etapas. Enviar orçamento por escrito.",
    },
    [
      ["novo", "2026-09-27T15:00:00-03:00", null],
      ["qualificado", "2026-09-27T15:40:00-03:00", "m-carla"],
    ],
  ),
  oportunidade(
    { id: "op-07", paciente: "pac-12", procedimento: "proc-ortodontia", valorCentavos: 480000, responsavel: "m-carla", nota: "Comparando com outra clínica do bairro." },
    [
      ["novo", "2026-09-20T10:00:00-03:00", null],
      ["qualificado", "2026-09-22T11:15:00-03:00", null],
    ],
  ),
  // --- Agendado
  oportunidade(
    {
      id: "op-08",
      paciente: "pac-01",
      conversa: "c-humano",
      procedimento: "proc-implante",
      valorCentavos: 350000,
      responsavel: "m-ana",
      proximaAcao: "2026-10-01T16:00:00-03:00",
      ultimaAtividade: "2026-09-28T11:02:00-03:00",
    },
    [
      ["novo", "2026-09-25T09:00:00-03:00", null],
      ["qualificado", "2026-09-25T09:20:00-03:00", null],
      ["agendado", "2026-09-26T10:30:00-03:00", "m-carla"],
    ],
  ),
  oportunidade(
    { id: "op-09", paciente: "pac-09", conversa: "c-fechada", procedimento: "proc-avaliacao", valorCentavos: 25000, responsavel: "m-diego", ultimaAtividade: "2026-09-27T08:30:00-03:00" },
    [
      ["novo", "2026-09-24T16:00:00-03:00", null],
      ["agendado", "2026-09-25T09:10:00-03:00", "m-diego"],
    ],
  ),
  // --- Compareceu
  oportunidade(
    { id: "op-10", paciente: "pac-03", procedimento: "proc-clareamento", valorCentavos: 120000, responsavel: "m-ana", nota: "Gostou da avaliação; vai decidir com o marido." },
    [
      ["novo", "2026-09-15T10:00:00-03:00", null],
      ["qualificado", "2026-09-15T10:30:00-03:00", null],
      ["agendado", "2026-09-16T09:00:00-03:00", "m-carla"],
      ["compareceu", "2026-09-22T17:10:00-03:00", "m-ana"],
    ],
  ),
  // --- Ganho
  oportunidade({ id: "op-11", paciente: "pac-08", procedimento: "proc-implante", valorCentavos: 420000, responsavel: "m-ana" }, [
    ["novo", "2026-09-02T09:00:00-03:00", null],
    ["qualificado", "2026-09-02T09:25:00-03:00", null],
    ["agendado", "2026-09-03T10:00:00-03:00", "m-carla"],
    ["compareceu", "2026-09-10T15:00:00-03:00", "m-ana"],
    ["ganho", "2026-09-18T11:00:00-03:00", "m-ana"],
  ]),
  oportunidade({ id: "op-12", paciente: "pac-01", procedimento: "proc-avaliacao", valorCentavos: 25000, responsavel: "m-carla" }, [
    ["novo", "2026-09-05T08:40:00-03:00", null],
    ["agendado", "2026-09-05T09:00:00-03:00", "m-carla"],
    ["ganho", "2026-09-12T10:00:00-03:00", "m-carla"],
  ]),
  oportunidade({ id: "op-13", paciente: "pac-06", procedimento: "proc-toxina", valorCentavos: 150000, responsavel: "m-diego" }, [
    ["novo", "2026-07-10T14:00:00-03:00", null],
    ["qualificado", "2026-07-10T14:20:00-03:00", null],
    ["ganho", "2026-07-25T16:00:00-03:00", "m-diego"],
  ]),
  oportunidade({ id: "op-14", paciente: "pac-09", procedimento: "proc-clareamento", valorCentavos: 110000, responsavel: "m-carla" }, [
    ["novo", "2026-09-19T10:00:00-03:00", null],
    ["qualificado", "2026-09-19T10:15:00-03:00", null],
    ["agendado", "2026-09-20T09:00:00-03:00", "m-carla"],
    ["ganho", "2026-09-24T18:00:00-03:00", "m-carla"],
  ]),
  // --- Perdido
  oportunidade({ id: "op-15", paciente: "pac-11", motivo: "preco", responsavel: "m-diego" }, [
    ["novo", "2026-09-08T10:00:00-03:00", null],
    ["qualificado", "2026-09-08T10:20:00-03:00", null],
    ["perdido", "2026-09-16T12:00:00-03:00", "m-diego"],
  ]),
  oportunidade({ id: "op-16", paciente: "pac-03", motivo: "outra_clinica" }, [
    ["novo", "2026-09-01T11:00:00-03:00", null],
    ["perdido", "2026-09-10T09:00:00-03:00", "m-carla"],
  ]),
  oportunidade({ id: "op-17", paciente: "pac-12", motivo: "sem_resposta", responsavel: "m-carla" }, [
    ["novo", "2026-08-20T10:00:00-03:00", null],
    ["qualificado", "2026-08-20T10:30:00-03:00", null],
    ["perdido", "2026-09-05T10:00:00-03:00", "m-carla"],
  ]),
]
