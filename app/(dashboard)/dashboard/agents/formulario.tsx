"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import {
  conectarWhatsappAction,
  desconectarWhatsappAction,
  excluirAgenteAction,
  pausarAgenteAction,
  publicarAgenteAction,
  salvarAgenteAction,
} from "./actions"
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Input,
  Select,
  SeloDeStatus,
  Textarea,
  estadoInicial,
} from "./ui"
import {
  DIAS,
  ESPECIALIDADES,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_DIA,
  estaConectado,
  lerBusinessHours,
  pendenciasParaPublicar,
  recomendacoesAntesDePublicar,
  type Agent,
} from "@/lib/agent-config/schema"

export function FormularioDeAgente({ agente }: { agente: Agent }) {
  const pendencias = pendenciasParaPublicar(agente)
  const recomendacoes = recomendacoesAntesDePublicar(agente)
  const conectado = estaConectado(agente)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/agents"
            className="text-sm text-[var(--text-2)] transition hover:text-[var(--text-1)]"
          >
            ← Agentes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{agente.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {ROTULO_DA_ESPECIALIDADE[agente.specialty]}
          </p>
        </div>
        <SeloDeStatus status={agente.status} />
      </header>

      <Publicacao
        agente={agente}
        pendencias={pendencias}
        recomendacoes={recomendacoes}
      />
      <Configuracao agente={agente} />
      <ConexaoWhatsapp agente={agente} conectado={conectado} />
      <PreviewPendente />
      <ZonaDeRisco agente={agente} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publicar / pausar
// ---------------------------------------------------------------------------

function Publicacao({
  agente,
  pendencias,
  recomendacoes,
}: {
  agente: Agent
  pendencias: readonly string[]
  recomendacoes: readonly string[]
}) {
  const [statePub, publicar, publicando] = useActionState(
    publicarAgenteAction,
    estadoInicial,
  )
  const [statePause, pausar, pausando] = useActionState(
    pausarAgenteAction,
    estadoInicial,
  )

  const ativo = agente.status === "active"
  const bloqueado = pendencias.length > 0

  return (
    <Cartao
      titulo={ativo ? "Publicado" : "Publicação"}
      descricao={
        ativo
          ? "Este agente está respondendo pacientes no WhatsApp."
          : "Publicar coloca o agente para responder o tráfego real do número conectado."
      }
    >
      <div className="space-y-4">
        <Aviso state={statePub} />
        <Aviso state={statePause} />

        {/* Duas listas com pesos diferentes. A primeira é o que o trigger
            agents_enforce_publish recusa no banco; a segunda é conselho,
            e não desabilita nada — inventar uma trava que o banco não tem
            faria as duas camadas discordarem sobre o que "publicar"
            exige. */}
        {bloqueado && !ativo && (
          <div className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/8 px-4 py-3 text-sm">
            <p className="font-medium">Falta para publicar:</p>
            <ul className="mt-1.5 list-inside list-disc text-[var(--text-2)]">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {recomendacoes.length > 0 && !ativo && (
          <div className="rounded-xl border border-[var(--hairline)] px-4 py-3 text-sm">
            <p className="font-medium">Dá para publicar, mas considere antes:</p>
            <ul className="mt-1.5 list-inside list-disc text-[var(--text-2)]">
              {recomendacoes.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {ativo ? (
            <form action={pausar}>
              <input type="hidden" name="agent_id" value={agente.id} />
              <Botao type="submit" variante="secundario" disabled={pausando}>
                {pausando ? "Pausando…" : "Pausar agente"}
              </Botao>
            </form>
          ) : (
            <form action={publicar}>
              <input type="hidden" name="agent_id" value={agente.id} />
              <Botao type="submit" disabled={publicando || bloqueado}>
                {publicando ? "Publicando…" : "Publicar agente"}
              </Botao>
            </form>
          )}
        </div>

        {agente.first_published_at && (
          <p className="text-xs text-[var(--text-3)]">
            Publicado pela primeira vez em{" "}
            {new Date(agente.first_published_at).toLocaleDateString("pt-BR")}.
          </p>
        )}
      </div>
    </Cartao>
  )
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

function Configuracao({ agente }: { agente: Agent }) {
  const [state, action, pending] = useActionState(
    salvarAgenteAction,
    estadoInicial,
  )
  const horario = lerBusinessHours(agente.business_hours)
  const [handoff, setHandoff] = useState(agente.handoff_enabled)

  return (
    <Cartao
      titulo="Configuração"
      descricao="Como o agente se apresenta e se comporta na conversa."
    >
      <form action={action} className="space-y-6">
        <input type="hidden" name="agent_id" value={agente.id} />
        <Aviso state={state} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome">
            <Input name="name" defaultValue={agente.name} required />
          </Campo>

          <Campo label="Especialidade">
            <Select name="specialty" defaultValue={agente.specialty}>
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_DA_ESPECIALIDADE[e]}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <Campo
          label="Saudação"
          hint="— a primeira mensagem que o paciente recebe"
        >
          <Textarea
            name="greeting_message"
            rows={3}
            maxLength={1000}
            defaultValue={agente.greeting_message ?? ""}
            placeholder="Olá! Sou a assistente da Clínica X. Como posso ajudar?"
          />
        </Campo>

        <Campo
          label="Persona"
          hint="— tom, limites e comportamento na conversa"
        >
          <Textarea
            name="persona_instructions"
            rows={6}
            maxLength={4000}
            defaultValue={agente.persona_instructions ?? ""}
            placeholder="Cordial e objetiva. Nunca dá diagnóstico nem opinião clínica. Se o paciente descrever sintoma grave, segue o protocolo de urgência da clínica."
          />
        </Campo>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-[var(--text-2)]">
            Horário de atendimento humano
          </legend>
          <p className="text-sm text-[var(--text-3)]">
            Fora dessa janela a IA informa quando a equipe retorna, em vez de
            oferecer transferência.
          </p>

          <div className="space-y-2">
            {DIAS.map((dia) => (
              <div key={dia} className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm text-[var(--text-2)]">
                  <input
                    type="checkbox"
                    name={`${dia}_open`}
                    defaultChecked={horario[dia]?.open}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {ROTULO_DO_DIA[dia]}
                </label>

                <input
                  type="time"
                  name={`${dia}_start`}
                  defaultValue={horario[dia]?.start}
                  aria-label={`${ROTULO_DO_DIA[dia]}: início`}
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-0)] px-2.5 py-1.5 text-sm"
                />
                <span className="text-sm text-[var(--text-3)]">às</span>
                <input
                  type="time"
                  name={`${dia}_end`}
                  defaultValue={horario[dia]?.end}
                  aria-label={`${ROTULO_DO_DIA[dia]}: fim`}
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-0)] px-2.5 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-[var(--text-2)]">
            Transferência para atendente
          </legend>

          <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
            <input
              type="checkbox"
              name="handoff_enabled"
              defaultChecked={agente.handoff_enabled}
              onChange={(e) => setHandoff(e.currentTarget.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            A IA pode transferir a conversa para uma pessoa da equipe
          </label>

          {/* O campo aparece com o checkbox porque a mensagem passa a ser
              obrigatória: transferir em silêncio deixaria o paciente
              vendo a conversa parar sem explicação. */}
          {handoff && (
            <Campo label="Mensagem de transferência">
              <Textarea
                name="handoff_message"
                rows={2}
                maxLength={1000}
                defaultValue={agente.handoff_message ?? ""}
                placeholder="Vou chamar alguém da nossa equipe para continuar seu atendimento."
              />
            </Campo>
          )}
        </fieldset>

        <Botao type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configuração"}
        </Botao>
      </form>
    </Cartao>
  )
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/**
 * Conexão do WhatsApp.
 *
 * Conectado, mostra só um indicador — nunca o token, nem mascarado, nem
 * num campo desabilitado (regra 7 de lgpd-security). O valor não está
 * sequer disponível aqui: a coluna está fora do grant de SELECT de
 * `authenticated`, então o servidor não teria como passá-lo.
 *
 * Trocar a credencial significa colar as três de novo, e é o
 * comportamento correto: quem não tem o token em mãos não deveria
 * conseguir alterar só o número.
 */
function ConexaoWhatsapp({
  agente,
  conectado,
}: {
  agente: Agent
  conectado: boolean
}) {
  const [stateCon, conectar, conectando] = useActionState(
    conectarWhatsappAction,
    estadoInicial,
  )
  const [stateDesc, desconectar, desconectando] = useActionState(
    desconectarWhatsappAction,
    estadoInicial,
  )
  const [trocando, setTrocando] = useState(false)

  return (
    <Cartao
      titulo="WhatsApp"
      descricao="Credenciais da Cloud API da Meta. Um número atende um agente só."
      acao={
        conectado ? (
          <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]">
            conectado
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Aviso state={stateCon} />
        <Aviso state={stateDesc} />

        {conectado && !trocando ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--text-3)]">Phone Number ID</dt>
                <dd className="mt-0.5 font-mono text-[var(--text-1)]">
                  {agente.whatsapp_phone_number_id}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-3)]">WABA ID</dt>
                <dd className="mt-0.5 font-mono text-[var(--text-1)]">
                  {agente.whatsapp_waba_id}
                </dd>
              </div>
            </dl>

            <p className="text-xs text-[var(--text-3)]">
              O token de acesso fica criptografado e não é exibido de volta —
              nem para você. Para trocá-lo, informe as credenciais de novo.
            </p>

            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setTrocando(true)}
              >
                Trocar credenciais
              </Botao>

              <form action={desconectar}>
                <input type="hidden" name="agent_id" value={agente.id} />
                <Botao type="submit" variante="perigo" disabled={desconectando}>
                  {desconectando ? "Desconectando…" : "Desconectar"}
                </Botao>
              </form>
            </div>
          </>
        ) : (
          <form action={conectar} className="space-y-4">
            <input type="hidden" name="agent_id" value={agente.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Phone Number ID" hint="— só dígitos">
                <Input
                  name="whatsapp_phone_number_id"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="109876543210987"
                />
              </Campo>

              <Campo label="WABA ID" hint="— só dígitos">
                <Input
                  name="whatsapp_waba_id"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="123456789012345"
                />
              </Campo>
            </div>

            <Campo
              label="Token de acesso"
              hint="— guardado criptografado; não será exibido de novo"
            >
              {/* type="password" e autoComplete="off": o token não deve
                  ficar visível no ombro de ninguém nem no gerenciador de
                  senhas do navegador. */}
              <Input
                name="whatsapp_access_token"
                type="password"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="EAAG…"
              />
            </Campo>

            <div className="flex gap-2">
              <Botao type="submit" disabled={conectando}>
                {conectando ? "Conectando…" : "Conectar WhatsApp"}
              </Botao>
              {trocando && (
                <Botao
                  type="button"
                  variante="secundario"
                  onClick={() => setTrocando(false)}
                >
                  Cancelar
                </Botao>
              )}
            </div>
          </form>
        )}
      </div>
    </Cartao>
  )
}

// ---------------------------------------------------------------------------
// Preview — fase 3b
// ---------------------------------------------------------------------------

/**
 * O preview de conversa é o comportamento 3 e o critério de aceite 3 da
 * spec, e não foi entregue nesta fatia: ele roda uma conversa de verdade,
 * e o motor de IA é a fase 3b.
 *
 * Aparece como cartão inerte, e não escondido, pelo mesmo motivo dos itens
 * "em breve" da sidebar: a tela conta o que ainda não existe em vez de
 * deixar a clínica procurar um botão que a spec promete.
 */
function PreviewPendente() {
  return (
    <Cartao
      titulo="Testar conversa"
      descricao="Simula o atendimento com a persona configurada, sem falar com pacientes reais."
    >
      <div className="rounded-xl border border-dashed border-[var(--hairline)] p-6 text-center text-sm text-[var(--text-2)]">
        <p>Disponível quando o motor de conversa entrar no ar.</p>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Você já pode configurar e publicar o agente normalmente.
        </p>
      </div>
    </Cartao>
  )
}

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

function ZonaDeRisco({ agente }: { agente: Agent }) {
  const [state, excluir, excluindo] = useActionState(
    excluirAgenteAction,
    estadoInicial,
  )
  const [confirmando, setConfirmando] = useState(false)

  // Agente que já foi publicado não se apaga: a mutation recusa, e a tela
  // diz por quê em vez de oferecer um botão que sempre falharia.
  const jaAtendeu = agente.first_published_at !== null

  return (
    <Cartao titulo="Excluir agente">
      <div className="space-y-4">
        <Aviso state={state} />

        {jaAtendeu ? (
          <p className="text-sm text-[var(--text-2)]">
            Este agente já atendeu pacientes e não pode ser excluído — o
            histórico das conversas depende dele. Pause-o para que pare de
            responder.
          </p>
        ) : confirmando ? (
          <form action={excluir} className="space-y-3">
            <input type="hidden" name="agent_id" value={agente.id} />
            <p className="text-sm text-[var(--text-2)]">
              Excluir <strong>{agente.name}</strong>? A configuração é perdida.
            </p>
            <div className="flex gap-2">
              <Botao type="submit" variante="perigo" disabled={excluindo}>
                {excluindo ? "Excluindo…" : "Sim, excluir"}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <Botao
            type="button"
            variante="perigo"
            onClick={() => setConfirmando(true)}
          >
            Excluir agente
          </Botao>
        )}
      </div>
    </Cartao>
  )
}
