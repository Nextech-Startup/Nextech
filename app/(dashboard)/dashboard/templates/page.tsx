import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { contarPorStatus, filtrarTemplates, lerFiltroDeStatus } from "@/components/templates/regras"
import { TelaDeTemplates } from "@/components/templates/tela-de-templates"
import { AGORA } from "@/app/_fixtures/agora"
import { TEMPLATES } from "@/app/_fixtures/templates"

export const metadata: Metadata = {
  title: "Templates",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/templates"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com os templates (fase 4).
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Templates" rota={ROTA} role={role} demo />
  }

  const todos = relogioDaDemonstracao(AGORA).deslocar(TEMPLATES)
  const params = await searchParams
  const filtro = { status: lerFiltroDeStatus(texto(params.status)), busca: texto(params.q) ?? "" }
  const templates = filtrarTemplates(todos, filtro)
  const pedido = texto(params.t)

  return (
    <TelaDeTemplates
      templates={templates}
      contagens={contarPorStatus(todos)}
      filtro={filtro}
      aberto={todos.find((t) => t.id === pedido) ?? templates[0] ?? null}
      celularNoEditor={Boolean(pedido)}
      caminho={ROTA}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
