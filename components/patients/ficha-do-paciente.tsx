import Link from "next/link"
import {
  BellOff,
  CalendarCheck,
  ChevronLeft,
  MessagesSquare,
  Repeat2,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { Cartao } from "@/components/patterns/cartao"
import { Botao } from "@/components/patterns/formulario"
import { LinhaDoTempo } from "@/components/patterns/linha-do-tempo"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { formatarData, tempoRelativo } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import type { FichaDoPaciente as Ficha, TipoDeContato } from "./tipos"

export const CONTATO: Record<TipoDeContato, { titulo: string; icone: LucideIcon; tom: StatusTone }> = {
  primeiro_contato: { titulo: "Primeiro contato", icone: UserPlus, tom: "neutral" },
  consentimento: { titulo: "Consentimento registrado", icone: ShieldCheck, tom: "success" },
  conversa: { titulo: "Conversa", icone: MessagesSquare, tom: "neutral" },
  sequencia_entrou: { titulo: "Entrou numa sequência", icone: Repeat2, tom: "info" },
  sequencia_parou: { titulo: "Saiu da sequência", icone: Repeat2, tom: "neutral" },
  consulta: { titulo: "Consulta", icone: CalendarCheck, tom: "success" },
  opt_out: { titulo: "Pediu para não receber mensagens", icone: BellOff, tom: "warning" },
}

/**
 * A ficha: quem é, o que autorizou e por onde passou. O histórico é só
 * metadado — canal, agente, sequência, motivo de parada —; o conteúdo das
 * mensagens fica na conversa, e não se espalha por outra tela.
 */
export function FichaDoPaciente({
  paciente,
  agora,
  caminhoDaLista,
  caminhoDaConversa,
  acaoDesabilitada,
}: {
  paciente: Ficha
  agora: string
  caminhoDaLista: string
  caminhoDaConversa: string
  acaoDesabilitada?: string
}) {
  const nome = paciente.name ?? "Sem nome ainda"
  const historico = [...paciente.historico].sort(
    (a, b) => new Date(b.em).getTime() - new Date(a.em).getTime(),
  )

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Link
          href={caminhoDaLista}
          className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Pacientes
        </Link>
        <PageHeader
          title={nome}
          description={`${formatarTelefone(paciente.whatsapp_phone_number)}. Paciente desde ${formatarData(paciente.created_at)}.`}
          actions={
            paciente.conversaId ? (
              <Button asChild>
                <Link href={`${caminhoDaConversa}?c=${paciente.conversaId}`}>
                  <MessagesSquare data-icon aria-hidden="true" />
                  Abrir conversa
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Cartao
          className="self-start"
          titulo="Histórico de contato"
          descricao="Por onde o paciente passou. O conteúdo das mensagens fica só na conversa."
        >
          <LinhaDoTempo
            rotulo="Histórico de contato"
            eventos={historico.map((c) => {
              const t = CONTATO[c.tipo]
              const Icone = t.icone
              return {
                id: c.id,
                instante: c.em,
                quando: tempoRelativo(c.em, agora),
                titulo: t.titulo,
                detalhe: c.detalhe,
                tom: t.tom,
                icone: <Icone />,
              }
            })}
          />
        </Cartao>

        <div className="grid content-start gap-4">
          <Cartao titulo="Consentimento">
            <div className="grid gap-2">
              {paciente.consent_given_at ? (
                <StatusBadge tone="success">Dado em {formatarData(paciente.consent_given_at)}</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Pendente</StatusBadge>
              )}
              <p className="text-sm text-ink-2">
                {paciente.consent_given_at
                  ? "Com consentimento, a transcrição de áudio pode ser guardada junto da conversa."
                  : "Sem consentimento, áudio é transcrito só para responder e descartado em seguida."}
              </p>
            </div>
          </Cartao>

          <Cartao titulo="Mensagens automáticas">
            {paciente.opted_out ? (
              <p className="text-sm text-ink-2">
                Pediu para não receber. Nunca volta a ser inscrito sozinho em lembrete,
                recall ou reativação.
              </p>
            ) : (
              <p className="text-sm text-ink-2">
                Recebe lembretes e sequências. Se responder &quot;PARAR&quot;, sai de todas na hora.
              </p>
            )}
          </Cartao>

          <Cartao titulo="Convênio">
            <p className="text-sm text-ink-1">{paciente.convenio ?? "Particular ou não informado"}</p>
          </Cartao>

          <div className="grid gap-2 rounded-card border border-dashed border-hairline p-5">
            <Botao variante="perigo" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada} className="w-fit">
              Excluir dados do paciente
            </Botao>
            <p className="text-xs leading-relaxed text-ink-3">
              Direito do paciente pela LGPD: remove ou anonimiza o cadastro e encerra as
              sequências em andamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
