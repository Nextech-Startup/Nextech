import type { StatusTone } from "@/components/patterns/status-badge"
import type { NivelDeConsumo } from "@/lib/admin/consumo"

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
