import { createBrowserClient } from "@supabase/ssr"

/**
 * Client do navegador, com a sessão dos cookies e a chave anônima. Existe
 * só para o Realtime da tela de Conversas (`lib/conversations/ao-vivo.ts`):
 * dado de clínica se lê no servidor, por `requireClinicContext()`. A trava
 * de `tests/architecture/boundaries.test.ts` recusa qualquer outro import.
 */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
