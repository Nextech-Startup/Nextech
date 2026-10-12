"use client"

import { FalhaNaTela } from "@/components/patterns/falha-na-tela"

/** A página da vitrine é de servidor e não pode passar função; esta ponte passa. */
export function FalhaDeExemplo() {
  return <FalhaNaTela retry={() => {}} digest="3021847563" voltarPara="/admin/design-system" />
}
