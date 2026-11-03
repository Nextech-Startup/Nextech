import type { Metadata } from "next"
import { AoVivo } from "@/components/conversations/ao-vivo"
import { ConviteDoCrm } from "@/components/crm/convite-do-crm"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm, ROTA_DO_CRM } from "@/lib/crm/acesso"
import { nomeDoMembro } from "@/lib/crm/equipe"
import { lerFiltroDeEncerradas, lerPeriodo, lerResponsavel, lerVista } from "@/lib/crm/filtros"
import { carregarCrm } from "@/lib/crm/queries"
import { relogioDoMinuto } from "@/lib/demo/relogio"
import { AGORA } from "@/app/_fixtures/agora"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "@/app/_fixtures/crm"
import { buscar, mover, salvar } from "./acoes"

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * O funil comercial (spec crm-v1, parte 2):
 * - profissional: permissão negada; Starter: o convite. Nenhum dos dois lê o CRM;
 * - Pro e HealthTech: as oportunidades do banco, decifradas no servidor, com
 *   as ações e o tempo real pelo canal privado da clínica;
 * - na demonstração, as reais (canal da Evolution) e as de exemplo trazidas
 *   para o minuto atual, numa tela só. A de exemplo move só no navegador.
 *
 * A busca é por POST (`buscar`): `?q=` nunca é lido.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, plan, isDemo, clinicId, userId, email } = await requireClinicContext()
  const acesso = acessoAoCrm(role, plan)
  if (acesso === "sem-papel") return <PermissaoNegada titulo="CRM" rota={ROTA_DO_CRM} role={role} demo={isDemo} />
  if (acesso === "sem-plano") return <ConviteDoCrm plano={plan} />

  const params = await searchParams
  const comum = {
    eu: { id: userId, nome: nomeDoMembro(email) },
    periodo: lerPeriodo(texto(params.periodo)),
    responsavel: lerResponsavel(texto(params.responsavel)),
    vista: lerVista(texto(params.vista)),
    encerradas: lerFiltroDeEncerradas(texto(params.resultado), texto(params.motivo)),
    caminho: ROTA_DO_CRM,
    buscar,
    aoVivo: <AoVivo clinicId={clinicId} canal="crm" />,
  }

  if (isDemo) {
    // No minuto real: as reais e as de exemplo no mesmo relógio (como Conversas).
    const relogio = relogioDoMinuto(AGORA)
    const dados = await carregarCrm(relogio.agora)
    return (
      <TelaDoCrm
        {...comum}
        oportunidades={[...dados.oportunidades, ...relogio.deslocar(OPORTUNIDADES)]}
        agora={relogio.agora}
        procedimentos={dados.procedimentos}
        procedimentosDeExemplo={PROCEDIMENTOS_DO_CRM}
        gravar={{ mover, salvar, equipe: dados.equipe }}
      />
    )
  }

  const agora = new Date().toISOString()
  const dados = await carregarCrm(agora)
  return (
    <TelaDoCrm
      {...comum}
      oportunidades={dados.oportunidades}
      agora={agora}
      procedimentos={dados.procedimentos}
      gravar={{ mover, salvar, equipe: dados.equipe }}
    />
  )
}
