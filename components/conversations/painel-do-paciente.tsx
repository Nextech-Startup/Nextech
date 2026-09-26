import Link from "next/link"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { formatarData, formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import type { PacienteDaConversa } from "./tipos"

/**
 * O contexto do paciente ao lado da conversa: o bastante para responder
 * sem trocar de tela. O resto (histórico inteiro) fica na ficha.
 */
export function PainelDoPaciente({
  paciente,
  fichaHref,
}: {
  paciente: PacienteDaConversa
  fichaHref: string
}) {
  return (
    <div className="grid content-start gap-6 p-5">
      <div className="grid justify-items-start gap-3">
        <AvatarDeIniciais nome={paciente.nome ?? paciente.telefone} tamanho="lg" />
        <div className="grid gap-0.5">
          <p className={paciente.nome ? "font-medium text-ink-1" : "text-ink-3"}>
            {paciente.nome ?? "Sem nome ainda"}
          </p>
          <p className="text-sm tabular-nums text-ink-2">{formatarTelefone(paciente.telefone)}</p>
        </div>
      </div>

      <ListaDeDados
        itens={[
          { termo: "Convênio", valor: paciente.convenio ?? "Particular ou não informado" },
          {
            termo: "Consentimento",
            valor: paciente.consentimentoEm ? (
              <StatusBadge tone="success">Dado em {formatarData(paciente.consentimentoEm)}</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Pendente</StatusBadge>
            ),
          },
          {
            termo: "Mensagens automáticas",
            valor: paciente.optOut ? "Pediu para não receber" : "Recebe",
          },
          { termo: "Sequência ativa", valor: paciente.sequenciaAtiva ?? "Nenhuma" },
          {
            termo: "Próxima consulta",
            valor: paciente.proximaConsulta
              ? `${formatarDataCurta(paciente.proximaConsulta)} às ${formatarHora(paciente.proximaConsulta)}`
              : "Nenhuma marcada",
          },
          { termo: "Paciente desde", valor: formatarData(paciente.desde) },
        ]}
      />

      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={fichaHref}>Abrir ficha do paciente</Link>
      </Button>
    </div>
  )
}
