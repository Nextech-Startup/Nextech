import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { AdminContextError, requireAdminIdentity, situacaoDoMfa } from "@/lib/admin/context"
import { resumirFatores } from "@/lib/admin/mfa"
import { logout } from "@/lib/auth/actions"
import { CadastroForm } from "./cadastro-form"
import { DesafioForm } from "./desafio-form"

export const metadata: Metadata = {
  title: "Segundo fator",
  robots: { index: false, follow: false },
}

/**
 * Segundo fator do painel interno (spec admin-mfa-v1). Fica fora do layout
 * do `/admin`, que exige `aal2`: dentro dele, o redirect entraria em laço.
 *
 * Uma rota, três situações: sem fator, cadastro; fator com sessão em
 * `aal1`, desafio; já em `aal2`, volta ao painel — ou, com `?novo=1`,
 * cadastra o dispositivo de reserva.
 */
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  let identidade
  try {
    identidade = await requireAdminIdentity()
  } catch (erro) {
    // Quem não é da equipe não tem segundo fator a fazer aqui.
    if (erro instanceof AdminContextError) redirect("/dashboard")
    throw erro
  }

  const situacao = situacaoDoMfa(identidade.aal, identidade.fatores)
  const { novo } = await searchParams
  if (situacao === "ok" && novo !== "1") redirect("/admin")

  const textos =
    situacao === "desafio_pendente"
      ? { titulo: "Confirme o código", subtitulo: "Digite o código do aplicativo autenticador para abrir o painel interno." }
      : situacao === "ok"
        ? { titulo: "Dispositivo de reserva", subtitulo: "Cadastre um segundo autenticador, para o caso de perder o primeiro." }
        : {
            titulo: "Proteja o painel interno",
            subtitulo: "O painel interno exige um segundo fator. Cadastre um aplicativo autenticador para continuar.",
          }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-surface-0 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image src="/Logo.png" alt="Nextech" width={56} height={56} priority className="size-14 object-contain" />
          <div className="grid gap-1">
            <h1 className="font-display text-3xl tracking-tight text-ink-1">{textos.titulo}</h1>
            <p className="text-sm text-ink-2">{textos.subtitulo}</p>
          </div>
        </div>

        <div className="glass-effect rounded-card p-6 shadow-2xl sm:p-8">
          {situacao === "desafio_pendente" ? (
            <DesafioForm fatores={resumirFatores(identidade.fatores)} />
          ) : (
            <CadastroForm reserva={situacao === "ok"} />
          )}
        </div>

        <form action={logout} className="mt-6 text-center">
          <button
            type="submit"
            className="text-sm text-ink-3 underline decoration-ink-3/50 underline-offset-4 transition-colors hover:text-ink-1"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  )
}
