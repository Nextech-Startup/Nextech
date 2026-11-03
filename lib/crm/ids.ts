const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Na demonstração, a tela junta oportunidades reais e de exemplo. O id diz
 * de onde vem: uuid é do banco (grava pelas ações); o resto é fixture (só
 * no navegador), como em Conversas.
 */
export function ehIdDoBanco(id: string): boolean {
  return UUID.test(id)
}
