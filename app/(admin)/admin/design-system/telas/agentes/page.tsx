import type { Metadata } from "next"
import { ListaDeAgentesEmOperacao } from "@/components/agents/lista-em-operacao"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { AGENTES } from "../../_fixtures/agentes"
import { AGORA } from "../../_fixtures/agora"

export const metadata: Metadata = {
  title: "Protótipo: Agentes",
  robots: { index: false, follow: false },
}

export default function AgentesPrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="motor de conversa (fase 3b)" />
      <ListaDeAgentesEmOperacao
        agentes={AGENTES}
        plano="healthtech"
        agora={AGORA}
        hrefDoAgente={(id) => `/admin/design-system/telas/agentes/${id}`}
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
