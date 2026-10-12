import { createBrowserSupabase } from "@/lib/supabase/browser"

/**
 * A tela de Conversas em tempo real. Um trigger no banco manda um aviso
 * sem dado ao canal privado `conversas:<clinic_id>` a cada mudança de
 * conversa; o navegador só escuta e pede um refresh, e o servidor redesenha
 * a tela já decifrada. Só membro da clínica entra no canal (policy em
 * `realtime.messages`, migration 20261011140000).
 */

export type EstadoDoAoVivo = "conectando" | "ao-vivo" | "reconectando"

/** O evento que o trigger do banco manda (`private.broadcast_conversation_change`). */
export const EVENTO_DO_AVISO = "conversa"

/** O canal privado da clínica; quem entra é decidido pela policy do banco. */
export function topicoDaClinica(clinicId: string): string {
  return `conversas:${clinicId}`
}

/** Espera para juntar mudanças seguidas (três mensagens, a resposta da IA) num refresh só. */
export const ESPERA_DO_REFRESH_MS = 400

/** O status do canal do Realtime; o cliente tenta reconectar sozinho. */
export function estadoDoAoVivo(status: string): Exclude<EstadoDoAoVivo, "conectando"> {
  return status === "SUBSCRIBED" ? "ao-vivo" : "reconectando"
}

export function agruparChamadas(fn: () => void, ms: number): (() => void) & { cancelar(): void } {
  let pendente: ReturnType<typeof setTimeout> | null = null
  const chamar = () => {
    if (pendente) clearTimeout(pendente)
    pendente = setTimeout(() => {
      pendente = null
      fn()
    }, ms)
  }
  return Object.assign(chamar, {
    cancelar() {
      if (pendente) clearTimeout(pendente)
      pendente = null
    },
  })
}

/**
 * Entra no canal privado da clínica. O tópico leva o `clinic_id` da
 * sessão, mas quem decide a entrada é a policy do banco: pedir o tópico de
 * outra clínica dá erro de canal, e nada chega. Devolve a função que sai do
 * canal e descarta o refresh pendente.
 */
export function assinarConversas(
  clinicId: string,
  ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void },
): () => void {
  const supabase = createBrowserSupabase()
  const aoMudar = agruparChamadas(ouvintes.aoMudar, ESPERA_DO_REFRESH_MS)
  const canal = supabase
    .channel(topicoDaClinica(clinicId), { config: { private: true } })
    .on("broadcast", { event: EVENTO_DO_AVISO }, () => aoMudar())
  let encerrada = false

  // O canal privado exige o token da sessão no Realtime antes da entrada.
  void supabase.realtime.setAuth().then(() => {
    if (encerrada) return
    canal.subscribe((status) => {
      const estado = estadoDoAoVivo(status)
      ouvintes.aoEstado(estado)
      // Ao entrar, e ao voltar depois de cair: o aviso de uma mudança feita
      // enquanto o canal estava fora não chega mais, então a tela relê.
      if (estado === "ao-vivo") aoMudar()
    })
  })

  return () => {
    encerrada = true
    aoMudar.cancelar()
    void supabase.removeChannel(canal)
  }
}
