import { nomeDoPaciente } from "@/lib/crm/cartao"
import { etapasDeDestino } from "@/lib/crm/movimento"
import { ROTULO_DA_ETAPA, ehEtapa, type Etapa, type Oportunidade } from "@/lib/crm/tipos"

/**
 * "Mover para…", o caminho que não depende de arrastar (celular, leitor de
 * tela). Um select nativo: escolher dispara e volta ao rótulo. Ganho e
 * Perdido passam pelo pedido de fechamento, que é de quem recebe `aoMover`.
 */
export function MoverPara({ op, aoMover }: { op: Oportunidade; aoMover: (op: Oportunidade, para: Etapa) => void }) {
  const destinos = etapasDeDestino(op)
  if (destinos.length === 0) return null
  return (
    <select
      aria-label={`Mover ${nomeDoPaciente(op)} para…`}
      value=""
      onChange={(e) => {
        if (ehEtapa(e.target.value)) aoMover(op, e.target.value)
      }}
      className="h-8 rounded-control border border-hairline bg-surface-0 px-2 text-xs text-ink-2"
    >
      <option value="" disabled>
        Mover para…
      </option>
      {destinos.map((d) => (
        <option key={d} value={d}>
          {ROTULO_DA_ETAPA[d]}
        </option>
      ))}
    </select>
  )
}
