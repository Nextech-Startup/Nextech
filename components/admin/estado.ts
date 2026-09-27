import type { StatusTone } from "@/components/patterns/status-badge"
import type { NivelDeConsumo } from "@/lib/admin/consumo"
import type { NivelOperacional } from "@/lib/admin/saude"
import type { EstadoDaConversaDeSuporte } from "./tipos"

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

export const TOM_DA_CONVERSA: Record<EstadoDaConversaDeSuporte, StatusTone> = {
  falha: "danger",
  aguardando: "warning",
  humano: "info",
  ia: "neutral",
}

export const ROTULO_DA_CONVERSA: Record<EstadoDaConversaDeSuporte, string> = {
  falha: "Falha da IA",
  aguardando: "Aguardando resposta",
  humano: "Com a equipe",
  ia: "Com a IA",
}

/** A conversa que falhou é a que o chamado costuma descrever: sobe primeiro. */
export const ORDEM_DA_CONVERSA: Record<EstadoDaConversaDeSuporte, number> = {
  falha: 0,
  aguardando: 1,
  humano: 2,
  ia: 3,
}
