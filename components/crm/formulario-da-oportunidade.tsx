"use client"

import { useState, type FormEvent } from "react"
import { Botao, Campo, Input, Select, Textarea } from "@/components/patterns/formulario"
import { TAMANHO_MAXIMO_DA_NOTA } from "@/lib/crm/detalhes"
import type { Oportunidade, Referencia } from "@/lib/crm/tipos"
import { dataHoraLocal } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"

const FALHA = "Não foi possível salvar. Tente de novo."

/**
 * O campo `nota` só vai ao servidor quando a equipe mexeu nele. Ausente, a
 * lib preserva a nota gravada (inclusive uma ilegível); vazio, apaga
 * (`lerDetalhes`). Uma textarea com `name` sempre mandaria o texto, e o ""
 * de uma nota que não carregou apagaria a gravada: por isso a textarea não
 * tem `name`, e o texto entra aqui. `nota` nulo = não editada.
 */
export function formularioParaEnvio(form: FormData, nota: string | null): FormData {
  if (nota === null) form.delete("nota")
  else form.set("nota", nota)
  return form
}

/**
 * Os campos da oportunidade real (spec crm-v1, "Os outros campos"). O
 * formulário vai para a server action, que confere tudo de novo; a nota
 * segue no corpo do POST e é cifrada na lib antes de gravar. O envio é por
 * `onSubmit` (e não `action`) para o React não limpar o que a pessoa
 * digitou quando o servidor recusa.
 */
export function FormularioDaOportunidade({
  op,
  procedimentos,
  equipe,
  salvar,
  aoSalvar,
}: {
  op: Oportunidade
  procedimentos: Referencia[]
  equipe: Referencia[]
  salvar: (form: FormData) => Promise<{ erro: string | null }>
  aoSalvar: () => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [nota, setNota] = useState<string | null>(null)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = formularioParaEnvio(new FormData(e.currentTarget), nota)
    setEnviando(true)
    setSalvo(false)
    const r = await salvar(form).catch(() => ({ erro: FALHA }))
    setEnviando(false)
    setErro(r.erro)
    if (!r.erro) {
      setSalvo(true)
      aoSalvar()
    }
  }

  // O procedimento apagado do perfil some da lista, mas o atual continua escolhível.
  const opcoes =
    op.procedimento && !procedimentos.some((p) => p.id === op.procedimento?.id) ? [op.procedimento, ...procedimentos] : procedimentos

  return (
    <form onSubmit={enviar} className="grid gap-3" aria-label="Campos da oportunidade">
      <input type="hidden" name="oportunidade" value={op.id} />
      <Campo label="Procedimento">
        <Select name="procedimento" defaultValue={op.procedimento?.id ?? ""}>
          <option value="">Não informado</option>
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="Valor" hint="em reais">
        <Input
          name="valor"
          inputMode="decimal"
          placeholder="1.200,00"
          defaultValue={op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : ""}
        />
      </Campo>
      <Campo label="Responsável">
        <Select name="responsavel" defaultValue={op.responsavel?.id ?? ""}>
          <option value="">Sem responsável</option>
          {equipe.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="Próxima ação">
        <Input type="datetime-local" name="proxima_acao" defaultValue={op.proximaAcao ? dataHoraLocal(op.proximaAcao) : ""} />
      </Campo>
      {op.notaIlegivel ? (
        // Sem campo: a nota gravada não decifrou e não pode ser sobrescrita às cegas.
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium text-ink-2">Nota</h3>
          <p className="text-sm text-ink-3">Nota indisponível no momento. Ela continua guardada e não muda ao salvar.</p>
        </section>
      ) : (
        <Campo label="Nota" hint="visível só para a equipe">
          <Textarea
            rows={4}
            maxLength={TAMANHO_MAXIMO_DA_NOTA}
            defaultValue={op.nota ?? ""}
            onChange={(e) => setNota(e.target.value)}
          />
        </Campo>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger-fg">
          {erro}
        </p>
      )}
      {salvo && !erro && (
        <p role="status" className="text-sm text-ink-2">
          Campos salvos.
        </p>
      )}
      <Botao type="submit" disabled={enviando} className="justify-self-start">
        {enviando ? "Salvando…" : "Salvar"}
      </Botao>
    </form>
  )
}
