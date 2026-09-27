import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { TelaDeVisaoGeral } from "@/components/overview/tela-de-visao-geral"
import type { Periodo } from "@/components/overview/tipos"
import { AGORA } from "@/app/_fixtures/agora"
import { VISAO_GERAL } from "@/app/_fixtures/visao-geral"

export const metadata: Metadata = {
  title: "Protótipo: Visão geral",
  robots: { index: false, follow: false },
}

const ROTA = "/admin/design-system/telas/visao-geral"

/** Junta fixture e componente; a rota real trocará só a fonte do dado. */
export default async function VisaoGeralPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { periodo: pedido } = await searchParams
  const periodo: Periodo = pedido === "7d" ? "7d" : "mes"

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b) e agenda (fase 5)" />
      <TelaDeVisaoGeral
        dados={VISAO_GERAL}
        periodo={periodo}
        agora={AGORA}
        hrefDoPeriodo={{ "7d": `${ROTA}?periodo=7d`, mes: ROTA }}
        hrefDaConversa={(id) => `/admin/design-system/telas/conversas?c=${id}`}
      />
    </div>
  )
}
