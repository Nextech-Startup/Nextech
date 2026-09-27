import type { AlteracaoDeAcesso, Convite, MembroDaEquipe } from "@/components/team/tipos"

/** Equipe fictícia: a responsável, duas pessoas da recepção e dois profissionais. */
export const MEMBROS: MembroDaEquipe[] = [
  { id: "m-ana", nome: "Ana Paula Souza", email: "ana.paula@clinicasorriso.com.br", papel: "owner", profissional: null, ultimoAcesso: "2026-09-28T14:30:00-03:00", voce: true },
  { id: "m-carla", nome: "Carla Mendes", email: "carla@clinicasorriso.com.br", papel: "staff", profissional: null, ultimoAcesso: "2026-09-28T11:10:00-03:00", voce: false },
  { id: "m-diego", nome: "Diego Santos", email: "diego@clinicasorriso.com.br", papel: "staff", profissional: null, ultimoAcesso: "2026-09-27T18:02:00-03:00", voce: false },
  { id: "m-lima", nome: "Ana Lima", email: "dra.analima@clinicasorriso.com.br", papel: "professional", profissional: "Dra. Ana Lima, CRO-PE 12345", ultimoAcesso: "2026-09-25T08:40:00-03:00", voce: false },
  { id: "m-bruno", nome: "Bruno Reis", email: "dr.bruno@clinicasorriso.com.br", papel: "professional", profissional: "Dr. Bruno Reis, CRO-PE 23456", ultimoAcesso: null, voce: false },
]

export const CONVITES: Convite[] = [
  { id: "cv-1", email: "carla.mota@clinicasorriso.com.br", papel: "professional", enviadoEm: "2026-09-26T10:00:00-03:00", expiraEm: "2026-10-03T10:00:00-03:00" },
  { id: "cv-2", email: "recepcao2@clinicasorriso.com.br", papel: "staff", enviadoEm: "2026-09-18T15:00:00-03:00", expiraEm: "2026-09-25T15:00:00-03:00" },
]

export const ALTERACOES: AlteracaoDeAcesso[] = [
  { id: "a-1", em: "2026-09-26T10:00:00-03:00", texto: "Ana Paula convidou carla.mota@ como Profissional" },
  { id: "a-2", em: "2026-09-20T09:12:00-03:00", texto: "Ana Paula vinculou Bruno Reis ao Dr. Bruno Reis do cadastro" },
  { id: "a-3", em: "2026-09-12T16:40:00-03:00", texto: "Ana Paula mudou Diego de Profissional para Equipe" },
  { id: "a-4", em: "2026-09-01T08:00:00-03:00", texto: "Equipe Nextech criou a clínica e convidou Ana Paula como Responsável" },
]
