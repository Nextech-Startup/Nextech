import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { contarSegmentos, filtrarPacientes, lerSegmento } from "@/components/patients/segmentos"
import { TabelaDePacientes } from "@/components/patients/tabela-de-pacientes"
import { AGORA } from "@/app/_fixtures/agora"
import { PACIENTES } from "@/app/_fixtures/pacientes"

export const metadata: Metadata = {
  title: "Pacientes",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/patients"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real lê `patients`, que já existe.
 */
export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Pacientes" rota={ROTA} role={role} />
  }

  const relogio = relogioDaDemonstracao(AGORA)
  const todos = relogio.deslocar(PACIENTES)
  const params = await searchParams
  const filtro = { segmento: lerSegmento(texto(params.segmento)), busca: texto(params.q) ?? "" }

  return (
    <TabelaDePacientes
      pacientes={filtrarPacientes(todos, filtro, relogio.agora)}
      contagens={contarSegmentos(todos, relogio.agora)}
      filtro={filtro}
      agora={relogio.agora}
      caminho={ROTA}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
