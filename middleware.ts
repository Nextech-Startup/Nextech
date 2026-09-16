import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Renova a sessão do Supabase a cada requisição autenticada e barra quem
 * não tem sessão.
 *
 * Este é o único lugar fora de lib/supabase/server.ts que instancia um
 * client — middleware roda no edge, antes do React, e não tem acesso ao
 * `cookies()` do Next. O teste de fronteiras conhece essa exceção.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser revalida o token no servidor de Auth.
  // getSession leria o cookie sem verificar, o que não serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Só as rotas autenticadas. A landing permanece pública e sem o custo
  // de uma chamada de Auth por requisição.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
