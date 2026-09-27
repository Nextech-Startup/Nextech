import type { Metadata } from "next"
import { TelaDeAuditoria } from "@/components/admin/tela-de-auditoria"
import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import type { TipoDeRegistro } from "@/lib/admin/auditoria"
import { AGORA } from "../../_fixtures/agora"
import { TRILHA } from "../../_fixtures/painel-interno"

export const metadata: Metadata = {
  title: "Protótipo: Auditoria",
  robots: { index: false, follow: false },
}

const ROTA = "/admin/design-system/telas/auditoria"

export default async function AuditoriaPrototipo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tipo: pedido } = await searchParams
  const tipo: TipoDeRegistro = pedido === "suporte" || pedido === "clinicas" ? pedido : "todos"

  return (
    <div className="grid gap-6">
      <AvisoDePrototipo entrega="acesso de suporte (fase 3b); a trilha de clínicas já existe" />
      <TelaDeAuditoria
        registros={TRILHA}
        tipo={tipo}
        hrefDoTipo={{ todos: ROTA, suporte: `${ROTA}?tipo=suporte`, clinicas: `${ROTA}?tipo=clinicas` }}
        agora={AGORA}
      />
    </div>
  )
}
