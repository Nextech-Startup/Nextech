import { FileText } from "lucide-react"
import { Cartao } from "@/components/patterns/cartao"
import { Botao } from "@/components/patterns/formulario"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { MedidorDeUso } from "@/components/patterns/medidor-de-uso"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LIMITE_DE_AGENTES, ROTULO_DO_PLANO } from "@/lib/agent-config/schema"
import { projetarConsumo } from "@/lib/billing/consumo"
import { LIMITE_DE_ATENDIMENTOS } from "@/lib/billing/plan-limits"
import { formatarData, formatarDataCurta } from "@/lib/formatters/data"
import { formatarMoeda, formatarNumero } from "@/lib/formatters/numero"
import {
  ROTULO_DA_FATURA,
  ROTULO_DO_PAGAMENTO,
  TOM_DA_FATURA,
  type ResumoDaCobranca,
} from "./tipos"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "2026-09" → "set 2026" */
export function mesDeReferencia(referencia: string): string {
  const [ano, mes] = referencia.split("-").map(Number)
  return `${MESES[mes - 1]} ${ano}`
}

/**
 * Os dois limites do plano no centro, com a regra de cada um escrita;
 * depois o plano, a próxima cobrança e as faturas. Mudança de plano e
 * cancelamento passam pela equipe Nextech (onboarding consultivo).
 */
export function TelaDeCobranca({
  resumo,
  agora,
  acaoDesabilitada,
}: {
  resumo: ResumoDaCobranca
  agora: string
  acaoDesabilitada?: string
}) {
  const limiteDeAtendimentos = LIMITE_DE_ATENDIMENTOS[resumo.plano]
  const limiteDeAgentes = LIMITE_DE_AGENTES[resumo.plano]
  const nomeDoPlano = ROTULO_DO_PLANO[resumo.plano]
  const projecao = projetarConsumo({
    usados: resumo.atendimentosUsados,
    inicio: resumo.ciclo.inicio,
    fim: resumo.ciclo.fim,
    agora,
  })
  // O ciclo termina à meia-noite do dia 1º: o último dia de uso é o anterior.
  const ultimoDia = new Date(new Date(resumo.ciclo.fim).getTime() - 1).toISOString()

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Plano e cobrança"
        status={<StatusBadge tone="neutral">Plano {nomeDoPlano}</StatusBadge>}
        description="Quanto do plano você já usou neste ciclo, e o que vem na próxima cobrança."
      />

      <section aria-label="Uso do plano" className="grid gap-4 lg:grid-cols-2">
        <MedidorDeUso
          titulo={`Atendimentos de ${formatarDataCurta(resumo.ciclo.inicio)} a ${formatarDataCurta(ultimoDia)}`}
          usado={resumo.atendimentosUsados}
          limite={limiteDeAtendimentos}
          unidade={["atendimento", "atendimentos"]}
          explicacao="Um atendimento fecha quando a IA envia 5 respostas ou o paciente fica 20 minutos sem escrever. Resposta da equipe não conta."
          projecao={
            projecao !== null
              ? `No ritmo atual, o ciclo fecha com cerca de ${formatarNumero(projecao)}.`
              : undefined
          }
        >
          <p className="border-t border-hairline pt-3 text-xs leading-relaxed text-ink-3">
            Ao chegar no limite, a IA para de responder e a equipe é avisada. As conversas
            continuam com vocês.
          </p>
        </MedidorDeUso>

        <MedidorDeUso
          titulo="Agentes"
          usado={resumo.agentesCriados}
          limite={limiteDeAgentes}
          unidade={["agente", "agentes"]}
          explicacao="Cada agente atende uma especialidade, com o próprio número de WhatsApp. Rascunhos contam."
          ilimitado={`Ilimitado no plano ${nomeDoPlano}.`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo={`Plano ${nomeDoPlano}`}>
          <div className="grid gap-5">
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl text-ink-1">
                {formatarMoeda(resumo.valorMensalCentavos)}
              </span>
              <span className="text-sm text-ink-3">por mês</span>
            </p>
            <ListaDeDados
              colunas={2}
              itens={[
                { termo: "Atendimentos por mês", valor: formatarNumero(limiteDeAtendimentos) },
                {
                  termo: "Agentes",
                  valor: limiteDeAgentes === null ? "Ilimitados" : formatarNumero(limiteDeAgentes),
                },
              ]}
            />
            <div className="grid gap-2 border-t border-hairline pt-4">
              <p className="text-sm text-ink-2">
                Mudança de plano e cancelamento são feitos com a equipe Nextech.
              </p>
              <Botao
                variante="secundario"
                className="w-fit"
                disabled={Boolean(acaoDesabilitada)}
                title={acaoDesabilitada}
              >
                Falar com a equipe
              </Botao>
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Próxima cobrança">
          <ListaDeDados
            itens={[
              { termo: "Data", valor: formatarData(resumo.proximaCobranca.em) },
              { termo: "Valor", valor: formatarMoeda(resumo.proximaCobranca.valorCentavos) },
              {
                termo: "Forma de pagamento",
                valor: `${ROTULO_DO_PAGAMENTO[resumo.formaDePagamento.tipo]}, ${resumo.formaDePagamento.detalhe}`,
              },
            ]}
          />
        </Cartao>
      </div>

      <section aria-labelledby="faturas" className="grid gap-3">
        <h2 id="faturas" className="text-[0.9375rem] font-semibold text-ink-1">
          Faturas
        </h2>
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Referência</TableHead>
                <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.faturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="pl-5">{mesDeReferencia(f.referencia)}</TableCell>
                  <TableCell className="hidden text-ink-2 sm:table-cell">{formatarData(f.vencimento)}</TableCell>
                  <TableCell className="tabular-nums">{formatarMoeda(f.valorCentavos)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={TOM_DA_FATURA[f.status]}>{ROTULO_DA_FATURA[f.status]}</StatusBadge>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Botao
                      variante="secundario"
                      className="h-8 px-2.5 text-[0.8125rem] sm:px-3"
                      disabled={Boolean(acaoDesabilitada)}
                      title={acaoDesabilitada}
                    >
                      <FileText data-icon aria-hidden="true" className="sm:hidden" />
                      <span className="sr-only sm:not-sr-only">Ver fatura</span>
                    </Botao>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
