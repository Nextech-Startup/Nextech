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
import { Selo } from "./ui"

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
      conteudo: <AbaUrgencia regras={regras} />,
    },
    {
      id: "consentimento",
      label: "Consentimento",
      conteudo: <AbaConsentimento consent={consent} />,
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Perfil da clínica</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {clinic.legal_name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {clinic.status === "active" ? (
            <Selo tom="ativo">ativa</Selo>
          ) : (
            <Selo>rascunho</Selo>
          )}
          {pendencias.length > 0 && (
            <Selo tom="alerta">
              {pendencias.length}{" "}
              {pendencias.length === 1 ? "pendência" : "pendências"}
            </Selo>
          )}
        </div>
      </header>

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
    <div className="max-w-md space-y-2">
      <h1 className="text-2xl font-semibold">Perfil da clínica</h1>
      <p className="text-[var(--text-2)]">
        Só o responsável pela clínica edita o perfil. Fale com quem administra a
        conta se precisar alterar algum dado aqui.
      </p>
    </div>
  )
}
