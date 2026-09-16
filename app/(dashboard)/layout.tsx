import { requireClinicContext } from "@/lib/auth/context"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve o tenant uma vez por requisição. Lança se não houver vínculo —
  // o middleware já garantiu que existe sessão antes de chegar aqui.
  const { clinicId } = await requireClinicContext()

  return (
    <div className="min-h-dvh bg-[var(--surface-0)] text-[var(--text-1)]">
      <main className="mx-auto max-w-6xl px-4 py-8" data-clinic-id={clinicId}>
        {children}
      </main>
    </div>
  )
}
