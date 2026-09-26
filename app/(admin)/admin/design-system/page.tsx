import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/patterns/page-header"

export const metadata: Metadata = {
  title: "Protótipos",
  robots: { index: false, follow: false },
}

const TELAS = [
  { slug: "conversas", nome: "Conversas", entrega: "motor de conversa (fase 3b)" },
  { slug: "pacientes", nome: "Pacientes", entrega: "tela de pacientes" },
  { slug: "agenda", nome: "Agenda", entrega: "agendamento (fase 5)" },
  { slug: "sequencias", nome: "Sequências", entrega: "sequências (fase 4)" },
  { slug: "templates", nome: "Templates", entrega: "templates do WhatsApp (fase 4)" },
  { slug: "equipe", nome: "Equipe e acessos", entrega: "convite de equipe por e-mail" },
  { slug: "cobranca", nome: "Plano e cobrança", entrega: "cobrança (fase 7)" },
] as const

/**
 * Telas desenhadas que ainda não existem para as clínicas. Vivem aqui, e
 * não em app/(dashboard), para que dado fictício nunca apareça numa rota
 * que uma clínica alcance — nem digitando a URL.
 */
export default function PrototiposPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Protótipos"
        description="Telas desenhadas que ainda não existem para as clínicas. Todas usam dados fictícios e só a equipe Nextech as vê."
      />
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
        {TELAS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/admin/design-system/telas/${t.slug}`}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent"
            >
              <div className="grid gap-0.5">
                <p className="text-sm font-medium text-ink-1">{t.nome}</p>
                <p className="text-xs text-ink-3">Entra no ar com: {t.entrega}</p>
              </div>
              <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
