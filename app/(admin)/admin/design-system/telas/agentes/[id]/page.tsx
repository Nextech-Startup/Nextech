import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { OperacaoDoAgente } from "@/components/agents/operacao-do-agente"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { DETALHES_DOS_AGENTES } from "../../../_fixtures/agentes"
import { AGORA } from "../../../_fixtures/agora"

export const metadata: Metadata = {
  title: "Protótipo: Agente",
  robots: { index: false, follow: false },
}

export default async function AgentePrototipo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agente = DETALHES_DOS_AGENTES.find((a) => a.id === id)
  if (!agente) notFound()

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b)" />
      <OperacaoDoAgente
        agente={agente}
        agora={AGORA}
        hrefDaLista="/admin/design-system/telas/agentes"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
