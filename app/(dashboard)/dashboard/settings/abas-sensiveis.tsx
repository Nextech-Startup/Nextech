"use client"

import { useActionState, useState } from "react"
import {
  confirmarRegraUrgenciaAction,
  criarRegraUrgenciaAction,
  desativarRegraUrgenciaAction,
  excluirRegraUrgenciaAction,
  salvarConsentimentoAction,
  salvarRegraUrgenciaAction,
} from "./actions"
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Input,
  Selo,
  Textarea,
  Vazio,
  estadoInicial,
} from "./ui"
import {
  RETENCAO_PADRAO_ANOS,
  type ConsentText,
  type UrgencyRule,
} from "@/lib/clinic-profile/schema"

// ---------------------------------------------------------------------------
// Aba 6 — Triagem de urgência
//
// O bloco mais delicado da spec: texto de urgência mal configurado é risco
// de responsabilidade clínica, não bug de produto. A UI precisa deixar
// explícito que o conteúdo é da CLÍNICA, não do Nextech — por isso o aviso
// abaixo não é um rodapé discreto, e nenhum campo vem pré-preenchido com
// sugestão nossa.
// ---------------------------------------------------------------------------

/**
 * Aviso de responsabilidade. Aparece no topo da aba e de novo dentro da
 * confirmação: quem vai ativar uma regra lê a advertência no momento em
 * que decide, não só ao abrir a tela.
 */
function AvisoDeResponsabilidade() {
  return (
    <div className="rounded-2xl border border-[var(--warn)]/30 bg-[var(--warn)]/8 p-5">
      <p className="text-sm font-medium">
        O conteúdo desta aba é de responsabilidade da clínica
      </p>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        O Nextech não sugere palavras-chave nem redige protocolo de urgência.
        Quem define o que é urgência e o que o paciente deve ouvir é a equipe
        clínica — um protocolo insuficiente é risco assistencial, não erro de
        sistema.
      </p>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Nenhuma regra entra no ar sem alguém da clínica confirmar o texto.
      </p>
    </div>
  )
}

export function AbaUrgencia({ regras }: { regras: UrgencyRule[] }) {
  const [aberto, setAberto] = useState(false)
  const [state, action, pending] = useActionState(
    criarRegraUrgenciaAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      <AvisoDeResponsabilidade />

      <Cartao
        titulo="Regras de triagem"
        descricao="Termos que fazem a conversa escalar imediatamente para uma pessoa."
        acao={
          !aberto && (
            <Botao type="button" onClick={() => setAberto(true)}>
              Nova regra
            </Botao>
          )
        }
      >
        {aberto ? (
          <form action={action} className="space-y-5">
            <CamposDaRegra />
            <Aviso state={state} />
            <div className="flex items-center gap-3">
              <Botao type="submit" disabled={pending}>
                {pending ? "Criando..." : "Criar regra (inativa)"}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Botao>
            </div>
            <p className="text-sm text-[var(--text-3)]">
              A regra nasce inativa. Depois de criada, revise o texto e confirme
              para colocá-la no ar.
            </p>
          </form>
        ) : (
          <p className="text-sm text-[var(--text-2)]">
            Exemplos do que costuma entrar aqui: sinais que exigem atendimento
            imediato e a orientação que a clínica quer dar nesse caso. O texto é
            seu — escreva o que a sua equipe assina embaixo.
          </p>
        )}
      </Cartao>

      {regras.length === 0 ? (
        <Vazio>
          Nenhuma regra cadastrada. Sem regra ativa, o agente não escala
          urgência automaticamente.
        </Vazio>
      ) : (
        <div className="space-y-3">
          {regras.map((r) => (
            <LinhaRegra key={r.id} regra={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function CamposDaRegra({ regra }: { regra?: UrgencyRule }) {
  return (
    <>
      <Campo label="Nome da regra">
        <Input
          name="label"
          defaultValue={regra?.label ?? ""}
          placeholder="Como a clínica chama esta situação"
          required
        />
      </Campo>

      <Campo
        label="Palavras-chave"
        hint="(uma por linha, ou separadas por vírgula)"
      >
        <Textarea
          name="keywords"
          rows={4}
          defaultValue={regra?.keywords.join("\n") ?? ""}
          required
        />
      </Campo>

      <Campo label="Resposta que o paciente recebe">
        <Textarea
          name="protocol_message"
          rows={5}
          defaultValue={regra?.protocol_message ?? ""}
          placeholder="Escrito pela clínica. O Nextech não sugere texto aqui."
          required
        />
      </Campo>

      <p className="text-sm text-[var(--text-3)]">
        As palavras-chave são comparadas sem diferenciar maiúscula ou acento.
      </p>
    </>
  )
}

function LinhaRegra({ regra }: { regra: UrgencyRule }) {
  const [editando, setEditando] = useState(false)
  const [salvarState, salvarAction, salvarPending] = useActionState(
    salvarRegraUrgenciaAction,
    estadoInicial,
  )
  const [confirmarState, confirmarAction, confirmarPending] = useActionState(
    confirmarRegraUrgenciaAction,
    estadoInicial,
  )
  const [, desativarAction, desativarPending] = useActionState(
    desativarRegraUrgenciaAction,
    estadoInicial,
  )
  const [, excluirAction, excluirPending] = useActionState(
    excluirRegraUrgenciaAction,
    estadoInicial,
  )

  if (editando) {
    return (
      <form
        action={salvarAction}
        className="space-y-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4"
      >
        <input type="hidden" name="id" value={regra.id} />
        <CamposDaRegra regra={regra} />

        <p className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/8 px-4 py-3 text-sm">
          Salvar uma alteração derruba a confirmação e tira a regra do ar. É
          preciso confirmar o novo texto para reativá-la.
        </p>

        <Aviso state={salvarState} />

        <div className="flex items-center gap-3">
          <Botao type="submit" disabled={salvarPending}>
            {salvarPending ? "Salvando..." : "Salvar alteração"}
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </Botao>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{regra.label}</span>
        {regra.active ? (
          <Selo tom="ativo">no ar</Selo>
        ) : (
          <Selo tom="alerta">aguardando confirmação</Selo>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-sm text-[var(--accent-on-light)] transition hover:underline dark:text-[var(--accent-dim)]"
          >
            Editar
          </button>
          <form action={excluirAction}>
            <input type="hidden" name="id" value={regra.id} />
            <button
              type="submit"
              disabled={excluirPending}
              className="text-sm text-[var(--text-2)] transition hover:text-[var(--warn)] disabled:opacity-60"
            >
              Excluir
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {regra.keywords.map((k) => (
          <Selo key={k}>{k}</Selo>
        ))}
      </div>

      <p className="whitespace-pre-wrap rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-2)]">
        {regra.protocol_message}
      </p>

      {regra.active ? (
        <form
          action={desativarAction}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="id" value={regra.id} />
          <p className="text-sm text-[var(--text-2)]">
            Confirmada em{" "}
            {regra.confirmed_at
              ? new Date(regra.confirmed_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "—"}
            .
          </p>
          <Botao
            type="submit"
            variante="secundario"
            disabled={desativarPending}
            className="ml-auto"
          >
            {desativarPending ? "Tirando do ar..." : "Tirar do ar"}
          </Botao>
        </form>
      ) : (
        <form action={confirmarAction} className="space-y-3">
          <input type="hidden" name="id" value={regra.id} />

          {/* A caixa é obrigatória também na server action: `required` aqui é
              conveniência do navegador, não garantia. */}
          <label className="flex items-start gap-2.5 text-sm text-[var(--text-2)]">
            <input
              type="checkbox"
              name="responsabilidade"
              required
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Confirmo que este texto foi definido pela nossa equipe clínica e
              que a clínica responde pelo seu conteúdo.
            </span>
          </label>

          <Aviso state={confirmarState} />

          <Botao type="submit" disabled={confirmarPending}>
            {confirmarPending ? "Confirmando..." : "Confirmar e colocar no ar"}
          </Botao>
        </form>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba 7 — Consentimento
// ---------------------------------------------------------------------------

export function AbaConsentimento({ consent }: { consent: ConsentText | null }) {
  const [state, action, pending] = useActionState(
    salvarConsentimentoAction,
    estadoInicial,
  )

  return (
    <div className="space-y-5">
      <Cartao
        titulo="Termo de consentimento"
        descricao="O texto que o paciente aceita antes de a clínica tratar o dado de saúde dele."
        acao={consent && <Selo>versão {consent.version}</Selo>}
      >
        <form action={action} className="space-y-5">
          <Campo label="Texto do termo">
            <Textarea
              name="body"
              rows={12}
              defaultValue={consent?.body ?? ""}
              placeholder="Escrito pela clínica, que é a controladora do dado. O Nextech não fornece texto genérico."
              required
            />
          </Campo>

          <p className="text-sm text-[var(--text-3)]">
            Alterar o texto sobe a versão automaticamente. O aceite de cada
            paciente fica registrado sobre a versão vigente no momento.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Prazo de retenção de prontuário" hint="(anos)">
              <Input
                name="retention_years"
                type="number"
                min={1}
                max={100}
                defaultValue={consent?.retention_years ?? ""}
                placeholder={String(RETENCAO_PADRAO_ANOS)}
              />
            </Campo>
          </div>

          <p className="text-sm text-[var(--text-3)]">
            Cada conselho tem prazo próprio — o CFM exige 20 anos para prontuário
            médico, por exemplo. O valor informado aqui prevalece sobre o padrão
            do sistema, que é de {RETENCAO_PADRAO_ANOS} anos. Em branco, vale o
            padrão.
          </p>

          <Aviso state={state} />

          <Botao type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar termo"}
          </Botao>
        </form>
      </Cartao>
    </div>
  )
}
