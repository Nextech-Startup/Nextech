"use client"

import { useActionState, useState } from "react"
import { Plus } from "lucide-react"
import { criarClinicaAction, type AdminFormState } from "./actions"
import { Aviso, Botao, Campo, Input } from "@/components/patterns/formulario"
import { Cartao } from "@/components/patterns/cartao"

const estadoInicial: AdminFormState = { error: null, success: null }

export function NovaClinicaForm() {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, pending] = useActionState(criarClinicaAction, estadoInicial)

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" onClick={() => setAberto(true)}>
          <Plus data-icon aria-hidden="true" />
          Nova clínica
        </Botao>
        {state.success && <Aviso state={{ error: null, success: state.success }} />}
      </div>
    )
  }

  return (
    <Cartao
      titulo="Nova clínica"
      descricao="A clínica nasce em rascunho. Ative depois de convidar o responsável."
    >
      <form action={formAction} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Razão social">
            <Input name="legal_name" required autoFocus placeholder="Clínica Exemplo Ltda" />
          </Campo>
          <Campo label="CNPJ" hint="(opcional agora)">
            <Input name="cnpj" placeholder="00.000.000/0000-00" />
          </Campo>
        </div>

        <Aviso state={{ error: state.error, success: null }} />

        <div className="flex gap-2">
          <Botao type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar clínica"}
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Cartao>
  )
}
