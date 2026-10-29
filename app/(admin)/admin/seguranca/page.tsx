import type { Metadata } from "next"
import Link from "next/link"
import { Cartao } from "@/components/patterns/cartao"
import { Aviso } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { listarFatores, MENSAGENS, type ErroDoMfa } from "@/lib/admin/mfa"
import { formatarData } from "@/lib/formatters/data"
import { RemoverFator } from "./remover-fator"

export const metadata: Metadata = {
  title: "Segurança",
  robots: { index: false, follow: false },
}

// `hasOwn`, não `in`: `?erro=__proto__` acharia a chave no protótipo.
const ehErro = (valor: unknown): valor is ErroDoMfa => typeof valor === "string" && Object.hasOwn(MENSAGENS, valor)

/**
 * Os dispositivos do segundo fator de quem está logado (spec admin-mfa-v1):
 * cadastrar a reserva e remover um deles. O último não sai: a volta seria
 * o reset manual pelo Supabase Dashboard.
 */
export default async function SegurancaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; removido?: string }>
}) {
  const [fatores, { erro, removido }] = await Promise.all([listarFatores(), searchParams])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Segurança"
        description="O painel interno exige o código de um aplicativo autenticador a cada sessão."
      />

      <Aviso
        state={{
          error: ehErro(erro) ? MENSAGENS[erro] : null,
          success: removido === "1" ? "Dispositivo removido." : null,
        }}
      />

      <Cartao
        titulo="Autenticadores"
        descricao="Tenha dois: se perder o celular, o outro abre o painel."
        acao={
          <Link
            href="/mfa?novo=1"
            className="text-sm text-ink-1 underline decoration-ink-3/50 underline-offset-4 hover:decoration-ink-1"
          >
            Cadastrar outro
          </Link>
        }
      >
        <ul className="divide-y divide-hairline">
          {fatores.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium text-ink-1">{f.nome}</span>
                <span className="text-xs text-ink-3">Cadastrado em {formatarData(f.criadoEm)}</span>
              </div>
              {fatores.length > 1 && <RemoverFator id={f.id} nome={f.nome} />}
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  )
}
