import { CalendarDays } from "lucide-react"
import { EmptyWorkspace, WorkspacePage, WorkspaceToolbar } from "@/components/patterns/workspace-page"

export default function SchedulePage() {
  return <WorkspacePage prototipo="agendamento (fase 5)" title="Agenda" description="Tenha uma visão clara dos próximos compromissos e da disponibilidade da equipe." action={{ label: "Novo agendamento" }}>
    <WorkspaceToolbar placeholder="Buscar por paciente ou profissional" filters={["Hoje", "Esta semana", "Todos os profissionais"]} />
    <div className="grid gap-4 md:grid-cols-7">{["Seg 21", "Ter 22", "Qua 23", "Qui 24", "Sex 25", "Sáb 26", "Dom 27"].map((day, index) => <div key={day} className="min-h-44 rounded-card border border-hairline bg-surface-1 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{day}</p>{index < 5 && <div className="mt-4 rounded-lg border-l-2 border-brand bg-brand/5 p-3"><p className="text-sm font-medium text-ink-1">{index + 1} consultas</p><p className="mt-1 text-xs text-ink-2">A partir das 08:30</p></div>}</div>)}</div>
    <EmptyWorkspace title="Agenda integrada" description="Conecte sua agenda para sincronizar horários e permitir que os agentes façam agendamentos automaticamente." action="Configurar integração" />
    <CalendarDays className="sr-only" />
  </WorkspacePage>
}
