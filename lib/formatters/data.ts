/**
 * Datas do painel, sempre no fuso da clínica.
 *
 * A Vercel roda em UTC e o navegador no fuso de quem abre: sem fixar o
 * fuso, a consulta das 08:00 viraria 11:00 no servidor. Os nomes de mês e
 * de dia vêm de tabela própria, não do texto do Intl, que muda entre
 * versões do ICU ("set." / "set") e quebraria a hidratação quando o HTML
 * do servidor e o do navegador divergissem.
 */
export const FUSO_PADRAO = "America/Sao_Paulo"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const SEMANA_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

export type PartesDaData = {
  ano: number
  /** 1 a 12. */
  mes: number
  dia: number
  hora: number
  minuto: number
  /** 0 = domingo. */
  diaDaSemana: number
}

const formatos = new Map<string, Intl.DateTimeFormat>()

/** Só os números do Intl são usados; o texto vem das tabelas acima. */
function formato(fuso: string): Intl.DateTimeFormat {
  let f = formatos.get(fuso)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
      weekday: "short",
    })
    formatos.set(fuso, f)
  }
  return f
}

function comoData(instante: Date | string): Date {
  const data = typeof instante === "string" ? new Date(instante) : instante
  if (Number.isNaN(data.getTime())) throw new RangeError("Data inválida")
  return data
}

export function partesDaData(instante: Date | string, fuso = FUSO_PADRAO): PartesDaData {
  const p: Record<string, string> = {}
  for (const parte of formato(fuso).formatToParts(comoData(instante))) p[parte.type] = parte.value
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaDaSemana: SEMANA_EN.indexOf(p.weekday),
  }
}

const dois = (n: number) => String(n).padStart(2, "0")

export function formatarHora(instante: Date | string, fuso = FUSO_PADRAO): string {
  const p = partesDaData(instante, fuso)
  return `${dois(p.hora)}:${dois(p.minuto)}`
}

export function formatarData(instante: Date | string, fuso = FUSO_PADRAO): string {
  const p = partesDaData(instante, fuso)
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`
}

export function formatarDataCurta(instante: Date | string, fuso = FUSO_PADRAO): string {
  const p = partesDaData(instante, fuso)
  return `${p.dia} ${MESES[p.mes - 1]}`
}

// ---------------------------------------------------------------------------
// Chaves de dia ("2026-09-28"): aritmética de calendário sem fuso no meio
// ---------------------------------------------------------------------------

export function chaveDoDia(instante: Date | string, fuso = FUSO_PADRAO): string {
  const p = partesDaData(instante, fuso)
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`
}

function utcDaChave(chave: string): number {
  const [ano, mes, dia] = chave.split("-").map(Number)
  const t = Date.UTC(ano, mes - 1, dia)
  if (Number.isNaN(t)) throw new RangeError("Dia inválido")
  return t
}

function chaveDoUtc(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}

export function somarDias(chave: string, dias: number): string {
  return chaveDoUtc(utcDaChave(chave) + dias * DIA)
}

export function diaDaSemanaDaChave(chave: string): number {
  return new Date(utcDaChave(chave)).getUTCDay()
}

/** Os 7 dias da semana da chave, de segunda a domingo. */
export function semanaDe(chave: string): string[] {
  const desdeSegunda = (diaDaSemanaDaChave(chave) + 6) % 7
  const segunda = somarDias(chave, -desdeSegunda)
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
}

/** "segunda, 28 de setembro" */
export function descreverDia(chave: string): string {
  const [, mes, dia] = chave.split("-").map(Number)
  return `${DIAS_LONGOS[diaDaSemanaDaChave(chave)]}, ${dia} de ${MESES_LONGOS[mes - 1]}`
}

/** "seg 28" */
export function rotuloCurtoDoDia(chave: string): string {
  return `${DIAS_CURTOS[diaDaSemanaDaChave(chave)]} ${Number(chave.slice(8, 10))}`
}

/** "28 set": para intervalos como "28 set a 4 out". */
export function dataCurtaDaChave(chave: string): string {
  const [, mes, dia] = chave.split("-").map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

// ---------------------------------------------------------------------------
// Tempo relativo e duração
// ---------------------------------------------------------------------------

/**
 * "há 5 min", "ontem", "12 set". Só olha para trás: instante no futuro
 * (relógio adiantado) vira "agora" em vez de um "há -3 min".
 */
export function tempoRelativo(
  instante: Date | string,
  agora: Date | string,
  fuso = FUSO_PADRAO,
): string {
  const diff = comoData(agora).getTime() - comoData(instante).getTime()
  if (diff < MINUTO) return "agora"

  const minutos = Math.floor(diff / MINUTO)
  if (minutos < 60) return `há ${minutos} min`

  const dias = (utcDaChave(chaveDoDia(agora, fuso)) - utcDaChave(chaveDoDia(instante, fuso))) / DIA
  if (dias === 0) return `há ${Math.floor(minutos / 60)} h`
  if (dias === 1) return "ontem"
  if (dias < 7) return `há ${dias} dias`

  const a = partesDaData(instante, fuso)
  const curta = `${a.dia} ${MESES[a.mes - 1]}`
  return a.ano === partesDaData(agora, fuso).ano ? curta : `${curta} ${a.ano}`
}

/** "3 h 12 min", "45 min", "5 dias". Acima de um dia, horas viram ruído. */
export function formatarDuracao(ms: number): string {
  if (ms < MINUTO) return "menos de 1 min"
  const minutos = Math.floor(ms / MINUTO)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas < 24) return resto ? `${horas} h ${resto} min` : `${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? "1 dia" : `${dias} dias`
}
