import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Background } from "@/components/background"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da sua clínica no Nextech.",
  // Tela de acesso não deve aparecer em busca.
  robots: { index: false, follow: false },
}

/**
 * A única tela do painel com a aurora de verdade: é a porta de entrada, vista
 * uma vez por sessão — o custo do WebGL aqui não se repete o dia inteiro.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-0 px-4 py-12">
      <Background />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image
            src="/Logo.png"
            alt="Nextech"
            width={56}
            height={56}
            priority
            className="size-14 object-contain"
          />
          <div className="grid gap-1">
            <h1 className="font-display text-3xl tracking-tight text-ink-1">Entrar no Nextech</h1>
            <p className="text-sm text-ink-2">Acesse o painel da sua clínica</p>
          </div>
        </div>

        <div className="glass-effect rounded-card p-6 shadow-2xl sm:p-8">
          {/* useSearchParams exige Suspense: sem ele a rota inteira vira dinâmica. */}
          <Suspense fallback={<div className="h-56" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-ink-3">
          Ainda não é cliente?{" "}
          <Link
            href="https://www.nextech.ia.br"
            className="text-ink-1 underline decoration-ink-3/50 underline-offset-4 transition-colors hover:decoration-ink-1"
          >
            Conheça o Nextech
          </Link>
        </p>
      </div>
    </main>
  )
}
