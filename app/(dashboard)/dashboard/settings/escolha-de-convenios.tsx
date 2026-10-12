/**
 * Lista de convênios como checkboxes.
 *
 * Um profissional pode aceitar convênio que outro da mesma equipe não
 * aceita, e um procedimento pode ser coberto por uns e não por outros —
 * por isso a escolha é por linha, e não uma configuração única da clínica.
 */
export function EscolhaDeConvenios({
  convenios,
  marcados,
}: {
  convenios: readonly { id: string; name: string; active: boolean }[]
  marcados: readonly string[]
}) {
  if (convenios.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        Nenhum convênio cadastrado ainda. Use a seção Convênios primeiro.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {convenios.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            name="insurance_ids"
            value={c.id}
            defaultChecked={marcados.includes(c.id)}
            className="size-4 accent-brand"
          />
          {c.name}
          {!c.active && <span className="text-ink-3">(inativo)</span>}
        </label>
      ))}
    </div>
  )
}
