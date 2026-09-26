import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { CaixaDeConversas } from "@/components/conversations/caixa-de-conversas"
import {
  contarPorEstado,
  filtrarConversas,
  lerFiltroDeEstado,
} from "@/components/conversations/estado"
import { AGORA } from "../../_fixtures/agora"
import { CONVERSAS } from "../../_fixtures/conversas"

export const metadata: Metadata = {
  title: "Protótipo: Conversas",
  robots: { index: false, follow: false },
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/** Junta fixture e componente; a rota real trocará só a fonte do dado. */
export default async function ConversasPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtro = { estado: lerFiltroDeEstado(texto(params.status)), busca: texto(params.q) ?? "" }
  const conversas = filtrarConversas(CONVERSAS, filtro)
  const pedida = texto(params.c)
  const aberta =
    CONVERSAS.find((c) => c.id === pedida) ??
    CONVERSAS.find((c) => c.id === conversas[0]?.id) ??
    null

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b)" />
      <CaixaDeConversas
        conversas={conversas}
        contagens={contarPorEstado(CONVERSAS)}
        filtro={filtro}
        aberta={aberta}
        celularNaConversa={Boolean(pedida)}
        agora={AGORA}
        caminho="/admin/design-system/telas/conversas"
        caminhoDaFicha="/admin/design-system/telas/pacientes"
      />
    </div>
  )
}
