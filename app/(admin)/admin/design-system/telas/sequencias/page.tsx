import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { TelaDeSequencias } from "@/components/sequences/tela-de-sequencias"
import { AGORA } from "../../_fixtures/agora"
import { SEQUENCIAS } from "../../_fixtures/sequencias"

export const metadata: Metadata = {
  title: "Protótipo: Sequências",
  robots: { index: false, follow: false },
}

export default async function SequenciasPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const pedida = (await searchParams).s
  const id = typeof pedida === "string" ? pedida : undefined

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="sequências e templates (fase 4)" />
      <TelaDeSequencias
        sequencias={SEQUENCIAS}
        aberta={SEQUENCIAS.find((s) => s.id === id) ?? SEQUENCIAS[0]}
        celularNoEditor={Boolean(id)}
        agora={AGORA}
        caminho="/admin/design-system/telas/sequencias"
        caminhoDoTemplate="/admin/design-system/telas/templates"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
