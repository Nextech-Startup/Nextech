import { createBrowserSupabase } from "@/lib/supabase/browser"

/**
 * A tela de Conversas em tempo real. Um trigger no banco manda um aviso
 * sem dado ao canal privado `conversas:<clinic_id>` a cada mudança de
 * conversa; o navegador só escuta e pede um refresh, e o servidor redesenha
 * a tela já decifrada. Só membro da clínica entra no canal (policy em
 * `realtime.messages`, migration 20261011140000).
 */

export type EstadoDoAoVivo = "conectando" | "ao-vivo" | "reconectando"

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
    .channel(`conversas:${clinicId}`, { config: { private: true } })
    .on("broadcast", { event: "conversa" }, () => aoMudar())
  let encerrada = false

  // O canal privado exige o token da sessão no Realtime antes da entrada.
  void supabase.realtime.setAuth().then(() => {
    if (!encerrada) canal.subscribe((status) => ouvintes.aoEstado(estadoDoAoVivo(status)))
  })

  return () => {
    encerrada = true
    aoMudar.cancelar()
    void supabase.removeChannel(canal)
  }
}
