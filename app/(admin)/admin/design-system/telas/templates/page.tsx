import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { contarPorStatus, filtrarTemplates, lerFiltroDeStatus } from "@/components/templates/regras"
import { TelaDeTemplates } from "@/components/templates/tela-de-templates"
import { TEMPLATES } from "../../_fixtures/templates"

export const metadata: Metadata = {
  title: "Protótipo: Templates",
  robots: { index: false, follow: false },
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

export default async function TemplatesPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtro = { status: lerFiltroDeStatus(texto(params.status)), busca: texto(params.q) ?? "" }
  const templates = filtrarTemplates(TEMPLATES, filtro)
  const pedido = texto(params.t)

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="templates do WhatsApp (fase 4)" />
      <TelaDeTemplates
        templates={templates}
        contagens={contarPorStatus(TEMPLATES)}
        filtro={filtro}
        aberto={TEMPLATES.find((t) => t.id === pedido) ?? templates[0] ?? null}
        celularNoEditor={Boolean(pedido)}
        caminho="/admin/design-system/telas/templates"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
