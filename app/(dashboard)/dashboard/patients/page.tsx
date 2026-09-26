import { DataList, DataRow, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function PatientsPage() {
  return <WorkspacePage eyebrow="Operação" title="Pacientes" description="Centralize os contatos e o histórico de relacionamento da sua clínica." action={{ label: "Cadastrar paciente" }}>
    <WorkspaceToolbar placeholder="Buscar por nome, telefone ou e-mail" filters={["Todos", "Ativos", "Inativos"]} />
    <DataList>
      <DataRow title="Mariana Alves" detail="mariana.alves@email.com · Último contato hoje" meta="642 interações" status="success" />
      <DataRow title="Rafael Mendes" detail="rafael.mendes@email.com · Último contato ontem" meta="18 interações" status="success" />
      <DataRow title="Camila Duarte" detail="camila.duarte@email.com · Último contato há 12 dias" meta="8 interações" status="warning" />
      <DataRow title="Lucas Ferreira" detail="lucas.ferreira@email.com · Primeiro contato" meta="1 interação" status="neutral" />
    </DataList>
  </WorkspacePage>
}
