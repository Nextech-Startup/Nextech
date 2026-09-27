import Link from "next/link"
import { Lock } from "lucide-react"
import type { ClinicRole } from "@/lib/auth/context"
import { papeisDaRota, quemAcessa } from "@/lib/navigation/acesso"
import { primeiraRotaVisivel } from "@/lib/navigation/landing"
import { PageHeader } from "@/components/patterns/page-header"
import { Button } from "@/components/ui/button"

/**
 * Quem chega a uma tela que o papel não abre (digitando a URL, ou por um
 * link antigo). Diz quem abre, o que fazer e por onde voltar, em vez de
 * uma parede muda. A regra vem do menu (`papeisDaRota`), então a frase
 * nunca contradiz o que o sidebar mostra.
 */
export function PermissaoNegada({
  titulo,
  rota,
  role,
  demo = false,
}: {
  titulo: string
  rota: string
  role: ClinicRole
  /** Conta de demonstração: o caminho de volta conta as telas que abrem nela. */
  demo?: boolean
}) {
  const papeis = papeisDaRota(rota)
  const inicio = primeiraRotaVisivel(role, demo)

  return (
    <div className="grid gap-6">
      <PageHeader title={titulo} />
      <section
        aria-labelledby="sem-acesso-titulo"
        className="grid max-w-xl gap-4 rounded-card border border-hairline bg-surface-1/50 p-6 sm:p-8"
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-pill border border-hairline text-ink-2"
        >
          <Lock className="size-4" />
        </span>
        <div className="grid gap-1.5">
          <h2 id="sem-acesso-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
            Você não tem acesso a esta tela
          </h2>
          <p className="text-sm leading-relaxed text-ink-2">
            {papeis
              ? `Só ${quemAcessa(papeis)} abre esta tela. Se precisar de algo aqui, fale com quem administra a conta da clínica.`
              : "Esta tela não está disponível para a sua conta."}
          </p>
        </div>
        {inicio && inicio !== rota && (
          <Button asChild variant="outline" className="w-fit">
            <Link href={inicio}>Voltar para o início</Link>
          </Button>
        )}
      </section>
    </div>
  )
}
