import { MessageSquare } from "lucide-react"
import { DataList, DataRow, EmptyWorkspace, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function ConversationsPage() {
  return <WorkspacePage prototipo="motor de conversa (fase 3b)" title="Conversas" description="Acompanhe atendimentos, identifique gargalos e assuma uma conversa quando necessário." action={{ label: "Nova conversa" }}>
    <WorkspaceToolbar placeholder="Buscar por paciente ou assunto" filters={["Todos os status", "Em andamento", "Resolvidas"]} />
    <DataList>
      <DataRow title="Mariana Alves" detail="Agente Recepção · Precisa confirmar o horário da consulta" meta="há 4 min" status="success" />
      <DataRow title="Rafael Mendes" detail="Triagem inicial · Enviou documentos para avaliação" meta="há 18 min" status="info" />
      <DataRow title="Camila Duarte" detail="Pós-consulta · Aguardando retorno da equipe" meta="há 42 min" status="warning" />
    </DataList>
    <div className="rounded-card border border-dashed border-hairline p-6 text-center text-sm text-ink-2"><MessageSquare className="mx-auto mb-2 size-5 text-brand" />Mostrando as conversas mais recentes da clínica.</div>
  </WorkspacePage>
}
