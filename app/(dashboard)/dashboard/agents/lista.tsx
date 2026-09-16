"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { criarAgenteAction } from "./actions"
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Input,
  Select,
  SeloDeStatus,
  Vazio,
  estadoInicial,
} from "./ui"
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
  const [state, action, pending] = useActionState(
    criarAgenteAction,
    estadoInicial,
  )

  const limite = LIMITE_DE_AGENTES[plano]
  const cabeMais = podeCriarAgente(plano, agentes.length)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agentes</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Um agente por especialidade ou unidade, cada um com o próprio
            número de WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-3)]">
            {agentes.length}
            {limite !== null ? ` de ${limite}` : ""} · plano{" "}
            {ROTULO_DO_PLANO[plano]}
          </span>
          {!criando && (
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
              Novo agente
            </Botao>
          )}
        </div>
      </header>

      {!cabeMais && (
        <p className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-2)]">
          O plano {ROTULO_DO_PLANO[plano]} permite {limite}{" "}
          {limite === 1 ? "agente" : "agentes"}. Para criar mais, fale com a
          equipe Nextech sobre um upgrade.
        </p>
      )}

      {criando && (
        <Cartao
          titulo="Novo agente"
          descricao="Nome e especialidade agora; persona, horário e WhatsApp na tela seguinte."
        >
          <form action={action} className="space-y-4">
            <Aviso state={state} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome" hint="— como sua equipe o identifica">
                <Input
                  name="name"
                  required
                  autoFocus
                  placeholder="Recepção — Odontologia"
                />
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
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setCriando(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      {agentes.length === 0 && !criando ? (
        <Vazio>
          Nenhum agente ainda. Crie o primeiro para começar a atender pelo
          WhatsApp.
        </Vazio>
      ) : (
        <ul className="space-y-3">
          {agentes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="block rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-5 transition hover:border-[var(--accent)]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-2)]">
                      {ROTULO_DA_ESPECIALIDADE[a.specialty]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {estaConectado(a) ? (
                      <span className="text-xs text-[var(--text-3)]">
                        WhatsApp conectado
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-3)]">
                        sem WhatsApp
                      </span>
                    )}
                    <SeloDeStatus status={a.status} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
