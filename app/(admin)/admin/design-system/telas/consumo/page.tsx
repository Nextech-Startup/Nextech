import type { Metadata } from "next"
import { TelaDeConsumo } from "@/components/admin/tela-de-consumo"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGORA } from "../../_fixtures/agora"
import { CONSUMO } from "../../_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Consumo",
  robots: { index: false, follow: false },
}

export default function ConsumoPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="contagem de atendimentos (fase 3b) e cobrança (fase 7)" />
      <TelaDeConsumo clinicas={CONSUMO} agora={AGORA} />
    </div>
  )
}
