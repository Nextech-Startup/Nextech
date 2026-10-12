import Link from "next/link"
import { BellOff, ChevronRight, Plus } from "lucide-react"
import { Busca } from "@/components/patterns/busca"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { Botao } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tempoRelativo } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import type { SegmentoDePacientes } from "./segmentos"
import type { PacienteNaTabela } from "./tipos"

const ROTULO_DO_SEGMENTO: Record<SegmentoDePacientes, string> = {
  todos: "Todos",
  "sem-consentimento": "Sem consentimento",
  "opt-out": "Não recebem mensagens",
  inativos: "Sem contato há 6 meses",
}

/**
 * Todo paciente que já falou com a clínica. A linha inteira abre a ficha;
 * o link de verdade é o nome, e um pseudo-elemento estende a área de clique.
 */
export function TabelaDePacientes({
  pacientes,
  contagens,
  filtro,
  agora,
  caminho,
  acaoDesabilitada,
}: {
  pacientes: readonly PacienteNaTabela[]
  contagens: Record<SegmentoDePacientes, number>
  filtro: { segmento: SegmentoDePacientes; busca: string }
  agora: string
  caminho: string
  /** Protótipo: diz por que "Cadastrar paciente" ainda não funciona. */
  acaoDesabilitada?: string
}) {
  const q = filtro.busca || undefined
  const segmento = filtro.segmento === "todos" ? undefined : filtro.segmento

  function href(params: Record<string, string | undefined>) {
    const busca = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) busca.set(k, v)
    const texto = busca.toString()
    return texto ? `${caminho}?${texto}` : caminho
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pacientes"
        description="Todo paciente que já falou com a clínica pelo WhatsApp."
        actions={
          <Botao type="button" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
            <Plus data-icon aria-hidden="true" />
            Cadastrar paciente
          </Botao>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:items-center">
        <Busca rotulo="Buscar por nome ou telefone" valor={filtro.busca} preservar={{ segmento }} />
        <FiltroSegmentado
          rotulo="Recortes de pacientes"
          atual={filtro.segmento}
          segmentos={(Object.keys(ROTULO_DO_SEGMENTO) as SegmentoDePacientes[]).map((s) => ({
            valor: s,
            rotulo: ROTULO_DO_SEGMENTO[s],
            contagem: contagens[s],
            href: href({ segmento: s === "todos" ? undefined : s, q }),
          }))}
        />
      </div>

      {pacientes.length === 0 ? (
        <Vazio>Nenhum paciente neste recorte.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Paciente</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Convênio</TableHead>
                <TableHead>Último contato</TableHead>
                <TableHead className="hidden sm:table-cell">Consentimento</TableHead>
                <TableHead className="hidden sm:table-cell">Mensagens</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Abrir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientes.map((p) => (
                <TableRow key={p.id} className="relative">
                  <TableCell className="py-3 pl-5">
                    <Link
                      href={`${caminho}/${p.id}`}
                      className="font-medium text-ink-1 outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {p.name ?? <span className="font-normal text-ink-3">Sem nome ainda</span>}
                    </Link>
                    <p className="text-xs tabular-nums text-ink-3 md:hidden">
                      {formatarTelefone(p.whatsapp_phone_number)}
                    </p>
                    {/* No celular as colunas de consentimento e mensagens
                        somem; o que pede atenção desce para cá. */}
                    {(!p.consent_given_at || p.opted_out) && (
                      <p className="mt-0.5 text-xs text-warning-fg sm:hidden">
                        {[!p.consent_given_at && "Consentimento pendente", p.opted_out && "Não recebe mensagens"]
                          .filter(Boolean)
                          .join(" e ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums text-ink-2 md:table-cell">
                    {formatarTelefone(p.whatsapp_phone_number)}
                  </TableCell>
                  <TableCell className="hidden text-ink-2 lg:table-cell">
                    {p.convenio ?? <span className="text-ink-3">Particular</span>}
                  </TableCell>
                  <TableCell className="text-ink-2">
                    <time dateTime={p.last_contact_at}>{tempoRelativo(p.last_contact_at, agora)}</time>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.consent_given_at ? (
                      <StatusBadge tone="success">Dado</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Pendente</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-ink-2 sm:table-cell">
                    {p.opted_out ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-3">
                        <BellOff aria-hidden="true" className="size-3.5" />
                        Não recebe
                      </span>
                    ) : (
                      "Recebe"
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
