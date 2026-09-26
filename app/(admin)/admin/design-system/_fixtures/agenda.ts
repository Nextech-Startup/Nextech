import type { CompromissoDaAgenda, Expediente, ProfissionalDaAgenda } from "@/components/schedule/tipos"

/**
 * Semana de 28/09 a 04/10/2026 de três profissionais. Na segunda ("hoje"
 * nos protótipos) há dois conflitos, uma falta, um cancelamento e
 * consultas a confirmar; sábado e domingo a clínica fecha.
 */
export const PROFISSIONAIS: ProfissionalDaAgenda[] = [
  { id: "ana", nome: "Dra. Ana Lima", especialidade: "Ortodontia" },
  { id: "bruno", nome: "Dr. Bruno Reis", especialidade: "Implantes" },
  { id: "carla", nome: "Dra. Carla Mota", especialidade: "Estética" },
]

export const EXPEDIENTE: Expediente = { abre: "08:00", fecha: "18:00", diasAbertos: [1, 2, 3, 4, 5] }

type Linha = [dia: string, profissional: string, inicio: string, fim: string, paciente: string, procedimento: string, status?: CompromissoDaAgenda["status"]]

const LINHAS: Linha[] = [
  ["28", "ana", "08:00", "08:30", "Helena Costa", "Avaliação", "faltou"],
  ["28", "ana", "09:00", "09:40", "Rafaela Lins", "Manutenção do aparelho"],
  ["28", "ana", "10:00", "10:40", "Mariana Araújo", "Manutenção do aparelho"],
  ["28", "ana", "10:30", "11:00", "Patrícia Melo", "Avaliação", "pendente"],
  ["28", "ana", "14:00", "15:00", "Gustavo Rocha", "Clareamento"],
  ["28", "ana", "16:00", "16:30", "Sofia Almeida", "Limpeza", "cancelado"],
  ["28", "bruno", "08:30", "10:00", "Tiago Barros", "Implante, segunda etapa"],
  ["28", "bruno", "11:00", "11:30", "Rafaela Lins", "Avaliação de implante"],
  ["28", "bruno", "15:00", "16:00", "Beatriz Nogueira", "Prótese"],
  ["28", "bruno", "15:30", "16:30", "Camila Duarte", "Retorno pós-extração", "pendente"],
  ["28", "bruno", "17:00", "17:30", "Lucas Ferreira", "Avaliação", "pendente"],
  ["28", "carla", "09:30", "10:30", "Lucas Ferreira", "Harmonização facial"],
  ["28", "carla", "13:30", "14:30", "Sofia Almeida", "Limpeza de pele"],
  ["28", "carla", "16:00", "17:00", "Helena Costa", "Toxina botulínica", "pendente"],
  ["29", "ana", "10:00", "10:40", "João Pedro Lima", "Limpeza"],
  ["29", "ana", "14:30", "15:10", "Rafaela Lins", "Manutenção do aparelho"],
  ["29", "bruno", "09:00", "10:30", "Tiago Barros", "Implante, moldagem"],
  ["29", "carla", "11:00", "12:00", "Beatriz Nogueira", "Peeling"],
  ["30", "ana", "08:30", "09:10", "Patrícia Melo", "Limpeza"],
  ["30", "bruno", "14:00", "15:00", "Gustavo Rocha", "Avaliação de implante", "pendente"],
  ["30", "carla", "10:00", "11:00", "Camila Duarte", "Limpeza de pele"],
  ["01", "ana", "16:00", "16:40", "Mariana Araújo", "Manutenção do aparelho"],
  ["01", "bruno", "10:00", "11:30", "Tiago Barros", "Implante, instalação"],
  ["01", "carla", "15:00", "16:00", "Helena Costa", "Harmonização facial"],
  ["02", "ana", "09:00", "09:40", "João Pedro Lima", "Aplicação de flúor"],
  ["02", "carla", "13:00", "14:00", "Beatriz Nogueira", "Retorno", "pendente"],
]

const iso = (dia: string, hhmm: string) =>
  `2026-${dia === "01" || dia === "02" ? "10" : "09"}-${dia}T${hhmm}:00-03:00`

export const COMPROMISSOS: CompromissoDaAgenda[] = LINHAS.map(
  ([dia, profissionalId, inicio, fim, paciente, procedimento, status = "confirmado"], i) => ({
    id: `ag-${String(i + 1).padStart(2, "0")}`,
    profissionalId,
    inicio: iso(dia, inicio),
    fim: iso(dia, fim),
    paciente,
    procedimento,
    status,
  }),
)
