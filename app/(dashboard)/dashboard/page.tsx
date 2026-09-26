import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarCheck, Check, MessagesSquare, Repeat2, UserX } from "lucide-react"
import { requireClinicContext } from "@/lib/auth/context"
import { getCurrentClinic } from "@/lib/clinics/queries"
import {
  getRegulatoryIdentity,
  listProcedures,
  listProfessionals,
} from "@/lib/clinic-profile/queries"
import { pendenciasRegulatorias } from "@/lib/clinic-profile/schema"
import { listAgents } from "@/lib/agent-config/queries"
import { ROTULO_DA_ESPECIALIDADE, estaConectado, type Agent } from "@/lib/agent-config/schema"
import { passosDoOnboarding, proximoPasso, type Passo } from "@/lib/onboarding/passos"
import { PageHeader } from "@/components/patterns/page-header"
import { KpiCard } from "@/components/patterns/kpi-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
}

// Reflete cada passo que a clínica acabou de concluir — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { role } = await requireClinicContext()

  // Profissional não tem visão geral no menu (seção 2 do desenho de
  // navegação), mas `/dashboard` é a raiz e ele cai aqui ao entrar.
  if (role === "professional") return <AguardandoMinhasTelas />

  const clinic = await getCurrentClinic()
  const ativa = clinic.status === "active"
  const cabecalho = (
    <PageHeader
      title="Visão geral"
      description={clinic.legal_name}
      status={
        <StatusBadge tone={ativa ? "success" : "neutral"}>
          {ativa ? "Clínica ativa" : "Em configuração"}
        </StatusBadge>
      }
    />
  )

  // Primeiros passos e agentes são configuração: só o owner age sobre eles.
  if (role !== "owner") {
    return (
      <div className="grid gap-10">
        {cabecalho}
        <Indicadores />
      </div>
    )
  }

  const [identidade, profissionais, procedimentos, agentes] = await Promise.all([
    getRegulatoryIdentity(),
    listProfessionals(),
    listProcedures(),
    listAgents(),
  ])

  const passos = passosDoOnboarding({
    pendenciasRegulatorias: pendenciasRegulatorias(identidade).length,
    profissionaisAtivos: profissionais.filter((p) => p.active).length,
    procedimentosAtivos: procedimentos.filter((p) => p.active).length,
    agentes: agentes.map((a) => ({ status: a.status, conectado: estaConectado(a) })),
  })
  const proximo = proximoPasso(passos)

  return (
    <div className="grid gap-10">
      {cabecalho}
      {proximo && <PrimeirosPassos passos={passos} proximo={proximo} />}
      <Indicadores />
      <SeusAgentes agentes={agentes} />
    </div>
  )
}

/**
 * O elemento memorável da tela: o caminho do cadastro ao primeiro paciente
 * atendido, com o brilho da aurora da landing. Some quando tudo está feito.
 */
function PrimeirosPassos({ passos, proximo }: { passos: Passo[]; proximo: Passo }) {
  const feitos = passos.filter((p) => p.feito).length

  return (
    <section
      aria-labelledby="passos-titulo"
      className="painel-glow rounded-card border border-hairline p-6 sm:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="grid content-start gap-4">
          <h2 id="passos-titulo" className="font-display text-2xl tracking-tight text-ink-1">
            Primeiros passos
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">
            Do cadastro ao primeiro paciente atendido. Cada passo usa o que o
            anterior deixou pronto.
          </p>
          <div className="grid gap-2">
            <p className="text-xs text-ink-3">
              {feitos} de {passos.length} concluídos
            </p>
            <Progress
              value={(feitos / passos.length) * 100}
              aria-label="Progresso da configuração"
              className="h-1.5 bg-surface-2 [&_[data-slot=progress-indicator]]:bg-brand"
            />
          </div>
          <Button asChild variant="brand" className="w-fit">
            <Link href={proximo.href}>
              {proximo.acao}
              <ArrowRight data-icon aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <ol className="grid gap-1">
          {passos.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex gap-3 rounded-xl px-3 py-2.5",
                p.id === proximo.id && "bg-accent",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border",
                  p.feito ? "border-transparent bg-brand text-surface-0" : "border-hairline",
                )}
              >
                {p.feito && <Check className="size-3" />}
              </span>
              <div className="grid gap-0.5">
                <p className={cn("text-sm font-medium", p.feito ? "text-ink-3" : "text-ink-1")}>
                  {p.titulo}
                  <span className="sr-only">{p.feito ? ", concluído" : ", pendente"}</span>
                </p>
                <p className="text-xs text-ink-3">{p.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Os quatro KPIs da spec. Nenhum tem fonte ainda: cada um diz de onde vem. */
function Indicadores() {
  return (
    <section aria-labelledby="indicadores-titulo" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="indicadores-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Indicadores do mês
        </h2>
        <p className="text-xs text-ink-3">Chegam quando o atendimento estiver no ar</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Atendimentos"
          icon={<MessagesSquare />}
          pendente="Contados quando o agente começar a conversar com pacientes."
        />
        <KpiCard
          label="Conversão em agendamento"
          icon={<CalendarCheck />}
          pendente="Depende do motor de conversa identificar quem quer agendar."
        />
        <KpiCard label="Faltas" icon={<UserX />} pendente="Depende da agenda integrada." />
        <KpiCard
          label="Pacientes reativados"
          icon={<Repeat2 />}
          pendente="Depende das sequências de reativação."
        />
      </div>
    </section>
  )
}

function SeusAgentes({ agentes }: { agentes: Agent[] }) {
  return (
    <section aria-labelledby="agentes-titulo" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agentes-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Agentes
        </h2>
        <Link
          href="/dashboard/agents"
          className="text-sm text-ink-2 underline-offset-4 transition-colors hover:text-ink-1 hover:underline"
        >
          Gerenciar agentes
        </Link>
      </div>
      {agentes.length === 0 ? (
        <Vazio>Nenhum agente criado ainda. Ele aparece aqui assim que existir.</Vazio>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
          {agentes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent"
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate text-sm font-medium text-ink-1">{a.name}</p>
                  <p className="text-xs text-ink-3">{ROTULO_DA_ESPECIALIDADE[a.specialty]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">
                    {estaConectado(a) ? "WhatsApp conectado" : "Sem WhatsApp"}
                  </span>
                  <StatusDoAgente status={a.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Estado do profissional: as telas dele (Agenda e Pacientes) ainda não
 * existem. Diz o que vai aparecer aqui, em vez de deixar a tela muda.
 */
function AguardandoMinhasTelas() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Sua área está chegando" />
      <Vazio>
        Sua agenda e seus pacientes aparecem aqui assim que estiverem prontos. O
        menu à esquerda mostra o que vem primeiro.
      </Vazio>
    </div>
  )
}
