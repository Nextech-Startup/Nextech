import { ArrowUpRight, Bot, CalendarDays, MessageSquare, MoreHorizontal, Users } from "lucide-react"

import { requireClinicContext } from "@/lib/auth/context"
import { getCurrentClinic } from "@/lib/clinics/queries"
import { KpiCard } from "@/components/patterns/kpi-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { PageHeader } from "@/components/patterns/page-header"

const activity = [
  { title: "Novo atendimento iniciado", detail: "Agente Recepção · há 4 min", status: "Em andamento" },
  { title: "Consulta confirmada", detail: "Mariana Alves · hoje, 14:30", status: "Concluído" },
  { title: "Agente atualizado", detail: "Triagem inicial · há 42 min", status: "Publicado" },
  { title: "Novo paciente cadastrado", detail: "Rafael Mendes · há 1 h", status: "Concluído" },
]

export default async function DashboardPage() {
  const { role } = await requireClinicContext()
  const clinic = await getCurrentClinic()

  if (role === "professional") return <AguardandoMinhasTelas />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${clinic.legal_name}`}
        description={clinic.status === "draft" ? "Complete o perfil da clínica para publicar seu primeiro agente." : "Acompanhe sua operação em tempo real."}
        action={{ label: "Ver agentes", href: "/dashboard/agents" }}
      />

      <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Conversas este mês" value="1.284" detail={<span className="text-success-fg">+18,2%</span>} icon={<MessageSquare />} />
        <KpiCard label="Pacientes ativos" value="642" detail={<span className="text-success-fg">+8,4%</span>} icon={<Users />} />
        <KpiCard label="Taxa de resolução" value="94,8%" detail={<span className="text-success-fg">+3,1%</span>} icon={<Bot />} />
        <KpiCard label="Agendamentos" value="86" detail={<span className="text-ink-2">nos próximos 7 dias</span>} icon={<CalendarDays />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-card border border-hairline bg-surface-1 p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg text-ink-1">Atividade da operação</h2>
              <p className="mt-1 text-sm text-ink-2">Conversas iniciadas nos últimos 30 dias</p>
            </div>
            <button type="button" aria-label="Mais opções" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink-1"><MoreHorizontal /></button>
          </div>
          <div className="flex h-52 items-end gap-2 sm:gap-3" aria-label="Gráfico de conversas">
            {[42, 55, 48, 72, 64, 80, 68, 92, 74, 86, 78, 96, 83, 100, 88, 92, 76, 90, 84, 98].map((height, index) => (
              <div key={index} className="group flex min-w-0 flex-1 flex-col justify-end gap-2">
                <div className="relative h-full rounded-t-md bg-surface-2">
                  <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-brand transition-all group-hover:bg-brand-strong" style={{ height: `${height}%` }} />
                </div>
                {index % 4 === 0 ? <span className="text-center text-[10px] text-ink-3">{index + 1} set</span> : <span className="h-3" />}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-hairline bg-surface-1 p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><h2 className="font-display text-lg text-ink-1">Seus agentes</h2><p className="mt-1 text-sm text-ink-2">Status atual da automação</p></div>
            <a href="/dashboard/agents" className="text-sm font-medium text-brand-on-light hover:underline dark:text-brand">Ver todos</a>
          </div>
          <div className="flex flex-col gap-5">
            {[{ name: "Recepção Nextech", type: "Atendimento geral", status: "Ativo" }, { name: "Triagem inicial", type: "Qualificação", status: "Ativo" }, { name: "Pós-consulta", type: "Relacionamento", status: "Rascunho" }].map((agent) => (
              <div key={agent.name} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Bot /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-ink-1">{agent.name}</p><p className="truncate text-xs text-ink-2">{agent.type}</p></div></div>
                <StatusBadge status={agent.status === "Ativo" ? "success" : "neutral"}>{agent.status}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-surface-1 p-6">
        <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="font-display text-lg text-ink-1">Atividade recente</h2><p className="mt-1 text-sm text-ink-2">As últimas atualizações da sua clínica</p></div><a href="/dashboard/agents" className="inline-flex items-center gap-1 text-sm font-medium text-brand-on-light hover:underline dark:text-brand">Abrir atividade <ArrowUpRight /></a></div>
        <div className="divide-y divide-hairline">{activity.map((item) => <div key={item.title} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-ink-1">{item.title}</p><p className="mt-1 text-xs text-ink-2">{item.detail}</p></div><StatusBadge status={item.status === "Concluído" ? "success" : item.status === "Publicado" ? "info" : "warning"}>{item.status}</StatusBadge></div>)}</div>
      </section>
    </div>
  )
}

function AguardandoMinhasTelas() {
  return <div className="max-w-md"><PageHeader eyebrow="Área profissional" title="Suas telas estão chegando" description="Sua agenda e seus pacientes aparecerão aqui assim que estiverem prontos. O menu à esquerda mostra o que vem primeiro." /></div>
}
