import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ShieldCheck } from "lucide-react"
import { z } from "zod"
import { Conversa } from "@/components/conversations/conversa"
import { ROTULO_DO_MOTIVO } from "@/lib/admin/acesso-de-suporte"
import { requireAdminContext } from "@/lib/admin/context"
import { abrirConversaParaSuporte } from "@/lib/admin/suporte"
import { formatarHora } from "@/lib/formatters/data"

export const metadata: Metadata = {
  title: "Conversa de suporte",
  robots: { index: false, follow: false },
}

const ID = z.string().uuid()

/**
 * Uma conversa aberta pelo suporte, só leitura. Sem acesso vigente, volta
 * para a clínica, que pede a justificativa. A abertura vai para a trilha
 * antes de o conteúdo aparecer; cada carregamento desta página é um
 * registro, porque cada um mostra dado de paciente.
 */
export default async function ConversaDeSuportePage({
  params,
}: {
  params: Promise<{ clinica: string; conversa: string }>
}) {
  const { clinica, conversa: conversaId } = await params
  if (!ID.safeParse(clinica).success || !ID.safeParse(conversaId).success) notFound()

  const ctx = await requireAdminContext()
  const agora = new Date().toISOString()
  const rotaDaClinica = `/admin/conversations/${clinica}`
  const abertura = await abrirConversaParaSuporte(ctx, clinica, conversaId, agora)
  if (abertura.estado === "sem-acesso") redirect(rotaDaClinica)
  if (abertura.estado === "nao-encontrada") notFound()
  const { acesso, conversa } = abertura

  return (
    <div className="grid gap-4">
      <Link href={rotaDaClinica} className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Conversas da clínica
      </Link>
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-card border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg"
      >
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">Acesso de suporte até {formatarHora(acesso.expiraEm)}.</span>{" "}
          {ROTULO_DO_MOTIVO[acesso.justificativa.motivo]}, chamado #{acesso.justificativa.chamado}. Esta abertura ficou
          registrada na auditoria.
        </span>
      </p>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/40 md:h-[calc(100dvh-16rem)] md:min-h-[34rem]">
        <Conversa conversa={conversa} agora={agora} voltarHref={rotaDaClinica} modo={{ tipo: "suporte" }} />
      </div>
    </div>
  )
}
