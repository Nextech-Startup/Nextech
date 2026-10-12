import type { ClinicRole } from "@/lib/auth/context"

/**
 * O que cada papel pode fazer, por capacidade e não por rótulo vago.
 *
 * É uma proposta: team-access-v1 deixa a matriz campo a campo em aberto.
 * Ela descreve o que o código já faz hoje — agentes são só do owner
 * (lista e editor), staff opera sequências e templates, professional vê só
 * o que é dele — e um teste
 * a mantém igual ao menu (`lib/navigation`), para a tela nunca prometer um
 * acesso que o menu esconde.
 */
export type Alcance = "tudo" | "proprios" | "nada"

export type Capacidade = {
  id: string
  rotulo: string
  /** Tela do menu que a capacidade abre, quando há uma. */
  tela?: string
  alcance: Record<ClinicRole, Alcance>
}

export const CAPACIDADES: readonly Capacidade[] = [
  {
    id: "conversas",
    rotulo: "Ver e responder conversas",
    tela: "/dashboard/conversations",
    alcance: { owner: "tudo", staff: "tudo", professional: "nada" },
  },
  {
    id: "agenda",
    rotulo: "Ver a agenda",
    tela: "/dashboard/schedule",
    alcance: { owner: "tudo", staff: "tudo", professional: "proprios" },
  },
  {
    id: "pacientes",
    rotulo: "Ver pacientes",
    tela: "/dashboard/patients",
    alcance: { owner: "tudo", staff: "tudo", professional: "proprios" },
  },
  {
    id: "automacao",
    rotulo: "Ver sequências e templates",
    tela: "/dashboard/sequences",
    alcance: { owner: "tudo", staff: "tudo", professional: "nada" },
  },
  {
    id: "editar-agentes",
    rotulo: "Ver, configurar e publicar agentes",
    tela: "/dashboard/agents",
    alcance: { owner: "tudo", staff: "nada", professional: "nada" },
  },
  {
    id: "perfil",
    rotulo: "Editar o perfil e o dado regulatório",
    tela: "/dashboard/settings",
    alcance: { owner: "tudo", staff: "nada", professional: "nada" },
  },
  {
    id: "equipe",
    rotulo: "Convidar pessoas e mudar acessos",
    tela: "/dashboard/settings/team",
    alcance: { owner: "tudo", staff: "nada", professional: "nada" },
  },
  {
    id: "cobranca",
    rotulo: "Ver plano e cobrança",
    tela: "/dashboard/billing",
    alcance: { owner: "tudo", staff: "nada", professional: "nada" },
  },
]

/** Uma linha sob o nome de cada papel na matriz. */
export const RESUMO_DO_PAPEL: Record<ClinicRole, string> = {
  owner: "Acesso total",
  staff: "Recepção e atendimento",
  professional: "A própria agenda e os próprios pacientes",
}
