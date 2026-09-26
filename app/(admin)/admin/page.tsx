import type { Metadata } from "next"
import { listClinics, getPlatformStats } from "@/lib/admin/queries"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
    <div className="grid gap-8">
      <PageHeader
        title="Clínicas"
        description="Onboarding consultivo: a equipe cria a clínica e convida o primeiro responsável."
        actions={<Numeros total={stats.total} ativas={stats.ativas} rascunho={stats.rascunho} />}
      />

      <NovaClinicaForm />

      {clinicas.length === 0 ? (
        <Vazio>Nenhuma clínica cadastrada ainda. Crie a primeira no botão acima.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table>
            <TableHeader className="bg-surface-2/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Razão social</TableHead>
                <TableHead className="px-4">CNPJ</TableHead>
                <TableHead className="px-4">Equipe</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicas.map((c) => (
                <ClinicaRow key={c.id} clinica={c} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Numeros({ total, ativas, rascunho }: { total: number; ativas: number; rascunho: number }) {
  const itens = [
    { rotulo: "no total", valor: total },
    { rotulo: "ativas", valor: ativas },
    { rotulo: "em rascunho", valor: rascunho },
  ]
  return (
    <dl className="flex gap-6">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-col-reverse">
          <dt className="text-xs text-ink-3">{i.rotulo}</dt>
          <dd className="font-display text-2xl text-ink-1">{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
