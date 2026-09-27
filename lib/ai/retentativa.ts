/** Esperas entre as tentativas (conversation-engine-v1, comportamento 7): três tentativas no total. */
export const ESPERAS_DA_IA_MS = [1000, 4000] as const

/**
 * Tenta de novo depois de cada espera, só para o erro que repetir resolve.
 * O `dormir` é injetado: o teste não espera 5 s de verdade.
 */
export async function comRetentativas<T>(
  tentar: () => Promise<T>,
  p: { esperas: readonly number[]; repetivel: (erro: unknown) => boolean; dormir: (ms: number) => Promise<void> },
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await tentar()
    } catch (erro) {
      if (tentativa >= p.esperas.length || !p.repetivel(erro)) throw erro
      await p.dormir(p.esperas[tentativa])
    }
  }
}

/** O `dormir` de verdade, para quem não está em teste. */
export function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
