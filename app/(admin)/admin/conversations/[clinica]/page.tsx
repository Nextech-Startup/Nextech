import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"
import { TelaDeAcessoDeSuporte } from "@/components/admin/tela-de-suporte"
import { requireAdminContext } from "@/lib/admin/context"
import {
  acessoDeSuporteVigente,
  listarConversasParaSuporte,
  resumoParaSuporte,
  type ResultadoDaLiberacao,
} from "@/lib/admin/suporte"
import { liberarAcesso } from "../acoes"

export const metadata: Metadata = {
  title: "Acesso de suporte",
  robots: { index: false, follow: false },
}

type CodigoDeErro = Extract<ResultadoDaLiberacao, { ok: false }>["erro"]

/** O erro chega pela URL como código; a frase é sempre esta, nunca o que veio na URL. */
const ERROS: Record<CodigoDeErro, string> = {
  justificativa: "Escolha o motivo da lista e informe o número do chamado, só com dígitos.",
  clinica: "Clínica não encontrada.",
  trilha: "Não foi possível registrar o acesso. Nada foi liberado.",
}

/**
 * Uma clínica no suporte. Sem acesso vigente, só o formulário: as
 * conversas nem são lidas. Com acesso, a lista; cada conversa aberta vira
 * mais um registro na auditoria.
 */
export default async function AcessoDeSuportePage({
  params,
  searchParams,
}: {
  params: Promise<{ clinica: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ clinica: id }, { erro }] = await Promise.all([params, searchParams])
  if (!z.string().uuid().safeParse(id).success) notFound()

  const ctx = await requireAdminContext()
  const agora = new Date().toISOString()
  const [clinica, acesso] = await Promise.all([resumoParaSuporte(ctx, id), acessoDeSuporteVigente(ctx, id, agora)])
  if (!clinica) notFound()

  const conversas = acesso ? await listarConversasParaSuporte(ctx, id) : []
  const codigo = typeof erro === "string" && Object.hasOwn(ERROS, erro) ? (erro as CodigoDeErro) : null

  return (
    <TelaDeAcessoDeSuporte
      clinica={clinica}
      acesso={acesso}
      conversas={conversas}
      hrefDaLista="/admin/conversations"
      agora={agora}
      real={{
        liberar: liberarAcesso.bind(null, id),
        hrefDaConversa: (conversa) => `/admin/conversations/${id}/${conversa}`,
        erro: codigo ? ERROS[codigo] : null,
      }}
    />
  )
}
