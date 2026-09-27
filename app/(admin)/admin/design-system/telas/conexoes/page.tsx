import type { Metadata } from "next"
import { TelaDeConexoes } from "@/components/admin/tela-de-conexoes"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGORA } from "@/app/_fixtures/agora"
import { CONEXOES } from "@/app/_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Conexões",
  robots: { index: false, follow: false },
}

export default function ConexoesPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="eventos da Meta (fase 3b) e templates (fase 4)" />
      <TelaDeConexoes clinicas={CONEXOES} agora={AGORA} />
    </div>
  )
}
