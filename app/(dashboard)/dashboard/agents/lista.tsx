"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { ChevronRight, Plus } from "lucide-react"
import { criarAgenteAction } from "./actions"
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoAgente } from "@/components/agents/status-do-agente"
import {
  ESPECIALIDADES,
  LIMITE_DE_AGENTES,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_PLANO,
  estaConectado,
  podeCriarAgente,
  type Agent,
  type ClinicPlan,
} from "@/lib/agent-config/schema"

export function ListaDeAgentes({
  agentes,
  plano,
}: {
  agentes: readonly Agent[]
  plano: ClinicPlan
}) {
  const [criando, setCriando] = useState(false)
  const [state, action, pending] = useActionState(criarAgenteAction, estadoInicial)

  const limite = LIMITE_DE_AGENTES[plano]
  const cabeMais = podeCriarAgente(plano, agentes.length)

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Agentes"
        description="Um agente por especialidade ou unidade, cada um com o próprio número de WhatsApp."
        actions={
          <>
            <span className="text-sm text-ink-3">
              {agentes.length}
              {limite !== null ? ` de ${limite}` : ""} no plano {ROTULO_DO_PLANO[plano]}
            </span>
            {/* Com a lista vazia, a ação vive no estado vazio: dois botões
                primários iguais na mesma tela disputam atenção. */}
            {!criando && agentes.length > 0 && (
              <Botao
                type="button"
                onClick={() => setCriando(true)}
                disabled={!cabeMais}
                // Sem o title, um botão desabilitado não diz por quê.
                title={
                  cabeMais
                    ? undefined
                    : `O plano ${ROTULO_DO_PLANO[plano]} permite ${limite} agente(s).`
                }
              >
                <Plus data-icon aria-hidden="true" />
                Novo agente
              </Botao>
            )}
          </>
        }
      />

      {!cabeMais && (
        <p className="rounded-xl border border-hairline bg-surface-1/50 px-4 py-3 text-sm text-ink-2">
          O plano {ROTULO_DO_PLANO[plano]} permite {limite}{" "}
          {limite === 1 ? "agente" : "agentes"}. Para criar mais, fale com a equipe
          Nextech sobre um upgrade.
        </p>
      )}

      {criando && (
        <Cartao
          titulo="Novo agente"
          descricao="Nome e especialidade agora; persona, horário e WhatsApp na tela seguinte."
        >
          <form action={action} className="grid gap-5">
            <Aviso state={state} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome" hint="(como sua equipe o identifica)">
                <Input name="name" required autoFocus placeholder="Recepção Odontologia" />
              </Campo>

              <Campo label="Especialidade">
                <Select name="specialty" required defaultValue="">
                  <option value="" disabled>
                    Escolha uma
                  </option>
                  {ESPECIALIDADES.map((e) => (
                    <option key={e} value={e}>
                      {ROTULO_DA_ESPECIALIDADE[e]}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>

            <div className="flex gap-2">
              <Botao type="submit" disabled={pending}>
                {pending ? "Criando…" : "Criar agente"}
              </Botao>
              <Botao type="button" variante="secundario" onClick={() => setCriando(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      {agentes.length === 0 && !criando ? (
        <Vazio
          acao={
            cabeMais ? (
              <Botao type="button" onClick={() => setCriando(true)}>
                <Plus data-icon aria-hidden="true" />
                Criar o primeiro agente
              </Botao>
            ) : undefined
          }
        >
          Nenhum agente ainda. O agente é quem responde o paciente no WhatsApp,
          com a persona e as regras da clínica.
        </Vazio>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
          {agentes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate text-sm font-medium text-ink-1">{a.name}</p>
                  <p className="text-xs text-ink-3">{ROTULO_DA_ESPECIALIDADE[a.specialty]}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">
                    {estaConectado(a) ? "WhatsApp conectado" : "Sem WhatsApp"}
                  </span>
                  <StatusDoAgente status={a.status} />
                  <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
