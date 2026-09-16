import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Hostnames que servem o painel. A landing e o painel vivem no mesmo
 * projeto Vercel: é o domínio que decide o que a raiz mostra.
 *
 * `app.nextech.ia.br`     -> produção do painel
 * `staging.nextech.ia.br` -> staging do painel
 * qualquer outro          -> landing (www.nextech.ia.br, previews, localhost)
 */
const HOSTS_DO_PAINEL = ["app.", "staging."]

function ehHostDoPainel(hostname: string): boolean {
  return HOSTS_DO_PAINEL.some((prefixo) => hostname.startsWith(prefixo))
}

/** Rotas do painel, que exigem sessão. */
function ehRotaPrivada(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lê o header Host, não `nextUrl.hostname`: este último reflete a URL da
  // conexão, então em runtime local devolve 127.0.0.1 e a detecção falha.
  // Atrás de proxy, x-forwarded-host é quem carrega o domínio real.
  const hostname = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  )
    .split(":")[0]
    .toLowerCase()

  // Num domínio de painel, a raiz não é a landing: manda para o dashboard,
  // que por sua vez exige sessão logo abaixo.
  if (ehHostDoPainel(hostname) && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Fora das rotas privadas não há o que proteger.
  if (!ehRotaPrivada(pathname)) {
    return NextResponse.next({ request })
  }

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
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  /*
   * Roda em tudo, menos assets e arquivos estáticos — o redirect de raiz
   * por hostname precisa ver "/", que o matcher antigo não alcançava.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)"],
}
