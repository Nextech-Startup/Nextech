import { CATALOGO, RODAPE_DE_OPT_OUT } from "./catalogo"
import type { TemplateNoBanco } from "./tipos"

/**
 * Componentes do template no formato da Meta (referência de mai/2026):
 * corpo com os exemplos fixos do catálogo e, no MARKETING, o rodapé de
 * opt-out. Cabeçalho e botões ficam para a v2 (decisão 8).
 */
export function montarComponentes(t: Pick<TemplateNoBanco, "category" | "body" | "variables">): Record<string, unknown>[] {
  const corpo: Record<string, unknown> = { type: "BODY", text: t.body }
  if (t.variables.length > 0) {
    corpo.example = { body_text: [t.variables.map((v) => CATALOGO[v].exemplo)] }
  }
  const componentes = [corpo]
  if (t.category === "MARKETING") componentes.push({ type: "FOOTER", text: RODAPE_DE_OPT_OUT })
  return componentes
}

/** Payload do `POST /{waba_id}/message_templates`. */
export function montarSubmissao(t: Pick<TemplateNoBanco, "name" | "category" | "body" | "variables">): Record<string, unknown> {
  return { name: t.name, language: "pt_BR", category: t.category, components: montarComponentes(t) }
}
