import type { StatusTone } from "@/components/patterns/status-badge"
import type { NivelDeConsumo } from "@/lib/admin/consumo"
import type { NivelOperacional } from "@/lib/admin/saude"

export const TOM_DO_CONSUMO: Record<NivelDeConsumo, StatusTone> = {
  estourou: "danger",
  "vai-estourar": "warning",
  perto: "warning",
  folga: "neutral",
}

export const ROTULO_DO_CONSUMO: Record<NivelDeConsumo, string> = {
  estourou: "Estourou",
  "vai-estourar": "Vai estourar",
  perto: "Perto do limite",
  folga: "Com folga",
}

export const TOM_OPERACIONAL: Record<NivelOperacional, StatusTone> = {
  ok: "success",
  atencao: "warning",
  falha: "danger",
}

export const ROTULO_OPERACIONAL: Record<NivelOperacional, string> = {
  ok: "Normal",
  atencao: "Atenção",
  falha: "Com falha",
}

/** Falha antes de atenção antes de normal: o que para tudo sobe. */
export const GRAVIDADE_OPERACIONAL: Record<NivelOperacional, number> = { falha: 0, atencao: 1, ok: 2 }
