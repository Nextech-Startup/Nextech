import { Check, Minus, UserCog, UserPlus } from "lucide-react"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { Cartao } from "@/components/patterns/cartao"
import { Botao } from "@/components/patterns/formulario"
import { LinhaDoTempo } from "@/components/patterns/linha-do-tempo"
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
import type { ClinicRole } from "@/lib/auth/context"
import { tempoRelativo } from "@/lib/formatters/data"
import { ROTULO_DO_PAPEL } from "@/lib/navigation/landing"
import { CAPACIDADES, RESUMO_DO_PAPEL, type Alcance } from "./capacidades"
import { situacaoDoConvite } from "./convites"
import type { AlteracaoDeAcesso, Convite, MembroDaEquipe } from "./tipos"

const PAPEIS: ClinicRole[] = ["owner", "staff", "professional"]

/**
 * Quem entra no painel da clínica e o que cada um pode fazer. Mudar acesso
 * pede confirmação e fica registrado na lista de alterações.
 */
export function TelaDeEquipe({
  membros,
  convites,
  alteracoes,
  agora,
  acaoDesabilitada,
}: {
  membros: readonly MembroDaEquipe[]
  convites: readonly Convite[]
  alteracoes: readonly AlteracaoDeAcesso[]
  agora: string
  acaoDesabilitada?: string
}) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Equipe e acessos"
        description="Quem entra no painel da clínica e o que cada pessoa pode fazer."
        actions={
          <Botao type="button" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
            <UserPlus data-icon aria-hidden="true" />
            Convidar pessoa
          </Botao>
        }
      />

      <section aria-labelledby="pessoas" className="grid gap-3">
        <h2 id="pessoas" className="text-[0.9375rem] font-semibold text-ink-1">
          Pessoas
        </h2>
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Pessoa</TableHead>
                <TableHead className="hidden sm:table-cell">Papel</TableHead>
                <TableHead className="hidden lg:table-cell">Vínculo</TableHead>
                <TableHead className="hidden md:table-cell">Último acesso</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <AvatarDeIniciais nome={m.nome} />
                      <div className="grid min-w-0 gap-0.5">
                        <p className="flex items-center gap-2 font-medium text-ink-1">
                          <span className="truncate">{m.nome}</span>
                          {m.voce && (
                            <span className="rounded-pill bg-surface-2 px-1.5 text-[0.6875rem] font-normal text-ink-2">
                              Você
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-3">{m.email}</p>
                        <p className="text-xs text-ink-2 sm:hidden">{ROTULO_DO_PAPEL[m.papel]}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-ink-2 sm:table-cell">{ROTULO_DO_PAPEL[m.papel]}</TableCell>
                  <TableCell className="hidden text-ink-2 lg:table-cell">
                    {m.profissional ?? <span className="text-ink-3">Não se aplica</span>}
                  </TableCell>
                  <TableCell className="hidden text-ink-2 md:table-cell">
                    {m.ultimoAcesso ? tempoRelativo(m.ultimoAcesso, agora) : <span className="text-ink-3">Ainda não entrou</span>}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {!m.voce && (
                      <Botao
                        variante="secundario"
                        className="h-8 px-2.5 text-[0.8125rem] sm:px-3"
                        disabled={Boolean(acaoDesabilitada)}
                        title={acaoDesabilitada}
                      >
                        <UserCog data-icon aria-hidden="true" className="sm:hidden" />
                        <span className="sr-only sm:not-sr-only">Mudar acesso</span>
                      </Botao>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Cartao titulo="Convites pendentes" descricao="O convite chega por e-mail e vale por 7 dias.">
          {convites.length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum convite esperando resposta.</p>
          ) : (
            <ul className="grid gap-3">
              {convites.map((c) => {
                const s = situacaoDoConvite(c, agora)
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline px-4 py-3">
                    <div className="grid min-w-0 gap-0.5">
                      <p className="truncate text-sm text-ink-1">{c.email}</p>
                      <p className="text-xs text-ink-3">
                        {ROTULO_DO_PAPEL[c.papel]}, {s.texto}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.expirado && <StatusBadge tone="warning">Expirado</StatusBadge>}
                      <Botao
                        variante="secundario"
                        className="h-8 px-3 text-[0.8125rem]"
                        disabled={Boolean(acaoDesabilitada)}
                        title={acaoDesabilitada}
                      >
                        {s.expirado ? "Reenviar" : "Cancelar"}
                      </Botao>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Alterações de acesso" descricao="Quem mudou o quê, para qualquer um conferir depois.">
          <LinhaDoTempo
            rotulo="Alterações de acesso"
            eventos={alteracoes.map((a) => ({
              id: a.id,
              instante: a.em,
              quando: tempoRelativo(a.em, agora),
              titulo: a.texto,
            }))}
          />
        </Cartao>
      </div>

      <section aria-labelledby="capacidades" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="capacidades" className="text-[0.9375rem] font-semibold text-ink-1">
            O que cada papel pode fazer
          </h2>
          <p className="text-sm text-ink-2">
            Proposta da matriz de acesso; a versão final sai da spec de equipe.
          </p>
        </div>
        <div className="overflow-hidden rounded-card border border-hairline">
          <Table className="[&_td]:whitespace-normal [&_th]:whitespace-normal">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-2/5 pl-4 sm:pl-5">Capacidade</TableHead>
                {PAPEIS.map((p) => (
                  <TableHead key={p} className="py-3 align-bottom">
                    <span className="block text-ink-1">{ROTULO_DO_PAPEL[p]}</span>
                    <span className="hidden text-xs font-normal text-ink-3 sm:block">
                      {RESUMO_DO_PAPEL[p]}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPACIDADES.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 text-ink-1 sm:pl-5">{c.rotulo}</TableCell>
                  {PAPEIS.map((p) => (
                    <TableCell key={p}>
                      <Celula alcance={c.alcance[p]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function Celula({ alcance }: { alcance: Alcance }) {
  if (alcance === "tudo") {
    return (
      <span className="inline-flex items-center text-success-fg">
        <Check aria-hidden="true" className="size-4" />
        <span className="sr-only">Pode</span>
      </span>
    )
  }
  if (alcance === "proprios") return <span className="text-xs text-ink-2">Só os próprios</span>
  return (
    <span className="inline-flex items-center text-ink-3">
      <Minus aria-hidden="true" className="size-4" />
      <span className="sr-only">Não pode</span>
    </span>
  )
}
