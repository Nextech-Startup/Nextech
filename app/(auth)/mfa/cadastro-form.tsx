"use client"

import { useActionState } from "react"
import { Botao, Campo, Input } from "@/components/patterns/formulario"
import { cadastrar, type EstadoDoCadastro } from "./acoes"

const inicial: EstadoDoCadastro = { etapa: "nome", erro: null }

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
      {texto}
    </p>
  )
}

/**
 * Duas etapas no mesmo estado: o nome do dispositivo gera o QR code, e o
 * primeiro código confirma. O segredo fica só na memória desta tela.
 */
export function CadastroForm({ reserva }: { reserva: boolean }) {
  const [etapa, agir, pendente] = useActionState(cadastrar, inicial)

  if (etapa.etapa === "nome") {
    return (
      <form action={agir} className="grid gap-4">
        <Campo label="Nome do dispositivo">
          <Input
            id="nome"
            name="nome"
            required
            maxLength={40}
            defaultValue={reserva ? "Celular reserva" : "Celular"}
            autoComplete="off"
          />
        </Campo>
        <Erro texto={etapa.erro} />
        <Botao type="submit" disabled={pendente} className="h-10 w-full">
          {pendente ? "Gerando…" : "Gerar QR code"}
        </Botao>
      </form>
    )
  }

  return (
    <form action={agir} className="grid gap-4">
      <input type="hidden" name="reserva" value={reserva ? "1" : "0"} />
      <ol className="grid gap-1 text-sm text-ink-2">
        <li>1. Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>2. Leia o QR code abaixo.</li>
        <li>3. Digite o código de 6 dígitos que aparecer.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI do Auth, sem otimização possível */}
      <img src={etapa.qrCode} alt="QR code do autenticador" width={192} height={192} className="mx-auto rounded-xl bg-white p-2" />
      <details className="text-sm text-ink-2">
        <summary className="cursor-pointer">Não consigo ler o QR code</summary>
        <p className="mt-2">Digite esta chave no aplicativo:</p>
        <code className="mt-1 block break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-ink-1">{etapa.segredo}</code>
      </details>
      <Campo label="Código do autenticador">
        <Input
          id="codigo"
          name="codigo"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          autoFocus
        />
      </Campo>
      <Erro texto={etapa.erro} />
      <Botao type="submit" disabled={pendente} className="h-10 w-full">
        {pendente ? "Confirmando…" : "Confirmar"}
      </Botao>
    </form>
  )
}
