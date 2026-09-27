import type { Metadata } from "next"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/patterns/page-header"
import {
  Carregando,
  EsqueletoDeCabecalho,
  EsqueletoDeFormulario,
  EsqueletoDeLista,
} from "@/components/patterns/esqueleto"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { FalhaDeExemplo } from "./falha-de-exemplo"

export const metadata: Metadata = {
  title: "Estados das rotas reais",
  robots: { index: false, follow: false },
}

/**
 * Os estados que as rotas reais usam, lado a lado, para revisão visual.
 * Na rota real só aparecem quando o dado demora, o servidor falha ou o
 * papel não abre a tela, o que é difícil de provocar de propósito. Não há
 * dado fictício aqui, só os componentes.
 */
export default function EstadosPage() {
  return (
    <div className="grid gap-12">
      <PageHeader
        title="Estados das rotas reais"
        description="Carregamento, falha e permissão negada, como aparecem no painel da clínica e no painel interno."
      />
      <Exemplo titulo="Carregando uma lista" origem="loading.tsx de /dashboard/agents">
        <Carregando rotulo="os agentes">
          <EsqueletoDeCabecalho acao />
          <EsqueletoDeLista linhas={3} />
        </Carregando>
      </Exemplo>
      <Exemplo titulo="Carregando um formulário" origem="loading.tsx de /dashboard/agents/[id]">
        <Carregando rotulo="o agente">
          <EsqueletoDeCabecalho acao />
          <EsqueletoDeFormulario campos={3} />
        </Carregando>
      </Exemplo>
      <Exemplo titulo="Falha ao carregar" origem="error.tsx dos dois painéis">
        <FalhaDeExemplo />
      </Exemplo>
      <Exemplo titulo="Permissão negada" origem="staff digitando /dashboard/agents">
        <PermissaoNegada titulo="Agentes" rota="/dashboard/agents" role="staff" />
      </Exemplo>
    </div>
  )
}

function Exemplo({
  titulo,
  origem,
  children,
}: {
  titulo: string
  origem: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-0.5 border-b border-hairline pb-3">
        <h2 className="text-[0.9375rem] font-semibold text-ink-1">{titulo}</h2>
        <p className="text-xs text-ink-3">{origem}</p>
      </div>
      {children}
    </section>
  )
}
