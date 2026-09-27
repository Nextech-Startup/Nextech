import type { Metadata } from "next"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { TelaDeEquipe } from "@/components/team/tela-de-equipe"
import { AGORA } from "../../_fixtures/agora"
import { ALTERACOES, CONVITES, MEMBROS } from "../../_fixtures/equipe"

export const metadata: Metadata = {
  title: "Protótipo: Equipe e acessos",
  robots: { index: false, follow: false },
}

export default function EquipePrototipo() {
  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="convite de equipe por e-mail (depende do Resend)" />
      <TelaDeEquipe
        membros={MEMBROS}
        convites={CONVITES}
        alteracoes={ALTERACOES}
        agora={AGORA}
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
