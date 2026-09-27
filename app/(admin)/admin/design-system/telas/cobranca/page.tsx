import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { TelaDeCobranca } from "@/components/billing/tela-de-cobranca"
import { AGORA } from "../../_fixtures/agora"
import { COBRANCA } from "../../_fixtures/cobranca"

export const metadata: Metadata = {
  title: "Protótipo: Plano e cobrança",
  robots: { index: false, follow: false },
}

export default function CobrancaPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="cobrança pelo Asaas (fase 7)" />
      <TelaDeCobranca
        resumo={COBRANCA}
        agora={AGORA}
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
