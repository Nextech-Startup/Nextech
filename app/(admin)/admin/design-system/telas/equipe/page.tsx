import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { Users } from "lucide-react"
import { DataList, DataRow, EmptyWorkspace, WorkspacePage } from "@/components/patterns/workspace-page"

export default function TeamPage() {
  return <div className="flex flex-col gap-8"><AvisoDePrototipo entrega="convite de equipe por e-mail" /><WorkspacePage title="Equipe e acessos" description="Gerencie quem pode acessar a operação e quais ações cada pessoa pode realizar." action={{ label: "Convidar membro" }}>
    <DataList><DataRow title="Ana Carolina" detail="ana@nextech.com · Proprietária" meta="Acesso total" status="success" /><DataRow title="João Pedro" detail="joao@nextech.com · Atendimento" meta="Operação" status="success" /><DataRow title="Convite pendente" detail="novo.membro@email.com · Enviado hoje" meta="Aguardando" status="warning" /></DataList>
    <EmptyWorkspace title="Permissões por função" description="Defina níveis de acesso para manter sua operação segura e organizada." action="Configurar funções" />
    <Users className="sr-only" />
  </WorkspacePage></div>
}
