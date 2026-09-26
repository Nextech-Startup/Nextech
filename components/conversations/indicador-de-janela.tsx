import { Clock } from "lucide-react"
import type { Janela } from "@/lib/conversations/janela"
import { chaveDoDia, formatarDataCurta, formatarDuracao, formatarHora } from "@/lib/formatters/data"
import { cn } from "@/lib/utils"
import { tomDaJanela } from "./estado"

const TEXTO = { success: "text-success-fg", warning: "text-warning-fg", neutral: "text-ink-3" } as const
const LINHA = { success: "bg-success-fg", warning: "bg-warning-fg", neutral: "bg-transparent" } as const

function tom(j: Janela) {
  return tomDaJanela(j) as keyof typeof TEXTO
}

/** O que a janela deixa fazer agora, em uma linha. */
export function descreverJanela(j: Janela, agora: string): string {
  if (j.aberta) return `fecha em ${formatarDuracao(j.restanteMs)}`
  if (!j.fechouEm) return "o paciente ainda não escreveu"
  const quando =
    chaveDoDia(j.fechouEm) === chaveDoDia(agora)
      ? `às ${formatarHora(j.fechouEm)}`
      : `em ${formatarDataCurta(j.fechouEm)} às ${formatarHora(j.fechouEm)}`
  return `fechou ${quando}`
}

/** Texto da janela de 24h, para o cabeçalho da conversa. */
export function IndicadorDeJanela({ janela, agora }: { janela: Janela; agora: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <Clock aria-hidden="true" className={cn("size-3.5", TEXTO[tom(janela)])} />
      <span className="text-ink-3">Janela de 24h</span>
      <span className={cn("font-medium", TEXTO[tom(janela)])}>{descreverJanela(janela, agora)}</span>
    </p>
  )
}

/**
 * A borda de baixo do cabeçalho é a própria janela: uma linha que esvazia
 * da direita para a esquerda até a Meta fechar o texto livre. Fechada, a
 * linha some e sobra só a borda comum.
 */
export function LinhaDaJanela({ janela, agora }: { janela: Janela; agora: string }) {
  const fracao = janela.aberta ? janela.fracaoRestante : 0
  return (
    <div
      role="meter"
      aria-label="Janela de 24h da Meta"
      aria-valuemin={0}
      aria-valuemax={24}
      aria-valuenow={janela.aberta ? Math.round((janela.restanteMs / 3_600_000) * 10) / 10 : 0}
      aria-valuetext={descreverJanela(janela, agora)}
      className="absolute inset-x-0 -bottom-px h-0.5"
    >
      <div
        className={cn("h-full rounded-r-pill transition-[width] duration-700", LINHA[tom(janela)])}
        style={{ width: `${fracao * 100}%` }}
      />
    </div>
  )
}
