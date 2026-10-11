import type { Metadata } from "next"
import { z } from "zod"
import { requireClinicContext } from "@/lib/auth/context"
import { abrirConversa, avisosDeDesconexao, listarConversas } from "@/lib/conversations/queries"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { AoVivo } from "@/components/conversations/ao-vivo"
import { AvisoDeDesconexao } from "@/components/conversations/aviso-de-desconexao"
import { CaixaDeConversas } from "@/components/conversations/caixa-de-conversas"
import {
  contarPorEstado,
  filtrarConversas,
  lerFiltroDeEstado,
} from "@/components/conversations/estado"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { agir } from "./acoes"

export const metadata: Metadata = {
  title: "Conversas",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/conversations"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * A caixa de conversas, em dois ramos pelo mesmo `isDemo`:
 * - na conta de demonstração, o protótipo com o dado de exemplo trazido
 *   para hoje (spec demo-account-v1);
 * - nas outras, a tela real (conversation-engine-v1, parte 4): a fila e a
 *   conversa decifradas no servidor, o tempo real pelo canal privado da
 *   clínica, as ações de assumir, devolver e resolver a urgência, e o aviso
 *   de desconexão do WhatsApp.
 */
export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo, clinicId } = await requireClinicContext()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Conversas" rota={ROTA} role={role} demo={isDemo} />
  }

  const params = await searchParams
  const filtro = { estado: lerFiltroDeEstado(texto(params.status)), busca: texto(params.q) ?? "" }
  const pedida = texto(params.c)

  if (isDemo) {
    const relogio = relogioDaDemonstracao(AGORA)
    const todas = relogio.deslocar(CONVERSAS)
    const conversas = filtrarConversas(todas, filtro)
    const aberta =
      todas.find((c) => c.id === pedida) ?? todas.find((c) => c.id === conversas[0]?.id) ?? null

    return (
      <CaixaDeConversas
        conversas={conversas}
        contagens={contarPorEstado(todas)}
        filtro={filtro}
        aberta={aberta}
        celularNaConversa={Boolean(pedida)}
        agora={relogio.agora}
        caminho={ROTA}
        caminhoDaFicha="/dashboard/patients"
      />
    )
  }

  const agora = new Date().toISOString()
  const [todas, avisos] = await Promise.all([listarConversas({ busca: filtro.busca }), avisosDeDesconexao()])
  const conversas = filtrarConversas(todas, filtro)
  // Um id inválido ou de outra clínica dá null: a tela pede para escolher na fila.
  const idAberta = pedida ?? conversas[0]?.id
  const aberta = idAberta && z.string().uuid().safeParse(idAberta).success ? await abrirConversa(idAberta) : null

  return (
    <CaixaDeConversas
      conversas={conversas}
      contagens={contarPorEstado(todas)}
      filtro={filtro}
      aberta={aberta}
      celularNaConversa={Boolean(pedida)}
      agora={agora}
      caminho={ROTA}
      caminhoDaFicha="/dashboard/patients"
      modo={{ tipo: "clinica", agir }}
      aoVivo={<AoVivo clinicId={clinicId} />}
      aviso={
        avisos.length > 0 && (
          <AvisoDeDesconexao
            avisos={avisos}
            agora={agora}
            podeReconectar={role === "owner"}
            agentesHref="/dashboard/agents"
          />
        )
      }
    />
  )
}
