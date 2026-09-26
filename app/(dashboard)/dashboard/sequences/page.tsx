import { DataList, DataRow, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function SequencesPage() {
  return <WorkspacePage eyebrow="Automação" title="Sequências" description="Crie jornadas automáticas para acompanhar cada etapa do relacionamento com o paciente." action={{ label: "Nova sequência" }}>
    <WorkspaceToolbar placeholder="Buscar sequência" filters={["Todos os status", "Ativas", "Rascunhos"]} />
    <DataList><DataRow title="Lembrete de consulta" detail="3 mensagens · 24 horas antes do horário" meta="124 inscritos" status="success" /><DataRow title="Boas-vindas" detail="2 mensagens · após o primeiro contato" meta="86 inscritos" status="success" /><DataRow title="Retorno pós-consulta" detail="4 mensagens · 1 dia após o atendimento" meta="Em edição" status="warning" /></DataList>
  </WorkspacePage>
}
