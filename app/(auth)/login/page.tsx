import { Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da sua clínica no Nextech.",
  // Tela de acesso não deve aparecer em busca.
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--surface-0)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/Logo.png"
            alt="Nextech"
            width={160}
            height={42}
            priority
            className="h-10 w-auto"
          />
          <p className="text-sm text-[var(--text-2)]">
            Acesse o painel da sua clínica
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-6 shadow-sm sm:p-8">
          {/* useSearchParams exige Suspense: sem ele a rota inteira vira dinâmica. */}
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-3)]">
          Ainda não é cliente?{" "}
          <Link
            href="https://www.nextech.ia.br"
            className="text-[var(--accent-on-light)] underline underline-offset-4 transition hover:text-[var(--accent-strong)] dark:text-[var(--accent-dim)]"
          >
            Conheça o Nextech
          </Link>
        </p>
      </div>
    </main>
  )
}
