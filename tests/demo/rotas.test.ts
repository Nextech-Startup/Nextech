import { isValidElement, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ClinicRole } from "@/lib/auth/context"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { deslocarDatas, girarDiasDaSemana } from "@/lib/demo/relogio"
import { AGENTES, DETALHES_DOS_AGENTES } from "@/app/_fixtures/agentes"
import { COMPROMISSOS, EXPEDIENTE } from "@/app/_fixtures/agenda"
import { COBRANCA } from "@/app/_fixtures/cobranca"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { MEMBROS } from "@/app/_fixtures/equipe"
import { fichaDoPaciente } from "@/app/_fixtures/fichas"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"
import { PACIENTES } from "@/app/_fixtures/pacientes"
import { SEQUENCIAS } from "@/app/_fixtures/sequencias"
import { TEMPLATES } from "@/app/_fixtures/templates"
import { VISAO_GERAL } from "@/app/_fixtures/visao-geral"

const contexto = vi.hoisted(() => ({ role: "owner" as ClinicRole, isDemo: false }))

vi.mock("@/lib/auth/context", () => ({
  ClinicContextError: class extends Error {},
  requireClinicContext: async () => ({
    clinicId: "clinica-1",
    userId: "usuario-1",
    email: "dono@exemplo.test",
    supabase: {},
    ...contexto,
  }),
}))

const CLINICA = "Clínica Demonstração (teste)"
const EMAIL = "dono@exemplo.test"

vi.mock("@/lib/clinics/queries", () => ({
  getCurrentClinic: async () => ({ id: "clinica-1", legal_name: "Clínica Demonstração (teste)" }),
}))

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`)
  },
}))

/** O que o Next entrega a toda página; cada uma lê só o que usa. */
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }
type Pagina = (props: Props) => Promise<ReactElement>
type Rota = {
  rota: string
  carregar: () => Promise<{ default: Pagina }>
  busca?: Record<string, string>
  id?: string
  /** Prop do componente que precisa chegar deslocada, e o valor esperado com 9 dias. */
  confere?: [prop: string, esperado: unknown]
}

// 07/10/2026 é 9 dias depois do AGORA das fixtures (28/09).
const HOJE = "2026-10-07T09:00:00-03:00"
const DIAS = 9
const AGORA_DESLOCADO = "2026-10-07T14:32:00-03:00"
const d = <T,>(v: T) => deslocarDatas(v, DIAS)

const conversa = CONVERSAS[0]
const sequencia = SEQUENCIAS[SEQUENCIAS.length - 1]
const template = TEMPLATES[TEMPLATES.length - 1]
const agente = DETALHES_DOS_AGENTES[0]
const paciente = PACIENTES[0].id

const NOVAS: Rota[] = [
  { rota: "/dashboard/conversations", carregar: () => import("@/app/(dashboard)/dashboard/conversations/page"), busca: { c: conversa.id }, confere: ["aberta", d(conversa)] },
  { rota: "/dashboard/schedule", carregar: () => import("@/app/(dashboard)/dashboard/schedule/page"), confere: ["compromissos", d(COMPROMISSOS)] },
  { rota: "/dashboard/patients", carregar: () => import("@/app/(dashboard)/dashboard/patients/page") },
  { rota: "/dashboard/patients/[id]", carregar: () => import("@/app/(dashboard)/dashboard/patients/[id]/page"), id: paciente, confere: ["paciente", d(fichaDoPaciente(paciente))] },
  { rota: "/dashboard/sequences", carregar: () => import("@/app/(dashboard)/dashboard/sequences/page"), busca: { s: sequencia.id }, confere: ["aberta", d(sequencia)] },
  { rota: "/dashboard/templates", carregar: () => import("@/app/(dashboard)/dashboard/templates/page"), busca: { t: template.id }, confere: ["aberto", d(template)] },
  { rota: "/dashboard/settings/team", carregar: () => import("@/app/(dashboard)/dashboard/settings/team/page"), confere: ["membros", d(MEMBROS).map((m) => (m.voce ? { ...m, email: EMAIL } : m))] },
  { rota: "/dashboard/integrations", carregar: () => import("@/app/(dashboard)/dashboard/integrations/page"), confere: ["painel", d(INTEGRACOES)] },
  { rota: "/dashboard/billing", carregar: () => import("@/app/(dashboard)/dashboard/billing/page"), confere: ["resumo", d(COBRANCA)] },
  { rota: "/dashboard/account", carregar: () => import("@/app/(dashboard)/dashboard/account/page"), confere: ["conta", { ...d(MINHA_CONTA), email: EMAIL, papel: "owner", clinica: CLINICA }] },
]

const EXISTENTES: Rota[] = [
  { rota: "/dashboard", carregar: () => import("@/app/(dashboard)/dashboard/page"), confere: ["dados", { ...d(VISAO_GERAL), clinica: CLINICA }] },
  { rota: "/dashboard/agents", carregar: () => import("@/app/(dashboard)/dashboard/agents/page"), confere: ["agentes", d(AGENTES)] },
  { rota: "/dashboard/agents/[id]", carregar: () => import("@/app/(dashboard)/dashboard/agents/[id]/page"), id: agente.id, confere: ["agente", d(agente)] },
]

function props(r: Rota): Props {
  return {
    params: Promise.resolve({ id: r.id ?? "" }),
    searchParams: Promise.resolve(r.busca ?? {}),
  }
}

async function abrir(r: Rota): Promise<ReactElement> {
  const { default: pagina } = await r.carregar()
  return pagina(props(r))
}

beforeEach(() => {
  contexto.role = "owner"
  contexto.isDemo = false
})

describe("rotas novas numa clínica comum", () => {
  it.each(NOVAS.map((r) => [r.rota, r] as const))("%s responde 404", async (_rota, r) => {
    await expect(abrir(r)).rejects.toThrow("NOT_FOUND")
  })

  it("responde 404 antes de conferir o papel", async () => {
    contexto.role = "professional"
    await expect(abrir(NOVAS.find((r) => r.rota === "/dashboard/billing")!)).rejects.toThrow("NOT_FOUND")
  })
})

describe("na conta de demonstração", () => {
  beforeEach(() => {
    contexto.isDemo = true
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(HOJE))
  })
  afterEach(() => vi.useRealTimers())

  it.each([...NOVAS, ...EXISTENTES].map((r) => [r.rota, r] as const))(
    "%s abre com o dado de exemplo trazido para hoje",
    async (_rota, r) => {
      const tela = await abrir(r)
      expect(isValidElement(tela)).toBe(true)
      expect(tela.type).not.toBe(PermissaoNegada)
      const recebidas = tela.props as Record<string, unknown>
      if ("agora" in recebidas) expect(recebidas.agora).toBe(AGORA_DESLOCADO)
      if (r.confere) expect(recebidas[r.confere[0]]).toEqual(r.confere[1])
    },
  )

  it("a agenda abre no dia de hoje, com o expediente girado junto", async () => {
    const tela = await abrir(NOVAS.find((r) => r.rota === "/dashboard/schedule")!)
    const recebidas = tela.props as { data: string; expediente: typeof EXPEDIENTE }
    expect(recebidas.data).toBe("2026-10-07")
    expect(recebidas.expediente.diasAbertos).toEqual(girarDiasDaSemana(EXPEDIENTE.diasAbertos, DIAS))
  })

  it("o filtro por papel continua valendo", async () => {
    contexto.role = "staff"
    for (const rota of ["/dashboard/settings/team", "/dashboard/integrations", "/dashboard/billing"]) {
      const tela = await abrir(NOVAS.find((r) => r.rota === rota)!)
      expect(tela.type).toBe(PermissaoNegada)
    }
    contexto.role = "professional"
    const conversas = await abrir(NOVAS.find((r) => r.rota === "/dashboard/conversations")!)
    expect(conversas.type).toBe(PermissaoNegada)
  })

  it("o profissional entra pela Agenda, e não pela Visão geral", async () => {
    contexto.role = "professional"
    await expect(abrir(EXISTENTES.find((r) => r.rota === "/dashboard")!)).rejects.toThrow(
      "REDIRECT:/dashboard/schedule",
    )
  })

  it("Minha conta abre para todos os papéis", async () => {
    contexto.role = "professional"
    const tela = await abrir(NOVAS.find((r) => r.rota === "/dashboard/account")!)
    expect(tela.type).not.toBe(PermissaoNegada)
  })

  it("ficha e agente inexistentes respondem 404", async () => {
    await expect(abrir({ ...NOVAS.find((r) => r.rota === "/dashboard/patients/[id]")!, id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
    await expect(abrir({ ...EXISTENTES.find((r) => r.rota === "/dashboard/agents/[id]")!, id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
  })
})
