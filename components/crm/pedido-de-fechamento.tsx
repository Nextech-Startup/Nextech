"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Botao, Campo, Input, Select } from "@/components/patterns/formulario"
import { lerValorEmCentavos, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import { MOTIVOS_DE_PERDA, ROTULO_DO_MOTIVO, ehMotivoDePerda, type Oportunidade, type Referencia } from "@/lib/crm/tipos"

/**
 * Ganho pede procedimento e valor; Perdido pede o motivo da lista. É um
 * <dialog> nativo: foco preso, Esc fecha, nada de alert(). O pedido só sai
 * se a regra da lib aceita.
 */
export function PedidoDeFechamento({
  op,
  para,
  procedimentos,
  aoConfirmar,
  aoCancelar,
}: {
  op: Oportunidade
  para: "ganho" | "perdido"
  procedimentos: readonly Referencia[]
  aoConfirmar: (pedido: PedidoDeMovimento) => void
  aoCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    const pedido: PedidoDeMovimento = { oportunidadeId: op.id, de: op.etapa, para }
    if (para === "ganho") {
      pedido.procedimento = procedimentos.find((p) => p.id === dados.get("procedimento")) ?? null
      pedido.valorCentavos = lerValorEmCentavos(String(dados.get("valor") ?? ""))
    } else {
      const motivo = dados.get("motivo")
      pedido.motivo = ehMotivoDePerda(motivo) ? motivo : null
    }
    const r = validarMovimento(op, pedido)
    if (r.status !== "ok") return setErro(mensagemDoMovimento(r))
    // Fecha antes de desmontar: assim o foco volta ao elemento de origem, não ao body.
    ref.current?.close()
    aoConfirmar(pedido)
  }

  return (
    <dialog
      ref={ref}
      onClose={aoCancelar}
      aria-labelledby="fechamento-titulo"
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-panel border border-hairline bg-surface-0 p-0 text-ink-1 backdrop:bg-black/40"
    >
      <form onSubmit={confirmar} className="grid gap-4 p-5">
        <h2 id="fechamento-titulo" className="text-base font-semibold">
          {para === "ganho" ? "Marcar como Ganho" : "Marcar como Perdido"}: {nomeDoPaciente(op)}
        </h2>
        {para === "ganho" ? (
          <>
            <Campo label="Procedimento fechado">
              <Select name="procedimento" defaultValue={op.procedimento?.id ?? ""} required>
                <option value="" disabled>
                  Escolha
                </option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Valor fechado (R$)" hint="Ex.: 1.200,00">
              <Input
                name="valor"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={op.valorCentavos !== null ? (op.valorCentavos / 100).toFixed(2).replace(".", ",") : ""}
                required
              />
            </Campo>
          </>
        ) : (
          <Campo label="Motivo da perda">
            <Select name="motivo" defaultValue="" required>
              <option value="" disabled>
                Escolha
              </option>
              {MOTIVOS_DE_PERDA.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_DO_MOTIVO[m]}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        {erro && (
          <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => ref.current?.close()}>
            Cancelar
          </Botao>
          <Botao type="submit">Confirmar</Botao>
        </div>
      </form>
    </dialog>
  )
}
