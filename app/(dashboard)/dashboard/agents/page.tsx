import type { Metadata } from "next"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { getClinicPlan, listAgents } from "@/lib/agent-config/queries"
import { ListaDeAgentes } from "./lista"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { ListaDeAgentesEmOperacao } from "@/components/agents/lista-em-operacao"
import { AGENTES } from "@/app/_fixtures/agentes"
import { AGORA } from "@/app/_fixtures/agora"

export const metadata: Metadata = {
  title: "Agentes",
  robots: { index: false, follow: false },
}

// Lista que muda a cada ação da própria tela — nunca cacheia.
export const dynamic = "force-dynamic"

const ROTA = "/dashboard/agents"

export default async function AgentsPage() {
  const { role, isDemo } = await requireClinicContext()

  // A sidebar já esconde o item de quem não é owner, e a RLS recusa a
  // escrita. Esta checagem é o que impede alguém de chegar aqui digitando
  // a URL e ver a configuração dos agentes.
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Agentes" rota={ROTA} role={role} demo={isDemo} />
  }

  // Conta de demonstração (spec demo-account-v1): os agentes em operação do
  // protótipo, e nenhuma consulta ao dado real.
  if (isDemo) {
    const relogio = relogioDaDemonstracao(AGORA)
    return (
      <ListaDeAgentesEmOperacao
        agentes={relogio.deslocar(AGENTES)}
        plano="healthtech"
        agora={relogio.agora}
        hrefDoAgente={(id) => `${ROTA}/${id}`}
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    )
  }

  const [agentes, plano] = await Promise.all([listAgents(), getClinicPlan()])

  return <ListaDeAgentes agentes={agentes} plano={plano} />
}
