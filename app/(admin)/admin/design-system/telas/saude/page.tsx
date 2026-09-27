import type { Metadata } from "next"
import { TelaDeSaude } from "@/components/admin/tela-de-saude"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGORA } from "@/app/_fixtures/agora"
import { SAUDE } from "@/app/_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Saúde",
  robots: { index: false, follow: false },
}

export default function SaudePrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b) e sequências (fase 4)" />
      <TelaDeSaude saude={SAUDE} agora={AGORA} />
    </div>
  )
}
