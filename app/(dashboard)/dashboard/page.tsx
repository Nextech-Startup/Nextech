import { requireClinicContext } from "@/lib/auth/context"
import { getCurrentClinic } from "@/lib/clinics/queries"

export default async function DashboardPage() {
  const { role } = await requireClinicContext()

  // Profissional não tem visão geral no menu (seção 2 do desenho de
  // navegação). Mas `/dashboard` é a raiz do painel, então ele cai aqui
  // ao entrar. Mostrar KPIs da clínica inteira contradiria o menu.
  if (role === "professional") {
    return <AguardandoMinhasTelas />
  }

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

/**
 * Estado vazio do profissional: as telas dele (Agenda e Pacientes) são das
 * fases 5 e 3a. Diz o que vai aparecer aqui, em vez de deixar a tela muda.
 */
function AguardandoMinhasTelas() {
  return (
    <div className="max-w-md space-y-2">
      <h1 className="text-2xl font-semibold">Sua área ainda está em construção</h1>
      <p className="text-[var(--text-2)]">
        Sua agenda e seus pacientes aparecem aqui assim que estiverem prontos.
        O menu à esquerda mostra o que vem primeiro.
      </p>
    </div>
  )
}
