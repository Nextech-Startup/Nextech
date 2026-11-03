import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { requireClinicContext } from "@/lib/auth/context"
import { lerFiltroDeEncerradas, lerPeriodo, lerResponsavel, lerVista } from "@/lib/crm/filtros"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { AGORA } from "@/app/_fixtures/agora"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "@/app/_fixtures/crm"
import { MEMBROS } from "@/app/_fixtures/equipe"
import { buscar } from "./acoes"

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/crm"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * O funil comercial (spec crm-v1). Parte 1: só na conta de demonstração,
 * com as oportunidades de exemplo trazidas para hoje. A tela real chega na
 * parte 2. A busca é por POST (`buscar`): `?q=` nunca é lido.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="CRM" rota={ROTA} role={role} demo />
  }

  const params = await searchParams
  const relogio = relogioDaDemonstracao(AGORA)
  // "Meus" na demonstração é o membro marcado como "você" na equipe de exemplo.
  const eu = MEMBROS.find((m) => m.voce) ?? MEMBROS[0]

  return (
    <TelaDoCrm
      oportunidades={relogio.deslocar(OPORTUNIDADES)}
      agora={relogio.agora}
      eu={{ id: eu.id, nome: eu.nome }}
      periodo={lerPeriodo(texto(params.periodo))}
      responsavel={lerResponsavel(texto(params.responsavel))}
      vista={lerVista(texto(params.vista))}
      encerradas={lerFiltroDeEncerradas(texto(params.resultado), texto(params.motivo))}
      procedimentos={PROCEDIMENTOS_DO_CRM}
      caminho={ROTA}
      buscar={buscar}
    />
  )
}
