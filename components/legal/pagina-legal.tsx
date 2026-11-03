import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { ThemeToggle } from "@/components/theme-toggle"
import { SITE_URL } from "@/lib/site-url"
import { ATUALIZADO_EM, EMPRESA } from "./empresa"

/**
 * Moldura das páginas legais: cabeçalho com o logo, o texto e o rodapé da
 * landing. A Navbar não entra porque os links dela rolam até seções que só
 * existem na home; o rodapé, fora da home, leva até elas pela URL da landing.
 */
export function PaginaLegal({
  titulo,
  resumo,
  children,
}: {
  titulo: string
  resumo: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-0 overflow-x-hidden">
      <header className="border-b border-hairline">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Absoluto: em app.nextech.ia.br, `/` vai para o dashboard. */}
          <Link href={`${SITE_URL}/`} aria-label="Nextech — voltar ao início" className="rounded-pill">
            <Image src="/Logo.png" alt="" width={160} height={40} className="h-12 w-auto" sizes="160px" priority />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* O "Pular para o conteúdo" do layout raiz aponta para #Hero. */}
      <main id="Hero" className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl md:text-4xl text-ink-1">{titulo}</h1>
        <p className="mt-4 text-ink-2 leading-relaxed">{resumo}</p>
        <p className="mt-2 text-sm text-ink-3">Última atualização: {ATUALIZADO_EM}</p>

        <div className="mt-12 space-y-12 text-ink-2 leading-relaxed break-words [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_p]:mt-4 [&_strong]:text-ink-1 [&_strong]:font-semibold [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}

/** Seção com âncora: o título é o link para ela mesma. */
export function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-8">
      <h2 id={`${id}-titulo`} className="group font-display text-xl md:text-2xl text-ink-1">
        <a href={`#${id}`} className="!text-ink-1 !no-underline">
          {titulo}
          <span aria-hidden="true" className="ml-2 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">
            #
          </span>
        </a>
      </h2>
      {children}
    </section>
  )
}

/** O e-mail do encarregado, como link. */
export function EmailDoEncarregado() {
  return <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>
}
