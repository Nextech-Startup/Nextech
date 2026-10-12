import type { Metadata } from "next"
import { z } from "zod"
import { requireClinicContext } from "@/lib/auth/context"
import { abrirConversa, avisosDeDesconexao, listarConversas } from "@/lib/conversations/queries"
import { relogioDoMinuto } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { AoVivo } from "@/components/conversations/ao-vivo"
import { AvisoDeDesconexao } from "@/components/conversations/aviso-de-desconexao"
import { CaixaDeConversas } from "@/components/conversations/caixa-de-conversas"
import { filtrarConversas, lerFiltroDeEstado } from "@/components/conversations/estado"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { agir, buscar } from "./acoes"

export const metadata: Metadata = {
  title: "Conversas",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/conversations"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

const UUID = z.string().uuid()

/**
 * A conversa pedida na URL não depende da fila: com um uuid, a leitura sai
 * já, junto da fila, e não depois dela (~300 ms a menos contra o Supabase
 * em Oregon). Sem pedido, ou com um id que não é do banco, não há o que ler.
 */
function abrirPedida(pedida: string | undefined) {
  return pedida && UUID.safeParse(pedida).success ? abrirConversa(pedida) : Promise.resolve(null)
}

/**
 * A caixa de conversas, em dois ramos pelo mesmo `isDemo`:
 * - na conta de demonstração, a conversa real do canal de demonstração
 *   (evolution-demo-v1) e as de exemplo trazidas para hoje (demo-account-v1),
 *   numa fila só. A real abre com as ações reais; a de exemplo, com o
 *   protótipo e o caminho da ficha;
 * - nas outras, a tela real (conversation-engine-v1, parte 4): a fila e a
 *   conversa decifradas no servidor, o tempo real pelo canal privado da
 *   clínica, as ações de assumir, devolver e resolver a urgência, e o aviso
 *   de desconexão do WhatsApp.
 *
 * Nos dois ramos, o `?q=` nunca é lido: nome e telefone de paciente não
 * vivem na URL. A busca é por POST (BuscaDaFila e a action `buscar`).
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
  const estado = lerFiltroDeEstado(texto(params.status))
  const pedida = texto(params.c)
  const filtro = { estado, busca: "" }

  if (isDemo) {
    // No minuto real: a conversa real e as de exemplo no mesmo relógio.
    const relogio = relogioDoMinuto(AGORA)
    const exemplos = relogio.deslocar(CONVERSAS)
    const [reais, pedidaDoBanco] = await Promise.all([listarConversas(), abrirPedida(pedida)])
    const todas = [...reais, ...exemplos]
    const conversas = filtrarConversas(todas, filtro)
    const idAberta = pedida ?? conversas[0]?.id
    // O id diz de onde a conversa vem: uuid é do banco, o resto é fixture.
    const real = Boolean(idAberta && UUID.safeParse(idAberta).success)
    const aberta = !idAberta
      ? null
      : real
        ? pedida
          ? pedidaDoBanco
          : await abrirConversa(idAberta)
        : (exemplos.find((c) => c.id === idAberta) ?? null)

    return (
      <CaixaDeConversas
        todas={todas}
        filtro={filtro}
        aberta={aberta}
        celularNaConversa={Boolean(pedida)}
        agora={relogio.agora}
        caminho={ROTA}
        // O paciente real não está em Pacientes, que só tem o de exemplo.
        caminhoDaFicha={real ? undefined : "/dashboard/patients"}
        modo={real ? { tipo: "clinica", agir } : undefined}
        buscar={buscar}
        aoVivo={<AoVivo clinicId={clinicId} />}
      />
    )
  }

  const agora = new Date().toISOString()
  const [todas, avisos, pedidaDoBanco] = await Promise.all([
    listarConversas(),
    avisosDeDesconexao(),
    abrirPedida(pedida),
  ])
  const conversas = filtrarConversas(todas, filtro)
  // Um id inválido ou de outra clínica dá null: a tela pede para escolher na fila.
  const primeira = conversas[0]?.id
  const aberta = pedida ? pedidaDoBanco : primeira ? await abrirConversa(primeira) : null

  return (
    <CaixaDeConversas
      todas={todas}
      filtro={filtro}
      aberta={aberta}
      celularNaConversa={Boolean(pedida)}
      agora={agora}
      caminho={ROTA}
      // Pacientes ainda é "em breve" fora da demonstração: sem link para a ficha.
      modo={{ tipo: "clinica", agir }}
      buscar={buscar}
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
