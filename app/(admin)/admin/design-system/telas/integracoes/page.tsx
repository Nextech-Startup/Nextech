import type { Metadata } from "next"
import { TelaDeIntegracoes } from "@/components/integrations/tela-de-integracoes"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGORA } from "@/app/_fixtures/agora"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"

export const metadata: Metadata = {
  title: "Protótipo: Integrações",
  robots: { index: false, follow: false },
}

export default function IntegracoesPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="Google Calendar (fase 5), CRM (fase 6) e eventos da Meta (fase 3b)" />
      <TelaDeIntegracoes painel={INTEGRACOES} agora={AGORA} acaoDesabilitada="Protótipo: a ação ainda não existe" />
    </div>
  )
}
