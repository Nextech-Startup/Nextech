/**
 * Endereço público da landing. Base das URLs absolutas de metadata (OG,
 * canonical) e destino dos links que, fora da home, voltam para ela: no
 * domínio do painel, um `/` relativo cairia no redirect para o dashboard.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.nextech.ia.br"
