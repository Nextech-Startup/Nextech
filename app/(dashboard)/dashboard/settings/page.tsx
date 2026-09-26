import { Suspense } from "react"
import type { Metadata } from "next"
import { requireClinicContext } from "@/lib/auth/context"
import {
  getConsentText,
  getRegulatoryIdentity,
  getSchedulingPolicy,
  listInsurances,
  listProcedures,
  listProfessionals,
  listUrgencyRules,
} from "@/lib/clinic-profile/queries"
import { pendenciasRegulatorias } from "@/lib/clinic-profile/schema"
import { Abas } from "./abas"
import {
  AbaConvenios,
  AbaEquipe,
  AbaIdentidade,
  AbaPolitica,
  AbaProcedimentos,
} from "./abas-cadastro"
import { AbaConsentimento, AbaUrgencia } from "./abas-sensiveis"
import { StatusBadge } from "@/components/patterns/status-badge"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"

export const metadata: Metadata = {
  title: "Perfil da clínica",
  robots: { index: false, follow: false },
}

// Cadastro que muda a cada ação da própria tela — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { role } = await requireClinicContext()

  // A sidebar já esconde este item de quem não é owner, e a RLS recusa a
  // escrita. Esconder é usabilidade; esta checagem é o que impede alguém
  // de chegar aqui digitando a URL e ver a equipe e o responsável técnico.
  if (role !== "owner") {
    return <SemPermissao />
  }

  // Em paralelo: sete consultas independentes, uma por seção. Em série,
  // a tela esperaria a soma delas para pintar qualquer coisa.
  const [clinic, convenios, profissionais, procedimentos, politica, regras, consent] =
    await Promise.all([
      getRegulatoryIdentity(),
      listInsurances(),
      listProfessionals(),
      listProcedures(),
      getSchedulingPolicy(),
      listUrgencyRules(),
      getConsentText(),
    ])

  const pendencias = pendenciasRegulatorias(clinic)

  const secoes = [
    {
      id: "identidade",
      label: "Identidade",
      alertas: pendencias.length,
      conteudo: <AbaIdentidade clinic={clinic} pendencias={pendencias} />,
    },
    {
      id: "equipe",
      label: "Equipe",
      conteudo: <AbaEquipe profissionais={profissionais} convenios={convenios} />,
    },
    {
      id: "convenios",
      label: "Convênios",
      conteudo: <AbaConvenios convenios={convenios} />,
    },
    {
      id: "procedimentos",
      label: "Procedimentos",
      conteudo: (
        <AbaProcedimentos procedimentos={procedimentos} convenios={convenios} />
      ),
    },
    {
      id: "agendamento",
      label: "Agendamento",
      conteudo: <AbaPolitica politica={politica} />,
    },
    {
      id: "urgencia",
      label: "Urgência",
      alertas: regras.filter((r) => r.confirmed_at === null).length,
      conteudo: <AbaUrgencia regras={regras} />,
    },
    {
      id: "consentimento",
      label: "Consentimento",
      conteudo: <AbaConsentimento consent={consent} />,
    },
  ]

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Perfil da clínica"
        description={clinic.legal_name}
        status={
          <>
            {clinic.status === "active" ? (
              <StatusBadge tone="success">ativa</StatusBadge>
            ) : (
              <StatusBadge>rascunho</StatusBadge>
            )}
            {pendencias.length > 0 && (
              <StatusBadge tone="warning">
                {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
              </StatusBadge>
            )}
          </>
        }
      />

      {/* useSearchParams exige limite de Suspense para não forçar a página
          inteira a renderizar no cliente. */}
      <Suspense fallback={<div className="h-10" />}>
        <Abas secoes={secoes} />
      </Suspense>
    </div>
  )
}

function SemPermissao() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Perfil da clínica" />
      <Vazio>
        Só o responsável pela clínica edita o perfil. Fale com quem administra a
        conta se precisar alterar algum dado aqui.
      </Vazio>
    </div>
  )
}
