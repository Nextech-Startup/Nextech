import type { Metadata } from "next"
import { ClinicasParaSuporte } from "@/components/admin/tela-de-suporte"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { RESUMOS_DE_SUPORTE } from "../../_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Conversas de suporte",
  robots: { index: false, follow: false },
}

export default function SuportePrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b) e a trilha de acesso de suporte" />
      <ClinicasParaSuporte
        clinicas={RESUMOS_DE_SUPORTE}
        hrefDaClinica={(id) => `/admin/design-system/telas/suporte/${id}`}
      />
    </div>
  )
}
