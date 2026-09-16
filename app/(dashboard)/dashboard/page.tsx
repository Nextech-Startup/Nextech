import { getCurrentClinic } from "@/lib/clinics/queries"

export default async function DashboardPage() {
  const clinic = await getCurrentClinic()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{clinic.legal_name}</h1>
      <p className="text-[var(--text-2)]">
        {clinic.status === "draft"
          ? "Complete o perfil da clínica para publicar seu primeiro agente."
          : "Clínica ativa."}
      </p>
    </div>
  )
}
