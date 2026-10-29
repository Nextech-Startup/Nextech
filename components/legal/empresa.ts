/**
 * Identidade de quem publica as páginas legais (docs/specs/legal-pages-v1.md,
 * decisão 0). Um lugar só: a política, os termos e a exclusão citam os mesmos
 * dados, e trocar o e-mail do encarregado é mudar uma linha.
 */
export const EMPRESA = {
  nomeEmpresarial: "65.406.075 JHONES BONIFACIO DA SILVA",
  cnpj: "65.406.075/0001-12",
  nomeComercial: "Nextech",
  sede: "Recife/PE",
  encarregado: "Jhones Bonifacio da Silva",
  email: "contato@nextech.ia.br",
} as const

/** Data da publicação do texto. Muda junto com qualquer alteração dele. */
export const ATUALIZADO_EM = "26/10/2026"

/** Prazo de resposta a pedido de titular (LGPD, art. 19, II). */
export const PRAZO_DE_RESPOSTA = "15 dias"
