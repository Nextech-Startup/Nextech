/**
 * Conflito de agenda: dois compromissos do mesmo profissional ao mesmo
 * tempo. A agenda mostra antes de confirmar (prompt mestre, seção 6); o
 * motor de agendamento (fase 5) usa a mesma regra para recusar.
 */

export type StatusDoAgendamento = "pendente" | "confirmado" | "cancelado" | "faltou"

export type Agendamento = {
  id: string
  profissionalId: string
  inicio: string
  fim: string
  status: StatusDoAgendamento
}

/** Par em conflito e o trecho em que os dois se sobrepõem. */
export type Conflito = { profissionalId: string; ids: [string, string]; inicio: string; fim: string }

type Intervalo = Pick<Agendamento, "inicio" | "fim">

const t = (iso: string) => new Date(iso).getTime()

/**
 * Um começa antes de o outro terminar. Encostar (fim de um = início do
 * outro) não é conflito: é agenda cheia, que é justamente o objetivo.
 */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return t(a.inicio) < t(b.fim) && t(b.inicio) < t(a.fim)
}

export function encontrarConflitos(ags: readonly Agendamento[]): Conflito[] {
  for (const a of ags) {
    if (!(t(a.fim) > t(a.inicio))) {
      throw new RangeError(`Agendamento ${a.id} sem duração: fim precisa ser depois do início`)
    }
  }

  // Cancelado libera o horário; "faltou" ocupou a vaga e continua contando.
  const porProfissional = new Map<string, Agendamento[]>()
  for (const a of ags) {
    if (a.status === "cancelado") continue
    const lista = porProfissional.get(a.profissionalId) ?? []
    lista.push(a)
    porProfissional.set(a.profissionalId, lista)
  }

  const conflitos: Conflito[] = []
  for (const [profissionalId, lista] of porProfissional) {
    const ordenada = [...lista].sort((a, b) => t(a.inicio) - t(b.inicio) || a.id.localeCompare(b.id))
    for (let i = 0; i < ordenada.length; i++) {
      const a = ordenada[i]
      // Ordenada por início: o primeiro que começa depois do fim de `a`
      // encerra a busca, e ninguém depois dele pode se sobrepor a `a`.
      for (let j = i + 1; j < ordenada.length && t(ordenada[j].inicio) < t(a.fim); j++) {
        const b = ordenada[j]
        conflitos.push({
          profissionalId,
          ids: [a.id, b.id],
          inicio: new Date(Math.max(t(a.inicio), t(b.inicio))).toISOString(),
          fim: new Date(Math.min(t(a.fim), t(b.fim))).toISOString(),
        })
      }
    }
  }

  return conflitos.sort(
    (x, y) => t(x.inicio) - t(y.inicio) || x.ids.join().localeCompare(y.ids.join()),
  )
}

export function idsEmConflito(cs: readonly Conflito[]): Set<string> {
  return new Set(cs.flatMap((c) => c.ids))
}
