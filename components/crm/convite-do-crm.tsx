import { PageHeader } from "@/components/patterns/page-header"
import { ROTULO_DO_PLANO, type ClinicPlan } from "@/lib/agent-config/schema"

/**
 * O CRM no Starter (spec crm-v1, seção 4): o convite para subir de plano.
 * O dado já é gravado em todo plano: quem sobe encontra o funil com histórico.
 */
export function ConviteDoCrm({ plano }: { plano: ClinicPlan }) {
  return (
    <div className="grid gap-6">
      <PageHeader title="CRM" description="O funil comercial da clínica: de quem escreveu até quem fechou." />
      <section className="grid max-w-xl gap-3 rounded-card border border-hairline bg-surface-1/50 p-6">
        <h2 className="text-base font-semibold text-ink-1">O CRM faz parte dos planos Pro e HealthTech</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          Seu plano atual é o {ROTULO_DO_PLANO[plano]}. As oportunidades já são registradas desde a primeira mensagem de
          cada paciente: ao mudar de plano, o funil abre com o histórico.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">Para mudar de plano, fale com a equipe Nextech.</p>
      </section>
    </div>
  )
}
