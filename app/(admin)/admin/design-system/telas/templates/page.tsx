import { DataList, DataRow, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function TemplatesPage() {
  return <WorkspacePage prototipo="templates do WhatsApp (fase 4)" eyebrow="Automação" title="Templates" description="Padronize as mensagens que seus agentes usam em cada ponto da jornada." action={{ label: "Novo template" }}>
    <WorkspaceToolbar placeholder="Buscar template" filters={["Todas as categorias", "WhatsApp", "E-mail"]} />
    <DataList><DataRow title="Confirmação de consulta" detail="WhatsApp · Atualizado há 2 dias" meta="Publicado" status="success" /><DataRow title="Lembrete de documentos" detail="WhatsApp · Atualizado há 5 dias" meta="Publicado" status="success" /><DataRow title="Pesquisa de satisfação" detail="E-mail · Criado há 1 semana" meta="Rascunho" status="neutral" /></DataList>
  </WorkspacePage>
}
