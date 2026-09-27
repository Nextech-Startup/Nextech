import type { Metadata } from "next"
import { TelaMinhaConta } from "@/components/account/tela-minha-conta"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGORA } from "@/app/_fixtures/agora"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"

export const metadata: Metadata = {
  title: "Protótipo: Minha conta",
  robots: { index: false, follow: false },
}

export default function MinhaContaPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="e-mail transacional (Resend)" />
      <TelaMinhaConta conta={MINHA_CONTA} agora={AGORA} acaoDesabilitada="Protótipo: a ação ainda não existe" />
    </div>
  )
}
