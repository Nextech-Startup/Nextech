import type { Metadata } from "next"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { carregarTemplates } from "@/lib/whatsapp/templates/queries"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { contarPorStatus, filtrarTemplates, lerFiltroDeStatus } from "@/components/templates/regras"
import { NOVO, TelaDeTemplates } from "@/components/templates/tela-de-templates"
import type { TemplateDoWhatsApp } from "@/components/templates/tipos"
import { AGORA } from "@/app/_fixtures/agora"
import { TEMPLATES } from "@/app/_fixtures/templates"
import { conferirAction, duplicarAction, excluirAction, salvarOuEnviarAction } from "./actions"

export const metadata: Metadata = {
  title: "Templates",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/templates"
const ACOES = {
  salvarOuEnviar: salvarOuEnviarAction,
  conferir: conferirAction,
  duplicar: duplicarAction,
  excluir: excluirAction,
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/** Os agentes que aparecem nos templates da fixture, para o editor da demonstração. */
function agentesDaFixture(ts: readonly TemplateDoWhatsApp[]) {
  return [...new Map(ts.map((t) => [t.agenteId, { id: t.agenteId, nome: t.agente }])).values()]
}

/**
 * Templates do WhatsApp (whatsapp-templates-v1). Fora da demonstração, os
 * da clínica, com as ações reais para o owner (staff só lê). Na
 * demonstração, a fixture (spec demo-account-v1): a Evolution não tem
 * template, e a clínica de demonstração não conecta a Cloud API.
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Templates" rota={ROTA} role={role} demo={isDemo} />
  }

  const params = await searchParams
  const filtro = { status: lerFiltroDeStatus(texto(params.status)), busca: texto(params.q) ?? "" }
  const pedido = texto(params.t)

  if (isDemo) {
    const todos = relogioDaDemonstracao(AGORA).deslocar(TEMPLATES)
    const templates = filtrarTemplates(todos, filtro)
    return (
      <TelaDeTemplates
        templates={templates}
        contagens={contarPorStatus(todos)}
        filtro={filtro}
        aberto={todos.find((t) => t.id === pedido) ?? templates[0] ?? null}
        celularNoEditor={Boolean(pedido)}
        caminho={ROTA}
        agentes={agentesDaFixture(todos)}
        acaoDesabilitada="Na demonstração, os templates não vão para a Meta."
      />
    )
  }

  const { templates: todos, agentes, usosDoPlano, podeEscrever } = await carregarTemplates()
  const templates = filtrarTemplates(todos, filtro)
  const novo = podeEscrever && pedido === NOVO

  return (
    <TelaDeTemplates
      templates={templates}
      contagens={contarPorStatus(todos)}
      filtro={filtro}
      aberto={novo ? null : (todos.find((t) => t.id === pedido) ?? templates[0] ?? null)}
      novo={novo}
      celularNoEditor={Boolean(pedido)}
      caminho={ROTA}
      agentes={agentes}
      usosDoPlano={usosDoPlano}
      podeEscrever={podeEscrever}
      acoes={podeEscrever ? ACOES : undefined}
    />
  )
}
