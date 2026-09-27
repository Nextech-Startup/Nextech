import Link from "next/link"
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react"
import { Botao, Campo, Input, Select } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import {
  DURACAO_DO_ACESSO_MS,
  MOTIVOS_DE_SUPORTE,
  ROTULO_DO_MOTIVO,
  type AcessoDeSuporte,
} from "@/lib/admin/acesso-de-suporte"
import { formatarDuracao, formatarHora, tempoRelativo } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import { ORDEM_DA_CONVERSA, ROTULO_DA_CONVERSA, TOM_DA_CONVERSA } from "./estado"
import type { ConversaDeSuporte, ResumoDeSuporte } from "./tipos"

const ms = (iso: string) => new Date(iso).getTime()

/** "12 abertas, 2 aguardando, 1 com falha": o que se sabe de uma clínica sem justificar. */
function Contagens({ c }: { c: ResumoDeSuporte }) {
  return (
    // `span`, não `p`: também entra na descrição do `PageHeader`, que já é um parágrafo.
    <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-3 tabular-nums">
      <span>{plural(c.abertas, "aberta", "abertas")}</span>
      <span>{formatarNumero(c.aguardando)} aguardando</span>
      <span className={c.comFalha > 0 ? "text-danger-fg" : undefined}>{formatarNumero(c.comFalha)} com falha</span>
    </span>
  )
}

/**
 * A porta de entrada do suporte: as clínicas e seus números, nunca uma
 * conversa. Ver conversas de uma clínica exige justificar antes
 * (desenho de navegação, seção 3).
 */
export function ClinicasParaSuporte({
  clinicas,
  hrefDaClinica,
}: {
  clinicas: readonly ResumoDeSuporte[]
  hrefDaClinica: (id: string) => string
}) {
  const ordenadas = [...clinicas].sort((a, b) => b.comFalha - a.comFalha || b.aguardando - a.aguardando)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Conversas de suporte"
        description="Para abrir conversas de pacientes, escolha a clínica e informe o motivo. Cada acesso fica na auditoria."
      />
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
        {ordenadas.map((c) => (
          <li key={c.id}>
            <Link
              href={hrefDaClinica(c.id)}
              className="flex items-center justify-between gap-3 px-5 py-4 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
            >
              <div className="grid gap-1">
                <span className="font-medium text-ink-1">{c.nome}</span>
                <Contagens c={c} />
              </div>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Uma clínica no suporte. Sem acesso vigente, só o formulário: a lista
 * nem é renderizada, para os nomes não chegarem ao navegador. Com acesso,
 * a lista, e cada conversa aberta vira mais um registro na auditoria.
 */
export function TelaDeAcessoDeSuporte({
  clinica,
  acesso,
  conversas,
  hrefDaLista,
  agora,
  acaoDesabilitada,
}: {
  clinica: ResumoDeSuporte
  acesso: (AcessoDeSuporte & { expiraEm: string }) | null
  conversas: readonly ConversaDeSuporte[]
  hrefDaLista: string
  agora: string
  acaoDesabilitada?: string
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href={hrefDaLista} className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Conversas de suporte
        </Link>
        <PageHeader title={clinica.nome} description={<Contagens c={clinica} />} />
      </div>

      {acesso === null ? (
        <Justificativa acaoDesabilitada={acaoDesabilitada} />
      ) : (
        <>
          <FaixaDoAcesso acesso={acesso} acaoDesabilitada={acaoDesabilitada} />
          <ListaDeConversas conversas={conversas} agora={agora} acaoDesabilitada={acaoDesabilitada} />
        </>
      )}
    </div>
  )
}

function Justificativa({ acaoDesabilitada }: { acaoDesabilitada?: string }) {
  return (
    <section
      aria-labelledby="justificativa-titulo"
      className="grid max-w-xl gap-5 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6"
    >
      <div className="grid gap-1">
        <h2 id="justificativa-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Por que você precisa ver as conversas?
        </h2>
        <p className="text-sm text-ink-2">
          As conversas têm dado de saúde. Sem motivo e sem chamado, o acesso não é liberado.
        </p>
      </div>
      <form className="grid gap-4">
        <Campo label="Motivo">
          <Select name="motivo" required defaultValue="">
            <option value="" disabled>
              Escolha o motivo
            </option>
            {MOTIVOS_DE_SUPORTE.map((m) => (
              <option key={m} value={m}>
                {ROTULO_DO_MOTIVO[m]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Número do chamado">
          <Input name="chamado" required inputMode="numeric" autoComplete="off" placeholder="4821" className="h-10 max-w-40" />
        </Campo>
        <Botao type="submit" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada} className="w-fit">
          <ShieldCheck aria-hidden="true" />
          Liberar acesso por {formatarDuracao(DURACAO_DO_ACESSO_MS)}
        </Botao>
      </form>
      <p className="text-xs leading-relaxed text-ink-3">
        O acesso vale {formatarDuracao(DURACAO_DO_ACESSO_MS)}. Ver a lista e cada conversa aberta ficam registrados na
        auditoria com este motivo e este chamado.
      </p>
    </section>
  )
}

function FaixaDoAcesso({
  acesso,
  acaoDesabilitada,
}: {
  acesso: AcessoDeSuporte & { expiraEm: string }
  acaoDesabilitada?: string
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg"
    >
      <p className="flex items-start gap-2.5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">Acesso liberado até {formatarHora(acesso.expiraEm)}.</span>{" "}
          {ROTULO_DO_MOTIVO[acesso.justificativa.motivo]}, chamado #{acesso.justificativa.chamado}.
        </span>
      </p>
      <Botao type="button" variante="secundario" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
        Encerrar acesso
      </Botao>
    </div>
  )
}

function ListaDeConversas({
  conversas,
  agora,
  acaoDesabilitada,
}: {
  conversas: readonly ConversaDeSuporte[]
  agora: string
  acaoDesabilitada?: string
}) {
  const ordenadas = [...conversas].sort(
    (a, b) => ORDEM_DA_CONVERSA[a.estado] - ORDEM_DA_CONVERSA[b.estado] || ms(b.ultimaAtividade) - ms(a.ultimaAtividade),
  )
  const tituloDoAbrir = [acaoDesabilitada, "Abrir a conversa cria um registro na auditoria."].filter(Boolean).join(". ")

  return (
    <section aria-labelledby="conversas-titulo" className="grid gap-3">
      <h2 id="conversas-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
        {plural(ordenadas.length, "conversa aberta", "conversas abertas")}
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
        {ordenadas.map((c) => (
          <li
            key={c.id}
            className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_11rem_7rem_auto] sm:items-center sm:gap-4"
          >
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-ink-1">{c.paciente}</span>
              <span className="text-xs text-ink-3">{c.agente}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:contents">
              <StatusBadge tone={TOM_DA_CONVERSA[c.estado]}>{ROTULO_DA_CONVERSA[c.estado]}</StatusBadge>
              <span className="text-xs text-ink-3 tabular-nums">{tempoRelativo(c.ultimaAtividade, agora)}</span>
              <Botao
                type="button"
                variante="secundario"
                disabled={Boolean(acaoDesabilitada)}
                title={tituloDoAbrir}
                className="ml-auto w-fit sm:ml-0"
              >
                Abrir conversa
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
