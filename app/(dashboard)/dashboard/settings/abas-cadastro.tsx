"use client"

import { useActionState, useState } from "react"
import {
  criarConvenioAction,
  criarProcedimentoAction,
  criarProfissionalAction,
  desativarConvenioAction,
  desativarProcedimentoAction,
  desativarProfissionalAction,
  salvarConvenioAction,
  salvarIdentidadeAction,
  salvarPoliticaAction,
  salvarProcedimentoAction,
  salvarProfissionalAction,
} from "./actions"
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  EscolhaDeConvenios,
  Input,
  Select,
  Selo,
  Vazio,
  estadoInicial,
} from "./ui"
import {
  CONSELHOS,
  NO_SHOW_POLICIES,
  ROTULO_DO_CONSELHO,
  ROTULO_DO_NO_SHOW,
  type Insurance,
  type NoShowPolicy,
  type ProcedureComConvenios,
  type ProfessionalComConvenios,
  type SchedulingPolicy,
} from "@/lib/clinic-profile/schema"
import type { RegulatoryIdentity } from "@/lib/clinic-profile/queries"

/** Campos de conselho + registro, repetidos na identidade e na equipe. */
function CamposDeConselho({
  council,
  registration,
}: {
  council: string | null
  registration: string | null
}) {
  return (
    <>
      <Campo label="Conselho">
        <Select name="council" defaultValue={council ?? ""}>
          <option value="">Não informado</option>
          {CONSELHOS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_DO_CONSELHO[c]}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Número de registro">
        <Input
          name="registration_number"
          defaultValue={registration ?? ""}
          placeholder="12345-PE"
        />
      </Campo>
    </>
  )
}

// ---------------------------------------------------------------------------
// Aba 1 — Identidade regulatória
// ---------------------------------------------------------------------------

export function AbaIdentidade({
  clinic,
  pendencias,
}: {
  clinic: RegulatoryIdentity
  pendencias: readonly string[]
}) {
  const [state, action, pending] = useActionState(
    salvarIdentidadeAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      {pendencias.length > 0 && (
        <div className="rounded-2xl border border-[var(--warn)]/30 bg-[var(--warn)]/8 p-5">
          <p className="text-sm font-medium">
            Falta preencher para a clínica sair do rascunho
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-[var(--text-2)]">
            {pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[var(--text-3)]">
            Enquanto isso, o primeiro agente não pode ser publicado.
          </p>
        </div>
      )}

      <Cartao
        titulo="Identidade regulatória"
        descricao="Dados que identificam a clínica e quem responde tecnicamente por ela."
      >
        <form action={action} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Razão social">
              {/* Razão social e CNPJ são alterados pela equipe Nextech no
                  onboarding consultivo — aqui aparecem só para conferência. */}
              <Input value={clinic.legal_name} disabled readOnly />
            </Campo>

            <Campo label="CNPJ">
              <Input
                value={clinic.cnpj ?? "Não informado"}
                disabled
                readOnly
                className="tabular-nums"
              />
            </Campo>
          </div>

          <p className="text-sm text-[var(--text-3)]">
            Razão social e CNPJ são ajustados pela equipe Nextech. Fale com o
            suporte se algum estiver errado.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Responsável técnico">
              <Input
                name="technical_responsible_name"
                defaultValue={clinic.technical_responsible_name ?? ""}
                placeholder="Nome completo"
              />
            </Campo>

            <Campo label="Alvará sanitário" hint="(opcional)">
              <Input
                name="sanitary_license"
                defaultValue={clinic.sanitary_license ?? ""}
                placeholder="Número do alvará"
              />
            </Campo>

            <CamposDeConselho
              council={clinic.technical_responsible_council}
              registration={clinic.technical_responsible_registration_number}
            />
          </div>

          <p className="text-sm text-[var(--text-3)]">
            O conselho do responsável técnico é o dele, não da clínica. Cada
            profissional da equipe tem o próprio, na aba Equipe.
          </p>

          <Aviso state={state} />

          <Botao type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar identidade"}
          </Botao>
        </form>
      </Cartao>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba 2 — Convênios
// ---------------------------------------------------------------------------

export function AbaConvenios({ convenios }: { convenios: Insurance[] }) {
  const [novoState, novoAction, novoPending] = useActionState(
    criarConvenioAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      <Cartao
        titulo="Convênios"
        descricao="Os planos que a clínica atende. Cada profissional e cada procedimento escolhe entre eles."
      >
        <form action={novoAction} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Campo label="Novo convênio">
                <Input name="name" placeholder="Unimed, Particular..." required />
              </Campo>
            </div>
            <Botao type="submit" disabled={novoPending}>
              {novoPending ? "Adicionando..." : "Adicionar"}
            </Botao>
          </div>
          <Aviso state={novoState} />
        </form>
      </Cartao>

      {convenios.length === 0 ? (
        <Vazio>
          Nenhum convênio cadastrado. Comece por &ldquo;Particular&rdquo; se a
          clínica atende fora de convênio.
        </Vazio>
      ) : (
        <div className="space-y-3">
          {convenios.map((c) => (
            <LinhaConvenio key={c.id} convenio={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function LinhaConvenio({ convenio }: { convenio: Insurance }) {
  const [editando, setEditando] = useState(false)
  const [state, action, pending] = useActionState(
    salvarConvenioAction,
    estadoInicial,
  )
  const [, desativarAction, desativarPending] = useActionState(
    desativarConvenioAction,
    estadoInicial,
  )

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
        <span className="font-medium">{convenio.name}</span>
        {!convenio.active && <Selo>inativo</Selo>}

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-sm text-[var(--accent-on-light)] transition hover:underline dark:text-[var(--accent-dim)]"
          >
            Editar
          </button>
          {convenio.active && (
            <form action={desativarAction}>
              <input type="hidden" name="id" value={convenio.id} />
              <button
                type="submit"
                disabled={desativarPending}
                className="text-sm text-[var(--text-2)] transition hover:text-[var(--warn)] disabled:opacity-60"
              >
                Desativar
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4"
    >
      <input type="hidden" name="id" value={convenio.id} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-56 flex-1">
          <Campo label="Nome">
            <Input name="name" defaultValue={convenio.name} required />
          </Campo>
        </div>

        <label className="flex items-center gap-2 pb-3 text-sm text-[var(--text-2)]">
          <input
            type="checkbox"
            name="active"
            defaultChecked={convenio.active}
            className="size-4 accent-[var(--accent)]"
          />
          Ativo
        </label>
      </div>

      <Aviso state={state} />

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Aba 3 — Equipe
// ---------------------------------------------------------------------------

export function AbaEquipe({
  profissionais,
  convenios,
}: {
  profissionais: ProfessionalComConvenios[]
  convenios: Insurance[]
}) {
  const [aberto, setAberto] = useState(false)
  const [state, action, pending] = useActionState(
    criarProfissionalAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      <Cartao
        titulo="Equipe"
        descricao="Cada profissional tem o próprio conselho, a própria agenda e os próprios convênios."
        acao={
          !aberto && (
            <Botao type="button" onClick={() => setAberto(true)}>
              Adicionar profissional
            </Botao>
          )
        }
      >
        {aberto ? (
          <form action={action} className="space-y-5">
            <CamposDoProfissional convenios={convenios} />
            <Aviso state={state} />
            <div className="flex items-center gap-3">
              <Botao type="submit" disabled={pending}>
                {pending ? "Adicionando..." : "Adicionar"}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[var(--text-2)]">
            Clínica multi-especialidade tem CRM, CRO e CREFITO na mesma equipe —
            o conselho é de cada pessoa, não da clínica.
          </p>
        )}
      </Cartao>

      {profissionais.length === 0 ? (
        <Vazio>Nenhum profissional cadastrado ainda.</Vazio>
      ) : (
        <div className="space-y-3">
          {profissionais.map((p) => (
            <LinhaProfissional key={p.id} profissional={p} convenios={convenios} />
          ))}
        </div>
      )}
    </div>
  )
}

function CamposDoProfissional({
  profissional,
  convenios,
}: {
  profissional?: ProfessionalComConvenios
  convenios: Insurance[]
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome">
          <Input name="name" defaultValue={profissional?.name ?? ""} required />
        </Campo>

        <Campo label="Especialidade">
          <Input
            name="specialty"
            defaultValue={profissional?.specialty ?? ""}
            placeholder="Ortodontia, Cardiologia..."
          />
        </Campo>

        <CamposDeConselho
          council={profissional?.council ?? null}
          registration={profissional?.registration_number ?? null}
        />

        <Campo label="Foto" hint="(url https)">
          <Input
            name="photo_url"
            type="url"
            defaultValue={profissional?.photo_url ?? ""}
            placeholder="https://..."
          />
        </Campo>

        <Campo label="Google Calendar" hint="(opcional)">
          <Input
            name="google_calendar_id"
            defaultValue={profissional?.google_calendar_id ?? ""}
            placeholder="agenda@grupo.calendar.google.com"
          />
        </Campo>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-2)]">
          Convênios que atende
        </p>
        <EscolhaDeConvenios
          convenios={convenios}
          marcados={profissional?.insurance_ids ?? []}
        />
      </div>
    </>
  )
}

function LinhaProfissional({
  profissional,
  convenios,
}: {
  profissional: ProfessionalComConvenios
  convenios: Insurance[]
}) {
  const [editando, setEditando] = useState(false)
  const [state, action, pending] = useActionState(
    salvarProfissionalAction,
    estadoInicial,
  )
  const [, desativarAction, desativarPending] = useActionState(
    desativarProfissionalAction,
    estadoInicial,
  )

  const nomesDosConvenios = convenios
    .filter((c) => profissional.insurance_ids.includes(c.id))
    .map((c) => c.name)

  if (!editando) {
    return (
      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{profissional.name}</span>
          {profissional.council && (
            <Selo>
              {profissional.council} {profissional.registration_number}
            </Selo>
          )}
          {!profissional.active && <Selo tom="alerta">inativo</Selo>}

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-sm text-[var(--accent-on-light)] transition hover:underline dark:text-[var(--accent-dim)]"
            >
              Editar
            </button>
            {profissional.active && (
              <form action={desativarAction}>
                <input type="hidden" name="id" value={profissional.id} />
                <button
                  type="submit"
                  disabled={desativarPending}
                  className="text-sm text-[var(--text-2)] transition hover:text-[var(--warn)] disabled:opacity-60"
                >
                  Desativar
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-1 text-sm text-[var(--text-2)]">
          {profissional.specialty ?? "Sem especialidade informada"}
          {nomesDosConvenios.length > 0 && ` · ${nomesDosConvenios.join(", ")}`}
        </p>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4"
    >
      <input type="hidden" name="id" value={profissional.id} />
      <CamposDoProfissional profissional={profissional} convenios={convenios} />

      <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input
          type="checkbox"
          name="active"
          defaultChecked={profissional.active}
          className="size-4 accent-[var(--accent)]"
        />
        Ativo na equipe
      </label>

      <Aviso state={state} />

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Aba 4 — Procedimentos
// ---------------------------------------------------------------------------

export function AbaProcedimentos({
  procedimentos,
  convenios,
}: {
  procedimentos: ProcedureComConvenios[]
  convenios: Insurance[]
}) {
  const [aberto, setAberto] = useState(false)
  const [state, action, pending] = useActionState(
    criarProcedimentoAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      <Cartao
        titulo="Procedimentos"
        descricao="A duração de cada um é o que monta o bloco na agenda."
        acao={
          !aberto && (
            <Botao type="button" onClick={() => setAberto(true)}>
              Adicionar procedimento
            </Botao>
          )
        }
      >
        {aberto ? (
          <form action={action} className="space-y-5">
            <CamposDoProcedimento convenios={convenios} />
            <Aviso state={state} />
            <div className="flex items-center gap-3">
              <Botao type="submit" disabled={pending}>
                {pending ? "Adicionando..." : "Adicionar"}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <p className="text-sm text-[var(--text-2)]">
            O preço é opcional — deixe em branco para não divulgar.
          </p>
        )}
      </Cartao>

      {procedimentos.length === 0 ? (
        <Vazio>Nenhum procedimento cadastrado ainda.</Vazio>
      ) : (
        <div className="space-y-3">
          {procedimentos.map((p) => (
            <LinhaProcedimento key={p.id} procedimento={p} convenios={convenios} />
          ))}
        </div>
      )}
    </div>
  )
}

function CamposDoProcedimento({
  procedimento,
  convenios,
}: {
  procedimento?: ProcedureComConvenios
  convenios: Insurance[]
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome">
          <Input name="name" defaultValue={procedimento?.name ?? ""} required />
        </Campo>

        <Campo label="Especialidade">
          <Input name="specialty" defaultValue={procedimento?.specialty ?? ""} />
        </Campo>

        <Campo label="Duração" hint="(minutos)">
          <Input
            name="duration_minutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={procedimento?.duration_minutes ?? 30}
            required
          />
        </Campo>

        <Campo label="Preço particular" hint="(opcional)">
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={
              procedimento?.price !== null && procedimento?.price !== undefined
                ? String(procedimento.price).replace(".", ",")
                : ""
            }
            placeholder="180,00"
          />
        </Campo>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-2)]">
          Convênios que cobrem
        </p>
        <EscolhaDeConvenios
          convenios={convenios}
          marcados={procedimento?.insurance_ids ?? []}
        />
      </div>
    </>
  )
}

function LinhaProcedimento({
  procedimento,
  convenios,
}: {
  procedimento: ProcedureComConvenios
  convenios: Insurance[]
}) {
  const [editando, setEditando] = useState(false)
  const [state, action, pending] = useActionState(
    salvarProcedimentoAction,
    estadoInicial,
  )
  const [, desativarAction, desativarPending] = useActionState(
    desativarProcedimentoAction,
    estadoInicial,
  )

  const nomesDosConvenios = convenios
    .filter((c) => procedimento.insurance_ids.includes(c.id))
    .map((c) => c.name)

  if (!editando) {
    return (
      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{procedimento.name}</span>
          <Selo>{procedimento.duration_minutes} min</Selo>
          {procedimento.price !== null && (
            <Selo>
              {procedimento.price.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Selo>
          )}
          {!procedimento.active && <Selo tom="alerta">inativo</Selo>}

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-sm text-[var(--accent-on-light)] transition hover:underline dark:text-[var(--accent-dim)]"
            >
              Editar
            </button>
            {procedimento.active && (
              <form action={desativarAction}>
                <input type="hidden" name="id" value={procedimento.id} />
                <button
                  type="submit"
                  disabled={desativarPending}
                  className="text-sm text-[var(--text-2)] transition hover:text-[var(--warn)] disabled:opacity-60"
                >
                  Desativar
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-1 text-sm text-[var(--text-2)]">
          {procedimento.specialty ?? "Sem especialidade informada"}
          {nomesDosConvenios.length > 0 && ` · ${nomesDosConvenios.join(", ")}`}
        </p>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4"
    >
      <input type="hidden" name="id" value={procedimento.id} />
      <CamposDoProcedimento procedimento={procedimento} convenios={convenios} />

      <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input
          type="checkbox"
          name="active"
          defaultChecked={procedimento.active}
          className="size-4 accent-[var(--accent)]"
        />
        Oferecido pela clínica
      </label>

      <Aviso state={state} />

      <div className="flex items-center gap-3">
        <Botao type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Aba 5 — Política de agendamento
// ---------------------------------------------------------------------------

export function AbaPolitica({ politica }: { politica: SchedulingPolicy }) {
  const [state, action, pending] = useActionState(
    salvarPoliticaAction,
    estadoInicial,
  )

  return (
    <Cartao
      titulo="Política de agendamento"
      descricao="As regras que o agente segue ao marcar, remarcar e cancelar."
    >
      <form action={action} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Duração padrão do horário" hint="(minutos)">
            <Input
              name="default_slot_duration_minutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={politica.default_slot_duration_minutes}
              required
            />
          </Campo>

          <Campo label="Antecedência mínima para marcar" hint="(horas)">
            <Input
              name="min_advance_hours"
              type="number"
              min={0}
              max={8760}
              defaultValue={politica.min_advance_hours}
              required
            />
          </Campo>

          <Campo label="Antecedência mínima para cancelar" hint="(horas)">
            <Input
              name="min_cancellation_hours"
              type="number"
              min={0}
              max={8760}
              defaultValue={politica.min_cancellation_hours}
              required
            />
          </Campo>

          <Campo label="Quando o paciente falta sem avisar">
            <Select
              name="no_show_policy"
              defaultValue={politica.no_show_policy as NoShowPolicy}
            >
              {NO_SHOW_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_DO_NO_SHOW[p]}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <p className="text-sm text-[var(--text-3)]">
          A duração padrão vale para procedimento sem duração própria. Zero hora
          de antecedência aceita agendamento para agora.
        </p>

        <Aviso state={state} />

        <Botao type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar política"}
        </Botao>
      </form>
    </Cartao>
  )
}
