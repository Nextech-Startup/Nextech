import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { TelaDeAcessoDeSuporte } from "@/components/admin/tela-de-suporte"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { acessoVigente } from "@/lib/admin/acesso-de-suporte"
import { AGORA } from "../../../_fixtures/agora"
import { ACESSO_DE_EXEMPLO, CONVERSAS_DE_SUPORTE, RESUMOS_DE_SUPORTE } from "../../../_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Acesso de suporte",
  robots: { index: false, follow: false },
}

const LISTA = "/admin/design-system/telas/suporte"

/**
 * `?acesso=liberado` mostra a tela depois da justificativa, que no
 * protótipo não pode ser enviada. O link que alterna fica aqui, não no
 * componente: é do protótipo, não da tela.
 */
export default async function AcessoDeSuportePrototipo({
  params,
  searchParams,
}: {
  params: Promise<{ clinica: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ clinica: id }, { acesso: pedido }] = await Promise.all([params, searchParams])
  const clinica = RESUMOS_DE_SUPORTE.find((c) => c.id === id)
  if (!clinica) notFound()

  const temExemplo = clinica.id === ACESSO_DE_EXEMPLO.clinicaId
  const liberado = temExemplo && pedido === "liberado"
  const rota = `${LISTA}/${clinica.id}`

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <AvisoDePrototipo entrega="motor de conversa (fase 3b) e a trilha de acesso de suporte" />
        {temExemplo && (
          <Link href={liberado ? rota : `${rota}?acesso=liberado`} className="w-fit text-sm text-info-fg underline underline-offset-4">
            {liberado ? "Ver sem acesso" : "Ver com o acesso liberado"}
          </Link>
        )}
      </div>
      <TelaDeAcessoDeSuporte
        clinica={clinica}
        acesso={liberado ? acessoVigente([ACESSO_DE_EXEMPLO], clinica.id, AGORA) : null}
        conversas={temExemplo ? CONVERSAS_DE_SUPORTE : []}
        hrefDaLista={LISTA}
        agora={AGORA}
        acaoDesabilitada="Protótipo: a ação ainda não existe"
      />
    </div>
  )
}
