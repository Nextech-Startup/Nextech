import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { girarDiasDaSemana, relogioDaDemonstracao } from "@/lib/demo/relogio"
import { chaveDoDia } from "@/lib/formatters/data"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { lerVisao } from "@/components/schedule/grade"
import { TelaDaAgenda } from "@/components/schedule/tela-da-agenda"
import { AGORA } from "@/app/_fixtures/agora"
import { COMPROMISSOS, EXPEDIENTE, PROFISSIONAIS } from "@/app/_fixtures/agenda"

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/schedule"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com o agendamento (fase 5).
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Agenda" rota={ROTA} role={role} demo />
  }

  const relogio = relogioDaDemonstracao(AGORA)
  const params = await searchParams
  const pedida = texto(params.data)
  const data = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : chaveDoDia(relogio.agora)
  const prof = texto(params.prof)

  return (
    <TelaDaAgenda
      visao={lerVisao(texto(params.visao))}
      data={data}
      profissionalId={PROFISSIONAIS.some((p) => p.id === prof) ? prof! : null}
      profissionais={PROFISSIONAIS}
      compromissos={relogio.deslocar(COMPROMISSOS)}
      // O dia das fixtures continua aberto quando cai num fim de semana.
      expediente={{ ...EXPEDIENTE, diasAbertos: girarDiasDaSemana(EXPEDIENTE.diasAbertos, relogio.dias) }}
      agora={relogio.agora}
      caminho={ROTA}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
