import type { Metadata } from "next"
import { requireClinicContext } from "@/lib/auth/context"
import { podeAcessar } from "@/lib/navigation/acesso"
import { getClinicPlan, listAgents } from "@/lib/agent-config/queries"
import { ListaDeAgentes } from "./lista"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"

export const metadata: Metadata = {
  title: "Agentes",
  robots: { index: false, follow: false },
}

// Lista que muda a cada ação da própria tela — nunca cacheia.
export const dynamic = "force-dynamic"

const ROTA = "/dashboard/agents"

export default async function AgentsPage() {
  const { role } = await requireClinicContext()

  // A sidebar já esconde o item de quem não é owner, e a RLS recusa a
  // escrita. Esta checagem é o que impede alguém de chegar aqui digitando
  // a URL e ver a configuração dos agentes.
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Agentes" rota={ROTA} role={role} />
  }

  const [agentes, plano] = await Promise.all([listAgents(), getClinicPlan()])

  return <ListaDeAgentes agentes={agentes} plano={plano} />
}
