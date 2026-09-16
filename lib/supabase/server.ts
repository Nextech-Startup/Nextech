import { createServerClient as createSSRClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

/**
 * Client com a sessão do usuário, lida dos cookies da requisição.
 * A RLS se aplica normalmente: é o caminho para qualquer dado de clínica
 * em contexto de requisição autenticada.
 *
 * Não use direto num componente ou rota — use `requireClinicContext()`,
 * que devolve este client já com o tenant resolvido.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component não pode escrever cookie.
            // O middleware é quem renova a sessão.
          }
        },
      },
    },
  )
}

/**
 * Client service_role: IGNORA RLS por definição.
 *
 * Só para contexto sem sessão — webhook da Meta, jobs de cron e rotinas
 * do (admin). Quem usa assume a responsabilidade de filtrar por clinic_id
 * manualmente, porque o banco não vai fazer isso aqui.
 *
 * Acesse por `lib/auth/service-context.ts`, para que o uso fique visível
 * na importação e em review.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
