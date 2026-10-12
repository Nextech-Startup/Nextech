import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import type { NivelDeSaude, Saude } from "@/lib/agent-config/saude"

/**
 * Status diz o que a clínica decidiu (rascunho, publicado, pausado); saúde
 * diz se isso está funcionando. Os dois aparecem juntos porque divergem
 * justamente quando importa: publicado e com falha.
 */
export const TOM_DA_SAUDE: Record<NivelDeSaude, StatusTone> = {
  ok: "success",
  atencao: "warning",
  falha: "danger",
  "fora-do-ar": "neutral",
}

export const ROTULO_DA_SAUDE: Record<NivelDeSaude, string> = {
  ok: "No ar",
  atencao: "Atenção",
  falha: "Com falha",
  "fora-do-ar": "Fora do ar",
}

export function SaudeDoAgente({ saude, compacto }: { saude: Saude; compacto?: boolean }) {
  const selo = (
    <StatusBadge tone={TOM_DA_SAUDE[saude.nivel]}>
      {ROTULO_DA_SAUDE[saude.nivel]}
      {compacto && <span className="sr-only">: {saude.motivo}</span>}
    </StatusBadge>
  )
  if (compacto) return <span title={saude.motivo}>{selo}</span>

  return (
    <div className="grid justify-items-start gap-1.5">
      {selo}
      <p className="text-xs leading-relaxed text-ink-3">{saude.motivo}</p>
    </div>
  )
}
