import type { ClinicaDoPainel, ConsumoDaClinica } from "@/components/admin/tipos"

/**
 * As clínicas que a equipe Nextech acompanha. A Clínica Sorriso Recife é
 * a mesma das telas da clínica; as outras existem só aqui.
 */
export const CLINICAS: ClinicaDoPainel[] = [
  { id: "cl-sorriso", nome: "Clínica Sorriso Recife", plano: "healthtech" },
  { id: "cl-odonto-vida", nome: "Odonto Vida Olinda", plano: "starter" },
  { id: "cl-pele-viva", nome: "Instituto Pele Viva", plano: "pro" },
  { id: "cl-movimento", nome: "Movimento Fisioterapia", plano: "pro" },
  { id: "cl-nutri", nome: "Nutri Equilíbrio", plano: "starter" },
  { id: "cl-mente-serena", nome: "Mente Serena Psicologia", plano: "healthtech" },
]

function clinica(id: string): ClinicaDoPainel {
  const c = CLINICAS.find((x) => x.id === id)
  if (!c) throw new Error(`Clínica ${id} fora da fixture`)
  return c
}

const SETEMBRO = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }

/**
 * Um nível de consumo para cada caso: o Instituto Pele Viva estourou, a
 * Odonto Vida vai estourar (projeção 152 de 150) e a Movimento está perto
 * (projeção 413 de 500). As outras têm folga.
 */
export const CONSUMO: ConsumoDaClinica[] = [
  { ...clinica("cl-sorriso"), ciclo: { usados: 1180, ...SETEMBRO } },
  { ...clinica("cl-odonto-vida"), ciclo: { usados: 140, ...SETEMBRO } },
  { ...clinica("cl-pele-viva"), ciclo: { usados: 512, ...SETEMBRO } },
  { ...clinica("cl-movimento"), ciclo: { usados: 380, ...SETEMBRO } },
  { ...clinica("cl-nutri"), ciclo: { usados: 38, ...SETEMBRO } },
  { ...clinica("cl-mente-serena"), ciclo: { usados: 2310, ...SETEMBRO } },
]
