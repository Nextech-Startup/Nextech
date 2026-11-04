/**
 * Vocabulário de docs/specs/whatsapp-templates-v1.md na forma da tela. Os
 * tipos moram em `lib/whatsapp/templates/tipos.ts`, de onde a leitura
 * (`carregarTemplates`) e a fixture da demonstração os montam.
 */
export type {
  CategoriaDoTemplate,
  StatusDoTemplate,
  TemplateDaTela as TemplateDoWhatsApp,
  UsoDoTemplate,
  VariavelDoCatalogo,
} from "@/lib/whatsapp/templates/tipos"

import type { EstadoDeFormulario } from "@/components/patterns/formulario"

type Acao = (anterior: EstadoDeFormulario, fd: FormData) => Promise<EstadoDeFormulario>

/** As server actions da tela real. Ausentes na demonstração e no protótipo. */
export type AcoesDosTemplates = {
  salvarOuEnviar: Acao
  conferir: Acao
  duplicar: Acao
  excluir: Acao
}
