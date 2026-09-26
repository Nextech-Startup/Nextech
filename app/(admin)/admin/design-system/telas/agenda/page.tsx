import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { lerVisao } from "@/components/schedule/grade"
import { TelaDaAgenda } from "@/components/schedule/tela-da-agenda"
import { chaveDoDia } from "@/lib/formatters/data"
import { AGORA } from "../../_fixtures/agora"
import { COMPROMISSOS, EXPEDIENTE, PROFISSIONAIS } from "../../_fixtures/agenda"

export const metadata: Metadata = {
  title: "Protótipo: Agenda",
  robots: { index: false, follow: false },
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

export default async function AgendaPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const pedida = texto(params.data)
  const data = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : chaveDoDia(AGORA)
  const prof = texto(params.prof)

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="agendamento e Google Calendar (fase 5)" />
      <TelaDaAgenda
        visao={lerVisao(texto(params.visao))}
        data={data}
        profissionalId={PROFISSIONAIS.some((p) => p.id === prof) ? prof! : null}
        profissionais={PROFISSIONAIS}
        compromissos={COMPROMISSOS}
        expediente={EXPEDIENTE}
        agora={AGORA}
        caminho="/admin/design-system/telas/agenda"
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
