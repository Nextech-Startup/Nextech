"use client"

import { useMemo, useReducer, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { PageHeader } from "@/components/patterns/page-header"
import { filtrarEncerradas, filtrarPorResponsavel, hrefDoCrm, type FiltroDeEncerradas, type FiltroDeResponsavel, type Vista } from "@/lib/crm/filtros"
import { ehIdDoBanco } from "@/lib/crm/ids"
import { faixaDoFunil, PERIODOS, resumoDoPeriodo, type PeriodoEmDias } from "@/lib/crm/metricas"
import type { PedidoDeMovimento } from "@/lib/crm/movimento"
import type { Etapa, EtapaAberta, Oportunidade, Referencia } from "@/lib/crm/tipos"
import { BuscaDoCrm, type ResultadoDaBuscaDoCrm } from "./busca-do-crm"
import { estadoInicial, etapaComResultado, reduzirCrm } from "./estado"
import { FaixaDoFunil } from "./faixa-do-funil"
import { ListaDeEncerradas } from "./lista-de-encerradas"
import { PainelDaOportunidade } from "./painel-da-oportunidade"
import { PedidoDeFechamento } from "./pedido-de-fechamento"
import { Quadro } from "./quadro"
import { ResumoDoPeriodo } from "./resumo-do-periodo"

export type Gravacao = {
  mover: (pedido: PedidoDeMovimento) => Promise<{ erro: string | null }>
  salvar: (form: FormData) => Promise<{ erro: string | null }>
  equipe: Referencia[]
}

export type PropsDaTelaDoCrm = {
  oportunidades: Oportunidade[]
  agora: string
  eu: Referencia
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  encerradas: FiltroDeEncerradas
  procedimentos: Referencia[]
  /** Na demonstração, os procedimentos das oportunidades de exemplo. */
  procedimentosDeExemplo?: Referencia[]
  caminho: string
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
  /** As ações do servidor. Sem elas, nada grava (o protótipo da parte 1). */
  gravar?: Gravacao
  /** A pílula do tempo real (AoVivo), montada pela página. */
  aoVivo?: ReactNode
}

/**
 * A tela do CRM (spec crm-v1, "A tela"). Responde primeiro quantos estão em
 * cada etapa, quanto isso vale e o que está parado. Os números saem do
 * estado do navegador: mover um cartão atualiza a faixa na hora. Com
 * `gravar`, a oportunidade real grava pelas server actions e a tela relê o
 * servidor; a de exemplo (id que não é uuid) move só no navegador.
 */
export function TelaDoCrm(p: PropsDaTelaDoCrm) {
  const router = useRouter()
  const [estado, despachar] = useReducer(reduzirCrm, p.oportunidades, estadoInicial)
  // O router.refresh() traz props novas: o servidor é a fonte, e o quadro
  // volta a ela (inclusive desfazendo o movimento que ele recusou). Ajuste
  // durante a renderização, como a doc do React recomenda para estado
  // derivado de props, sem um efeito que pintaria o quadro velho antes.
  if (estado.origem !== p.oportunidades) despachar({ tipo: "sincronizar", oportunidades: p.oportunidades })
  const [aberta, setAberta] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{ op: Oportunidade; para: "ganho" | "perdido" } | null>(null)
  const [etapaNoCelular, setEtapaNoCelular] = useState<EtapaAberta>("novo")
  const [busca, setBusca] = useState<ResultadoDaBuscaDoCrm | null>(null)

  const doResponsavel = useMemo(
    () => filtrarPorResponsavel(estado.oportunidades, p.responsavel, p.eu.id),
    [estado.oportunidades, p.responsavel, p.eu.id],
  )
  const visiveis = busca && !busca.erro ? doResponsavel.filter((o) => busca.ids.includes(o.id)) : doResponsavel
  const faixa = faixaDoFunil(doResponsavel, p.agora, p.periodo)
  const resumo = resumoDoPeriodo(doResponsavel, p.agora, p.periodo)
  const base = { periodo: p.periodo, responsavel: p.responsavel, vista: p.vista, resultado: p.encerradas.resultado, motivo: p.encerradas.motivo }
  const opAberta = estado.oportunidades.find((o) => o.id === aberta) ?? null

  function aoResultadoDaBusca(r: ResultadoDaBuscaDoCrm | null) {
    setBusca(r)
    // No celular, não deixar a busca cair numa coluna vazia quando outra tem o achado.
    if (r && !r.erro) setEtapaNoCelular((atual) => etapaComResultado(atual, doResponsavel, r.ids))
  }

  /** As de exemplo fecham com os procedimentos de exemplo; as reais, com os do perfil. */
  const procedimentosDe = (op: Oportunidade) =>
    !ehIdDoBanco(op.id) && p.procedimentosDeExemplo ? p.procedimentosDeExemplo : p.procedimentos

  async function mover(pedido: PedidoDeMovimento) {
    despachar({ tipo: "mover", pedido, em: p.agora, autor: p.eu })
    if (!p.gravar || !ehIdDoBanco(pedido.oportunidadeId)) return
    const r = await p.gravar.mover(pedido).catch(() => ({ erro: "Não foi possível mover. Tente de novo." }))
    if (r.erro) despachar({ tipo: "avisar", aviso: r.erro })
    router.refresh()
  }

  function aoMover(op: Oportunidade, para: Etapa) {
    if (para === "ganho" || para === "perdido") return setFechando({ op, para })
    void mover({ oportunidadeId: op.id, de: op.etapa, para })
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="CRM" description="O funil comercial da clínica: de quem escreveu até quem fechou." />
        {p.aoVivo}
      </div>

      <ResumoDoPeriodo
        resumo={resumo}
        periodo={p.periodo}
        hrefDoPeriodo={Object.fromEntries(PERIODOS.map((d) => [d, hrefDoCrm(p.caminho, { ...base, periodo: d })])) as Record<PeriodoEmDias, string>}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
        <BuscaDoCrm buscar={p.buscar} aoResultado={aoResultadoDaBusca} />
        <FiltroSegmentado
          rotulo="Responsável"
          atual={p.responsavel}
          segmentos={(["todos", "meus", "sem"] as const).map((r) => ({
            valor: r,
            rotulo: r === "todos" ? "Todos" : r === "meus" ? "Meus" : "Sem responsável",
            href: hrefDoCrm(p.caminho, { ...base, responsavel: r }),
          }))}
        />
        <FiltroSegmentado
          rotulo="Vista"
          atual={p.vista}
          segmentos={[
            { valor: "quadro", rotulo: "Quadro", href: hrefDoCrm(p.caminho, { ...base, vista: "quadro" }) },
            { valor: "encerradas", rotulo: "Encerradas", href: hrefDoCrm(p.caminho, { ...base, vista: "encerradas" }) },
          ]}
        />
      </div>

      {busca?.erro && (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {busca.erro}
        </p>
      )}

      {estado.aviso && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          {estado.aviso}
          <button type="button" onClick={() => despachar({ tipo: "fechar-aviso" })} className="font-medium underline">
            Fechar
          </button>
        </p>
      )}

      {p.vista === "quadro" ? (
        <>
          <FaixaDoFunil
            faixa={faixa}
            etapaNoCelular={etapaNoCelular}
            aoEscolher={setEtapaNoCelular}
            hrefDasEncerradas={{
              ganho: hrefDoCrm(p.caminho, { ...base, vista: "encerradas", resultado: "ganho", motivo: null }),
              perdido: hrefDoCrm(p.caminho, { ...base, vista: "encerradas", resultado: "perdido", motivo: null }),
            }}
          />
          <Quadro ops={visiveis.filter((o) => o.encerradaEm === null)} agora={p.agora} etapaNoCelular={etapaNoCelular} aoAbrir={setAberta} aoMover={aoMover} />
        </>
      ) : (
        <ListaDeEncerradas
          ops={filtrarEncerradas(visiveis, p.encerradas, p.agora, p.periodo)}
          filtro={p.encerradas}
          hrefDe={(f) => hrefDoCrm(p.caminho, { ...base, vista: "encerradas", ...f })}
          aoAbrir={setAberta}
        />
      )}

      {opAberta && (
        <PainelDaOportunidade
          op={opAberta}
          aoFechar={() => setAberta(null)}
          aoMover={aoMover}
          edicao={
            p.gravar && ehIdDoBanco(opAberta.id)
              ? { procedimentos: p.procedimentos, equipe: p.gravar.equipe, salvar: p.gravar.salvar, aoSalvar: () => router.refresh() }
              : undefined
          }
        />
      )}

      {fechando && (
        <PedidoDeFechamento
          op={fechando.op}
          para={fechando.para}
          procedimentos={procedimentosDe(fechando.op)}
          aoCancelar={() => setFechando(null)}
          aoConfirmar={(pedido) => {
            void mover(pedido)
            setFechando(null)
          }}
        />
      )}
    </div>
  )
}
