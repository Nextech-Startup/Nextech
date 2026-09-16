import type { Metadata } from "next"
import { listClinics, getPlatformStats } from "@/lib/admin/queries"
import { NovaClinicaForm } from "./nova-clinica-form"
import { ClinicaRow } from "./clinica-row"

export const metadata: Metadata = {
  title: "Clínicas",
  robots: { index: false, follow: false },
}

// Painel interno lê estado que muda a cada ação — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const [clinicas, stats] = await Promise.all([listClinics(), getPlatformStats()])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clínicas</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Onboarding consultivo: a equipe cria a clínica e convida o primeiro
            responsável.
          </p>
        </div>

        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{stats.total}</div>
            <div className="text-[var(--text-3)]">total</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]">
              {stats.ativas}
            </div>
            <div className="text-[var(--text-3)]">ativas</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{stats.rascunho}</div>
            <div className="text-[var(--text-3)]">rascunho</div>
          </div>
        </div>
      </div>

      <NovaClinicaForm />

      {clinicas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--hairline)] p-10 text-center">
          <p className="text-[var(--text-2)]">Nenhuma clínica cadastrada ainda.</p>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Crie a primeira no formulário acima.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--hairline)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[var(--text-2)]">
              <tr>
                <th className="px-4 py-3 font-medium">Razão social</th>
                <th className="px-4 py-3 font-medium">CNPJ</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clinicas.map((c) => (
                <ClinicaRow key={c.id} clinica={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
