/**
 * Primeiros passos de uma clínica no Nextech, derivados só de dado que já
 * existe — nenhum passo é marcado à mão.
 *
 * A ordem é a de dependência: o agente usa equipe e procedimentos na
 * conversa, e só atende depois de ter número conectado e ser publicado.
 */

export type EstadoDoAgente = {
  status: "draft" | "active" | "paused"
  conectado: boolean
}

export type DadosDoOnboarding = {
  pendenciasRegulatorias: number
  profissionaisAtivos: number
  procedimentosAtivos: number
  agentes: readonly EstadoDoAgente[]
}

export type Passo = {
  id: "perfil" | "equipe" | "procedimentos" | "agente" | "whatsapp" | "publicado"
  titulo: string
  descricao: string
  /** Texto do botão que leva ao passo. */
  acao: string
  href: string
  feito: boolean
}

export function passosDoOnboarding(d: DadosDoOnboarding): Passo[] {
  return [
    {
      id: "perfil",
      titulo: "Identidade regulatória",
      descricao: "CNPJ e responsável técnico, exigidos pelo conselho.",
      acao: "Completar o perfil",
      href: "/dashboard/settings?aba=identidade",
      feito: d.pendenciasRegulatorias === 0,
    },
    {
      id: "equipe",
      titulo: "Equipe",
      descricao: "Os profissionais que atendem, com conselho e registro.",
      acao: "Cadastrar a equipe",
      href: "/dashboard/settings?aba=equipe",
      feito: d.profissionaisAtivos > 0,
    },
    {
      id: "procedimentos",
      titulo: "Procedimentos",
      descricao: "O que a clínica oferece e quanto tempo cada um leva.",
      acao: "Cadastrar procedimentos",
      href: "/dashboard/settings?aba=procedimentos",
      feito: d.procedimentosAtivos > 0,
    },
    {
      id: "agente",
      titulo: "Agente",
      descricao: "Quem responde o paciente no WhatsApp, com a persona da clínica.",
      acao: "Criar o agente",
      href: "/dashboard/agents",
      feito: d.agentes.length > 0,
    },
    {
      id: "whatsapp",
      titulo: "WhatsApp",
      descricao: "O número em que o agente atende.",
      acao: "Conectar o WhatsApp",
      href: "/dashboard/agents",
      feito: d.agentes.some((a) => a.conectado),
    },
    {
      id: "publicado",
      titulo: "Agente no ar",
      descricao: "Publicado, o agente passa a responder pacientes de verdade.",
      acao: "Publicar o agente",
      href: "/dashboard/agents",
      feito: d.agentes.some((a) => a.status === "active"),
    },
  ]
}

/** O primeiro passo pendente, ou `null` quando a clínica está pronta. */
export function proximoPasso(passos: readonly Passo[]): Passo | null {
  return passos.find((p) => !p.feito) ?? null
}
