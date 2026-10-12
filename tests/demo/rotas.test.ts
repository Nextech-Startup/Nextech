import { isValidElement, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ClinicRole } from "@/lib/auth/context"
import { podeAcessar } from "@/lib/navigation/acesso"
import { contarSegmentos, filtrarPacientes, lerSegmento } from "@/components/patients/segmentos"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AoVivo } from "@/components/conversations/ao-vivo"
import { AvisoDeDesconexao } from "@/components/conversations/aviso-de-desconexao"
import { CaixaDeConversas } from "@/components/conversations/caixa-de-conversas"
import { filtrarConversas } from "@/components/conversations/estado"
import type { ConversaResumo } from "@/components/conversations/tipos"
import { TelaDeVisaoGeral } from "@/components/overview/tela-de-visao-geral"
import { ListaDeAgentesEmOperacao } from "@/components/agents/lista-em-operacao"
import { OperacaoDoAgente } from "@/components/agents/operacao-do-agente"
import { ListaDeAgentes } from "@/app/(dashboard)/dashboard/agents/lista"
import { FormularioDeAgente } from "@/app/(dashboard)/dashboard/agents/formulario"
import { deslocarDatas, girarDiasDaSemana, relogioDoMinuto } from "@/lib/demo/relogio"
import { AGORA } from "@/app/_fixtures/agora"
import { AGENTES, DETALHES_DOS_AGENTES } from "@/app/_fixtures/agentes"
import { COMPROMISSOS, EXPEDIENTE } from "@/app/_fixtures/agenda"
import { COBRANCA } from "@/app/_fixtures/cobranca"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { ALTERACOES, CONVITES, MEMBROS } from "@/app/_fixtures/equipe"
import { fichaDoPaciente } from "@/app/_fixtures/fichas"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"
import { PACIENTES } from "@/app/_fixtures/pacientes"
import { SEQUENCIAS } from "@/app/_fixtures/sequencias"
import { TEMPLATES } from "@/app/_fixtures/templates"
import { VISAO_GERAL } from "@/app/_fixtures/visao-geral"

const CLINICA = "Clínica Demonstração (teste)"
const EMAIL = "dono@exemplo.test"

const contexto = vi.hoisted(() => ({
  role: "owner" as ClinicRole,
  isDemo: false,
  email: "dono@exemplo.test" as string | null,
}))

vi.mock("@/lib/auth/context", () => ({
  ClinicContextError: class extends Error {},
  requireClinicContext: async () => ({
    clinicId: "clinica-1",
    userId: "usuario-1",
    supabase: {},
    ...contexto,
  }),
}))

vi.mock("@/lib/clinics/queries", () => ({
  getCurrentClinic: async () => ({ id: "clinica-1", legal_name: "Clínica Demonstração (teste)", status: "draft" }),
}))

// O dado real das rotas que já existiam: a clínica comum lê daqui.
vi.mock("@/lib/agent-config/queries", () => ({
  listAgents: async () => [],
  getClinicPlan: async () => "starter",
  getAgent: async (id: string) => ({ id, name: "Agente real" }),
}))

vi.mock("@/lib/clinic-profile/queries", () => ({
  getRegulatoryIdentity: async () => ({
    cnpj: null,
    technical_responsible_name: null,
    technical_responsible_council: null,
    technical_responsible_registration_number: null,
  }),
  listProfessionals: async () => [],
  listProcedures: async () => [],
}))

// A tela real de Conversas lê daqui: um paciente que não existe nas fixtures.
const conversasReais = vi.hoisted(() => {
  const paciente = {
    id: "paciente-real",
    nome: "Paciente Real",
    telefone: "+5581900000099",
    convenio: null,
    consentimentoEm: null,
    optOut: false,
    desde: "2026-10-01T10:00:00-03:00",
    sequenciaAtiva: null,
    proximaConsulta: null,
  }
  const resumo = {
    id: "00000000-0000-4000-8000-000000000001",
    paciente,
    agente: "Recepção real",
    atendidaPor: "ai" as const,
    urgente: false,
    ultimaDoPaciente: "2026-10-07T08:00:00-03:00",
    ultima: { autor: "patient" as const, previa: "Oi", em: "2026-10-07T08:00:00-03:00" },
    naoLidas: 0,
  }
  return {
    fila: [resumo],
    aberta: { ...resumo, humanoAssumiuEm: null, itens: [] },
    avisos: [] as { agenteId: string; agente: string; desde: string }[],
  }
})

const listarConversas = vi.hoisted(() => vi.fn())
vi.mock("@/lib/conversations/queries", () => ({
  listarConversas: async (...args: unknown[]) => {
    listarConversas(...args)
    return conversasReais.fila
  },
  buscarConversas: async () => [],
  abrirConversa: async (id: string) => (id === conversasReais.aberta.id ? conversasReais.aberta : null),
  avisosDeDesconexao: async () => conversasReais.avisos,
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
  /** A rota do menu que decide quem abre (a ficha segue a lista, o agente segue Agentes). */
  menu: string
  carregar: () => Promise<{ default: Pagina }>
  busca?: Record<string, string>
  id?: string
  /** Props do componente que precisam chegar deslocadas, com o valor esperado a 9 dias. */
  confere?: Record<string, unknown>
  /** O `agora` que a tela recebe, quando não é o das fixtures a 9 dias. */
  agora?: string
}

// 07/10/2026 é 9 dias depois do AGORA das fixtures (28/09).
const HOJE = "2026-10-07T09:00:00-03:00"
const DIAS = 9
const AGORA_DESLOCADO = "2026-10-07T14:32:00-03:00"
const d = <T,>(v: T) => deslocarDatas(v, DIAS)
// Conversas da demonstração anda até o minuto real (evolution-demo-v1).
const m = <T,>(v: T) => relogioDoMinuto(AGORA, HOJE).deslocar(v)
const AGORA_REAL = new Date(HOJE).toISOString()
const comEmailDaSessao = (membros: typeof MEMBROS, email: string) =>
  membros.map((m) => (m.voce ? { ...m, email } : m))

const conversa = CONVERSAS[0]
const sequencia = SEQUENCIAS[SEQUENCIAS.length - 1]
const template = TEMPLATES[TEMPLATES.length - 1]
const agente = DETALHES_DOS_AGENTES[0]
const paciente = PACIENTES[0].id

const NOVAS: Rota[] = [
  {
    rota: "/dashboard/schedule",
    menu: "/dashboard/schedule",
    carregar: () => import("@/app/(dashboard)/dashboard/schedule/page"),
    confere: { compromissos: d(COMPROMISSOS) },
  },
  {
    rota: "/dashboard/patients",
    menu: "/dashboard/patients",
    carregar: () => import("@/app/(dashboard)/dashboard/patients/page"),
    confere: {
      pacientes: filtrarPacientes(d(PACIENTES), { segmento: lerSegmento(undefined), busca: "" }, AGORA_DESLOCADO),
      contagens: contarSegmentos(d(PACIENTES), AGORA_DESLOCADO),
    },
  },
  {
    rota: "/dashboard/patients/[id]",
    menu: "/dashboard/patients",
    carregar: () => import("@/app/(dashboard)/dashboard/patients/[id]/page"),
    id: paciente,
    confere: { paciente: d(fichaDoPaciente(paciente)) },
  },
  {
    rota: "/dashboard/sequences",
    menu: "/dashboard/sequences",
    carregar: () => import("@/app/(dashboard)/dashboard/sequences/page"),
    busca: { s: sequencia.id },
    confere: { aberta: d(sequencia) },
  },
  {
    rota: "/dashboard/templates",
    menu: "/dashboard/templates",
    carregar: () => import("@/app/(dashboard)/dashboard/templates/page"),
    busca: { t: template.id },
    confere: { aberto: d(template) },
  },
  {
    rota: "/dashboard/settings/team",
    menu: "/dashboard/settings/team",
    carregar: () => import("@/app/(dashboard)/dashboard/settings/team/page"),
    confere: {
      membros: comEmailDaSessao(d(MEMBROS), EMAIL),
      convites: d(CONVITES),
      alteracoes: d(ALTERACOES),
    },
  },
  {
    rota: "/dashboard/integrations",
    menu: "/dashboard/integrations",
    carregar: () => import("@/app/(dashboard)/dashboard/integrations/page"),
    confere: { painel: d(INTEGRACOES) },
  },
  {
    rota: "/dashboard/billing",
    menu: "/dashboard/billing",
    carregar: () => import("@/app/(dashboard)/dashboard/billing/page"),
    confere: { resumo: d(COBRANCA) },
  },
  {
    rota: "/dashboard/account",
    menu: "/dashboard/account",
    carregar: () => import("@/app/(dashboard)/dashboard/account/page"),
    confere: { conta: { ...d(MINHA_CONTA), email: EMAIL, papel: "owner", clinica: CLINICA } },
  },
]

const EXISTENTES: Rota[] = [
  {
    rota: "/dashboard/conversations",
    menu: "/dashboard/conversations",
    carregar: () => import("@/app/(dashboard)/dashboard/conversations/page"),
    busca: { c: conversa.id },
    confere: { aberta: m(conversa) },
    agora: AGORA_REAL,
  },
  {
    rota: "/dashboard",
    menu: "/dashboard",
    carregar: () => import("@/app/(dashboard)/dashboard/page"),
    confere: { dados: { ...d(VISAO_GERAL), clinica: CLINICA } },
  },
  {
    rota: "/dashboard/agents",
    menu: "/dashboard/agents",
    carregar: () => import("@/app/(dashboard)/dashboard/agents/page"),
    confere: { agentes: d(AGENTES) },
  },
  {
    rota: "/dashboard/agents/[id]",
    menu: "/dashboard/agents",
    carregar: () => import("@/app/(dashboard)/dashboard/agents/[id]/page"),
    id: agente.id,
    confere: { agente: d(agente) },
  },
]

const TODAS = [...NOVAS, ...EXISTENTES]
const rota = (caminho: string) => TODAS.find((r) => r.rota === caminho)!

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
  contexto.email = EMAIL
})

describe("numa clínica comum", () => {
  it.each(NOVAS.map((r) => [r.rota, r] as const))("%s responde 404", async (_rota, r) => {
    await expect(abrir(r)).rejects.toThrow("NOT_FOUND")
  })

  it.each(["owner", "staff", "professional"] as const)(
    "rota nova responde 404 antes de conferir o papel (%s)",
    async (role) => {
      contexto.role = role
      for (const r of NOVAS) await expect(abrir(r)).rejects.toThrow("NOT_FOUND")
    },
  )

  // As rotas que já existiam desviam para a fixture só com isDemo: fora da
  // demonstração, a clínica vê o próprio dado, e nunca o paciente inventado.
  it.each(["owner", "staff"] as const)("Visão geral mostra a tela real (%s)", async (role) => {
    contexto.role = role
    const tela = await abrir(rota("/dashboard"))
    expect(tela.type).not.toBe(TelaDeVisaoGeral)
    expect(tela.type).toBe("div")
  })

  it.each(["owner", "staff"] as const)("Conversas mostra a tela real, nunca a fixture (%s)", async (role) => {
    contexto.role = role
    const tela = await abrir({ ...rota("/dashboard/conversations"), busca: {} })
    expect(tela.type).toBe(CaixaDeConversas)
    const props = tela.props as Record<string, unknown>
    expect((props.modo as { tipo: string }).tipo).toBe("clinica")
    // A fila inteira: o recorte é do navegador (FilaDaCaixa).
    expect(props.todas).toEqual(conversasReais.fila)
    expect(props.aberta).toEqual(conversasReais.aberta)
  })

  describe("aviso de desconexão do WhatsApp", () => {
    const aviso = { agenteId: "agente-real", agente: "Recepção real", desde: "2026-10-07T07:00:00-03:00" }
    afterEach(() => {
      conversasReais.avisos = []
    })

    it.each([
      ["owner", true],
      ["staff", false],
    ] as const)("aparece para %s, com o caminho de reconectar só para o owner", async (role, podeReconectar) => {
      contexto.role = role
      conversasReais.avisos = [aviso]
      const tela = await abrir({ ...rota("/dashboard/conversations"), busca: {} })
      const elemento = (tela.props as { aviso: ReactElement }).aviso
      expect(elemento.type).toBe(AvisoDeDesconexao)
      expect(elemento.props).toMatchObject({ avisos: [aviso], podeReconectar, agentesHref: "/dashboard/agents" })
    })

    it("sem desconexão, não há faixa", async () => {
      const tela = await abrir({ ...rota("/dashboard/conversations"), busca: {} })
      expect((tela.props as { aviso: unknown }).aviso).toBeFalsy()
    })
  })

  it.each([
    ["um id que não é uuid", "abc"],
    ["um uuid de outra clínica", "00000000-0000-4000-8000-000000000099"],
  ])("com %s na URL, nenhuma conversa abre", async (_caso, c) => {
    const tela = await abrir({ ...rota("/dashboard/conversations"), busca: { c } })
    expect((tela.props as { aberta: unknown }).aberta).toBeNull()
  })

  it("o ?q= da URL não é lido: a busca da tela real é por POST", async () => {
    listarConversas.mockClear()
    const tela = await abrir({ ...rota("/dashboard/conversations"), busca: { q: "Maria" } })
    const props = tela.props as { filtro: { busca: string }; buscar: unknown }
    expect(props.filtro.busca).toBe("")
    expect(typeof props.buscar).toBe("function")
    expect(listarConversas).toHaveBeenCalledWith()
  })

  it("o profissional vê a permissão negada de Conversas, sem o caminho da demonstração", async () => {
    contexto.role = "professional"
    const tela = await abrir(rota("/dashboard/conversations"))
    expect(tela.type).toBe(PermissaoNegada)
    expect((tela.props as { demo?: boolean }).demo).toBe(false)
  })

  it("Agentes mostra a lista real", async () => {
    const tela = await abrir(rota("/dashboard/agents"))
    expect(tela.type).not.toBe(ListaDeAgentesEmOperacao)
    expect(tela.type).toBe(ListaDeAgentes)
  })

  it("o agente mostra o editor real, mesmo com o id de um agente de exemplo", async () => {
    const tela = await abrir(rota("/dashboard/agents/[id]"))
    expect(tela.type).not.toBe(OperacaoDoAgente)
    expect(tela.type).toBe(FormularioDeAgente)
  })

  it("o profissional que cai na raiz vê o aviso, e não é redirecionado", async () => {
    contexto.role = "professional"
    const tela = await abrir(rota("/dashboard"))
    expect(isValidElement(tela)).toBe(true)
  })
})

describe("na conta de demonstração", () => {
  beforeEach(() => {
    contexto.isDemo = true
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(HOJE))
  })
  afterEach(() => vi.useRealTimers())

  it.each(TODAS.map((r) => [r.rota, r] as const))(
    "%s abre com o dado de exemplo trazido para hoje",
    async (_rota, r) => {
      const tela = await abrir(r)
      expect(isValidElement(tela)).toBe(true)
      expect(tela.type).not.toBe(PermissaoNegada)
      const recebidas = tela.props as Record<string, unknown>
      if ("agora" in recebidas) expect(recebidas.agora).toBe(r.agora ?? AGORA_DESLOCADO)
      for (const [prop, esperado] of Object.entries(r.confere ?? {})) {
        expect(recebidas[prop], prop).toEqual(esperado)
      }
    },
  )

  it("a agenda abre no dia de hoje, com o expediente girado junto", async () => {
    const tela = await abrir(rota("/dashboard/schedule"))
    const recebidas = tela.props as { data: string; expediente: typeof EXPEDIENTE }
    expect(recebidas.data).toBe("2026-10-07")
    expect(recebidas.expediente.diasAbertos).toEqual(girarDiasDaSemana(EXPEDIENTE.diasAbertos, DIAS))
  })

  // O filtro por papel continua valendo: a regra vem do menu (spec), e cada
  // rota é conferida com cada papel.
  for (const role of ["owner", "staff", "professional"] as const) {
    it.each(TODAS.filter((r) => r.rota !== "/dashboard").map((r) => [r.rota, r] as const))(
      `%s segue o menu para ${role}`,
      async (_rota, r) => {
        contexto.role = role
        const tela = await abrir(r)
        if (podeAcessar(role, r.menu)) {
          expect(tela.type).not.toBe(PermissaoNegada)
        } else {
          expect(tela.type).toBe(PermissaoNegada)
          // O caminho de volta conta as telas que abrem na demonstração.
          expect((tela.props as { demo?: boolean }).demo).toBe(true)
        }
      },
    )
  }

  it("o profissional entra pela Agenda, e não pela Visão geral", async () => {
    contexto.role = "professional"
    await expect(abrir(rota("/dashboard"))).rejects.toThrow("REDIRECT:/dashboard/schedule")
  })

  it("sem e-mail na sessão, a persona mantém o e-mail da fixture nas duas telas", async () => {
    contexto.email = null
    const conta = (await abrir(rota("/dashboard/account"))).props as { conta: { email: string } }
    expect(conta.conta.email).toBe(MINHA_CONTA.email)
    const equipe = (await abrir(rota("/dashboard/settings/team"))).props as { membros: typeof MEMBROS }
    expect(equipe.membros).toEqual(d(MEMBROS))
  })

  it("ficha e agente inexistentes respondem 404", async () => {
    await expect(abrir({ ...rota("/dashboard/patients/[id]"), id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
    await expect(abrir({ ...rota("/dashboard/agents/[id]"), id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
  })

  // A conversa real do canal de demonstração entra na fila de exemplo.
  describe("Conversas com o canal de demonstração (evolution-demo-v1)", () => {
    type Props = {
      todas: unknown[]
      filtro: { busca: string }
      aberta: unknown
      modo?: { tipo: string }
      caminhoDaFicha?: string
      buscar?: unknown
      aoVivo?: ReactElement
    }
    const conversas = async (busca: Record<string, string> = {}) =>
      (await abrir({ ...rota("/dashboard/conversations"), busca })).props as Props

    // O recorte e a contagem saem da fila inteira no navegador (FilaDaCaixa).
    it("a fila junta a real e as de exemplo, inteira, para o recorte do navegador", async () => {
      const props = await conversas({ status: "ia" })
      expect(props.todas).toEqual([...conversasReais.fila, ...m(CONVERSAS)])
      expect(props.todas).toHaveLength(CONVERSAS.length + 1)
    })

    it("sem conversa pedida, abre a primeira do recorte da URL", async () => {
      const todas = [...conversasReais.fila, ...m(CONVERSAS)] as ConversaResumo[]
      const primeira = filtrarConversas(todas, { estado: "aguardando", busca: "" })[0]
      const props = await conversas({ status: "aguardando" })
      expect((props.aberta as { id: string }).id).toBe(primeira.id)
    })

    it("a real abre pela leitura real, com as ações reais e sem a ficha", async () => {
      const props = await conversas({ c: conversasReais.aberta.id })
      expect(props.aberta).toEqual(conversasReais.aberta)
      expect(props.modo?.tipo).toBe("clinica")
      expect(props.caminhoDaFicha).toBeUndefined()
    })

    it("a de exemplo abre com o protótipo e a ficha", async () => {
      const props = await conversas({ c: conversa.id })
      expect(props.aberta).toEqual(m(conversa))
      expect(props.modo).toBeUndefined()
      expect(props.caminhoDaFicha).toBe("/dashboard/patients")
    })

    it("um uuid que não é da clínica não abre nada", async () => {
      const props = await conversas({ c: "00000000-0000-4000-8000-000000000099" })
      expect(props.aberta).toBeNull()
    })

    it("o ?q= não é lido: a busca é por POST, também na demonstração", async () => {
      const props = await conversas({ q: conversa.paciente.nome ?? "Maria" })
      expect(props.filtro.busca).toBe("")
      expect(props.todas).toHaveLength(CONVERSAS.length + 1)
      expect(typeof props.buscar).toBe("function")
    })

    it("as de exemplo andam até o minuto real: a mais recente delas fica no agora real", async () => {
      const props = (await conversas()) as Props & { agora: string }
      expect(props.agora).toBe(AGORA_REAL)
      const ultimas = m(CONVERSAS).map((c) => new Date(c.ultima.em).getTime())
      expect(Math.max(...ultimas)).toBeLessThanOrEqual(new Date(AGORA_REAL).getTime())
      // A conversa real das 08:00 de hoje é anterior ao agora real (09:00), e não ao das fixtures.
      expect(new Date(conversasReais.fila[0].ultima.em).getTime()).toBeLessThan(new Date(props.agora).getTime())
    })

    it("o tempo real assina o canal da clínica de demonstração", async () => {
      const props = await conversas()
      expect(props.aoVivo?.type).toBe(AoVivo)
      expect(props.aoVivo?.props).toEqual({ clinicId: "clinica-1" })
    })
  })
})
