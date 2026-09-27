import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import {
  agruparRepeticoes,
  clinicaDoRegistro,
  descreverRegistro,
  filtrarTrilha,
  type ItemDaTrilha,
  type RegistroDaTrilha,
  type TipoDeRegistro,
} from "@/lib/admin/auditoria"
import { chaveDoDia, descreverDia, formatarHora, somarDias } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"

const ROTULO_DO_TIPO: Record<TipoDeRegistro, string> = {
  todos: "Todos",
  suporte: "Acessos de suporte",
  clinicas: "Clínicas",
}

/** O id do alvo encurtado: basta para cruzar com o chamado, sem virar um identificador de paciente. */
const idCurto = (id: string) => id.slice(0, 8)

function rotuloDoDia(chave: string, hoje: string): string {
  if (chave === hoje) return "Hoje"
  if (chave === somarDias(hoje, -1)) return "Ontem"
  const texto = descreverDia(chave)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * A trilha do que a equipe Nextech fez no painel. Lê como lista, não
 * como linha do tempo: com dezenas de registros por dia, pontos e linha
 * vertical virariam ruído. Consultas seguidas da mesma pessoa viram uma
 * linha só. O acesso a conversa de paciente tem marca própria, com texto,
 * e a justificativa sempre à vista.
 *
 * O recorte por tipo (`hrefDoTipo`) só existe quando há acessos de
 * suporte (fase 3b); sem ele, a tela mostra tudo. As páginas vêm de fora:
 * `hrefAnteriores` continua a trilha, `hrefMaisRecentes` volta ao começo.
 */
export function TelaDeAuditoria({
  registros,
  tipo = "todos",
  hrefDoTipo,
  hrefAnteriores,
  hrefMaisRecentes,
  agora,
}: {
  registros: readonly RegistroDaTrilha[]
  tipo?: TipoDeRegistro
  hrefDoTipo?: Record<TipoDeRegistro, string>
  hrefAnteriores?: string | null
  hrefMaisRecentes?: string
  agora: string
}) {
  const hoje = chaveDoDia(agora)
  const dias = new Map<string, ItemDaTrilha[]>()
  for (const item of agruparRepeticoes(filtrarTrilha(registros, { tipo }))) {
    const chave = chaveDoDia(item.registro.instante)
    dias.set(chave, [...(dias.get(chave) ?? []), item])
  }
  const comRecorte = hrefDoTipo !== undefined && tipo !== "todos"

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Auditoria"
        description="Tudo o que a equipe Nextech fez no painel. Os registros não podem ser apagados."
        actions={
          hrefDoTipo && (
            <FiltroSegmentado
              rotulo="Recorte da trilha"
              atual={tipo}
              segmentos={(["todos", "suporte", "clinicas"] as const).map((t) => ({
                valor: t,
                rotulo: ROTULO_DO_TIPO[t],
                href: hrefDoTipo[t],
              }))}
            />
          )
        }
      />

      {hrefMaisRecentes && (
        <Link href={hrefMaisRecentes} className="w-fit text-sm text-ink-2 underline underline-offset-4 hover:text-ink-1">
          Ver os mais recentes
        </Link>
      )}

      {dias.size === 0 ? (
        <p className="rounded-card border border-dashed border-hairline px-6 py-10 text-center text-sm text-ink-2">
          {comRecorte ? "Nenhum registro neste recorte." : "Nenhum registro ainda."}
        </p>
      ) : (
        [...dias].map(([chave, doDia]) => (
          <section key={chave} aria-labelledby={`dia-${chave}`} className="grid gap-3">
            <h2 id={`dia-${chave}`} className="text-[0.9375rem] font-semibold text-ink-1">
              {rotuloDoDia(chave, hoje)}
            </h2>
            <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
              {doDia.map((item) => (
                <Registro key={item.registro.id} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}

      {hrefAnteriores && (
        <Link
          href={hrefAnteriores}
          className="w-fit justify-self-center rounded-pill border border-hairline px-4 py-2 text-sm text-ink-1 transition-colors hover:bg-accent"
        >
          Ver registros anteriores
        </Link>
      )}
    </div>
  )
}

function Registro({ item: { registro: r, vezes, desde } }: { item: ItemDaTrilha }) {
  const d = descreverRegistro(r)
  const clinica = clinicaDoRegistro(r)
  const acao =
    vezes > 1 ? `${d.acao}, ${formatarNumero(vezes)} vezes entre ${formatarHora(desde)} e ${formatarHora(r.instante)}` : d.acao

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[3.5rem_minmax(0,9rem)_minmax(0,1fr)_minmax(0,13rem)] sm:items-start">
      <time dateTime={r.instante} className="text-sm text-ink-3 tabular-nums">
        {formatarHora(r.instante)}
      </time>
      <span className="text-sm text-ink-2">{r.autor}</span>
      <div className="col-start-2 grid gap-1 sm:col-start-auto">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-1">
          {d.suporte && <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-info-fg" />}
          {acao}
          {r.alvo && <span className="text-ink-3 tabular-nums">Conversa {idCurto(r.alvo)}</span>}
        </p>
        {d.suporte && <StatusBadge tone="info" className="w-fit">Acesso a dado de paciente</StatusBadge>}
        {d.detalhe && <p className="text-xs text-ink-3">{d.detalhe}</p>}
      </div>
      {/* Sem clínica (listar clínicas), a célula fica vazia: repetir "sem clínica" seria ruído. */}
      <span className="col-start-2 text-xs text-ink-3 empty:hidden sm:col-start-auto sm:block sm:text-right sm:text-sm">
        {clinica}
      </span>
    </li>
  )
}
