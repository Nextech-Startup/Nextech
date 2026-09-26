import { DataList, DataRow, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function PatientsPage() {
  return <WorkspacePage prototipo="tela de pacientes (os dados já existem)" title="Pacientes" description="Centralize os contatos e o histórico de relacionamento da sua clínica." action={{ label: "Cadastrar paciente" }}>
    <WorkspaceToolbar placeholder="Buscar por nome ou telefone" filters={["Todos", "Ativos", "Inativos"]} />
    <DataList>
      <DataRow title="Mariana Alves" detail="(81) 90000-0001 · Último contato hoje" meta="642 interações" status="success" />
      <DataRow title="Rafael Mendes" detail="(81) 90000-0002 · Último contato ontem" meta="18 interações" status="success" />
      <DataRow title="Camila Duarte" detail="(81) 90000-0003 · Último contato há 12 dias" meta="8 interações" status="warning" />
      <DataRow title="Lucas Ferreira" detail="(81) 90000-0004 · Primeiro contato" meta="1 interação" status="neutral" />
    </DataList>
  </WorkspacePage>
}
