import { describe, it, expect } from "vitest"
import {
  agentSchema,
  whatsappCredentialsSchema,
  businessHoursSchema,
  lerBusinessHours,
  podeCriarAgente,
  pendenciasParaPublicar,
  recomendacoesAntesDePublicar,
  estaConectado,
  HORARIO_PADRAO,
  LIMITE_DE_AGENTES,
  ESPECIALIDADES,
  ROTULO_DA_ESPECIALIDADE,
  STATUS_DE_AGENTE,
  ROTULO_DO_STATUS,
  PLANOS,
  AGENT_COLUMNS,
  type Agent,
} from "./schema"

const agenteValido = {
  name: "Recepção — Odontologia",
  specialty: "odontologia" as const,
  persona_instructions: "Cordial, objetiva, nunca dá diagnóstico.",
  greeting_message: "Olá! Sou a assistente da Clínica X.",
  business_hours: HORARIO_PADRAO,
  handoff_enabled: false,
  handoff_message: null,
}

describe("agentSchema", () => {
  it("aceita um agente completo", () => {
    expect(agentSchema.parse(agenteValido).name).toBe("Recepção — Odontologia")
  })

  it("exige nome", () => {
    const r = agentSchema.safeParse({ ...agenteValido, name: "   " })
    expect(r.success).toBe(false)
  })

  it("recusa especialidade fora do catálogo", () => {
    const r = agentSchema.safeParse({ ...agenteValido, specialty: "veterinaria" })
    expect(r.success).toBe(false)
  })

  it("converte texto em branco para null", () => {
    const r = agentSchema.parse({
      ...agenteValido,
      persona_instructions: "   ",
      greeting_message: "",
    })
    expect(r.persona_instructions).toBeNull()
    expect(r.greeting_message).toBeNull()
  })

  it("recusa persona acima do limite que o banco aceita", () => {
    // Espelha o CHECK de 4000 caracteres: os dois textos vão para o system
    // prompt do motor de conversa, e sem teto consumiriam a janela inteira.
    const r = agentSchema.safeParse({
      ...agenteValido,
      persona_instructions: "a".repeat(4001),
    })
    expect(r.success).toBe(false)
  })

  it("recusa chave desconhecida — clinic_id forjado não passa", () => {
    // .strict(): o clinic_id real vem sempre de requireClinicContext().
    const r = agentSchema.safeParse({
      ...agenteValido,
      clinic_id: "00000000-0000-0000-0000-000000000000",
    })
    expect(r.success).toBe(false)
  })

  it("recusa status forjado no formulário", () => {
    // Publicar é uma mutation própria, não um campo do formulário.
    const r = agentSchema.safeParse({ ...agenteValido, status: "active" })
    expect(r.success).toBe(false)
  })

  describe("handoff", () => {
    it("recusa handoff ligado sem mensagem", () => {
      // Mesma regra da constraint agents_handoff_completo: sem ela a IA
      // transferiria em silêncio e o paciente veria a conversa parar.
      const r = agentSchema.safeParse({
        ...agenteValido,
        handoff_enabled: true,
        handoff_message: null,
      })
      expect(r.success).toBe(false)
      expect(r.error?.issues[0].path).toEqual(["handoff_message"])
    })

    it("aceita handoff ligado com mensagem", () => {
      const r = agentSchema.safeParse({
        ...agenteValido,
        handoff_enabled: true,
        handoff_message: "Vou chamar alguém da equipe.",
      })
      expect(r.success).toBe(true)
    })

    it("aceita handoff desligado sem mensagem", () => {
      const r = agentSchema.safeParse({
        ...agenteValido,
        handoff_enabled: false,
        handoff_message: null,
      })
      expect(r.success).toBe(true)
    })
  })
})

describe("horário de atendimento", () => {
  it("aceita o padrão comercial", () => {
    expect(businessHoursSchema.safeParse(HORARIO_PADRAO).success).toBe(true)
  })

  it("recusa hora em formato inválido", () => {
    const r = businessHoursSchema.safeParse({
      seg: { open: true, start: "8h", end: "18:00" },
    })
    expect(r.success).toBe(false)
  })

  it("recusa hora fora do relógio de 24h", () => {
    const r = businessHoursSchema.safeParse({
      seg: { open: true, start: "25:00", end: "26:00" },
    })
    expect(r.success).toBe(false)
  })

  it("recusa fim antes do início num dia aberto", () => {
    const r = businessHoursSchema.safeParse({
      seg: { open: true, start: "18:00", end: "08:00" },
    })
    expect(r.success).toBe(false)
  })

  it("não valida a ordem num dia fechado", () => {
    // Fechar um dia não deve apagar nem invalidar o horário guardado nele.
    const r = businessHoursSchema.safeParse({
      seg: { open: false, start: "18:00", end: "08:00" },
    })
    expect(r.success).toBe(true)
  })

  it("recusa dia fora da semana", () => {
    const r = businessHoursSchema.safeParse({
      octidi: { open: true, start: "08:00", end: "18:00" },
    })
    expect(r.success).toBe(false)
  })

  describe("lerBusinessHours", () => {
    it("cai no padrão se o jsonb vier malformado", () => {
      // Escrita por service_role ou de uma versão anterior do formato não
      // deve impedir a tela de abrir.
      expect(lerBusinessHours({ seg: "aberto" })).toEqual(HORARIO_PADRAO)
      expect(lerBusinessHours(null)).toEqual(HORARIO_PADRAO)
      expect(lerBusinessHours("texto")).toEqual(HORARIO_PADRAO)
    })

    it("completa dias faltantes com o padrão", () => {
      const lido = lerBusinessHours({
        seg: { open: true, start: "10:00", end: "16:00" },
      })
      expect(lido.seg).toEqual({ open: true, start: "10:00", end: "16:00" })
      expect(lido.dom).toEqual(HORARIO_PADRAO.dom)
    })
  })
})

describe("credenciais do WhatsApp", () => {
  const credenciais = {
    whatsapp_phone_number_id: "109876543210987",
    whatsapp_waba_id: "123456789012345",
    whatsapp_access_token: "EAAG9ZC1exemploDeTokenComTamanhoRealista0123",
  }

  it("aceita credenciais bem formadas", () => {
    expect(whatsappCredentialsSchema.safeParse(credenciais).success).toBe(true)
  })

  it("recusa phone number id não numérico", () => {
    // Id da Meta é só dígitos: validar evita que um erro de cópia ocupe o
    // UNIQUE global com lixo.
    const r = whatsappCredentialsSchema.safeParse({
      ...credenciais,
      whatsapp_phone_number_id: "+55 11 99999-9999",
    })
    expect(r.success).toBe(false)
  })

  it("recusa token curto demais para ser real", () => {
    const r = whatsappCredentialsSchema.safeParse({
      ...credenciais,
      whatsapp_access_token: "abc",
    })
    expect(r.success).toBe(false)
  })

  it("exige os três campos juntos — conectar é um ato só", () => {
    const r = whatsappCredentialsSchema.safeParse({
      whatsapp_phone_number_id: "109876543210987",
    })
    expect(r.success).toBe(false)
  })
})

describe("limite de agentes por plano", () => {
  it("starter permite 1", () => {
    expect(podeCriarAgente("starter", 0)).toBe(true)
    expect(podeCriarAgente("starter", 1)).toBe(false)
  })

  it("pro permite 3", () => {
    expect(podeCriarAgente("pro", 2)).toBe(true)
    expect(podeCriarAgente("pro", 3)).toBe(false)
  })

  it("healthtech é ilimitado", () => {
    expect(LIMITE_DE_AGENTES.healthtech).toBeNull()
    expect(podeCriarAgente("healthtech", 500)).toBe(true)
  })

  it("todo plano do enum tem limite definido", () => {
    for (const plano of PLANOS) {
      expect(LIMITE_DE_AGENTES).toHaveProperty(plano)
    }
  })
})

describe("prontidão para publicar", () => {
  const base: Agent = {
    id: "a",
    clinic_id: "c",
    name: "Recepção",
    specialty: "odontologia",
    persona_instructions: "Cordial.",
    greeting_message: "Olá!",
    business_hours: HORARIO_PADRAO,
    handoff_enabled: false,
    handoff_message: null,
    whatsapp_phone_number_id: "109876543210987",
    whatsapp_waba_id: "123456789012345",
    status: "draft",
    first_published_at: null,
    created_at: "2026-09-16T00:00:00Z",
    updated_at: "2026-09-16T00:00:00Z",
  }

  it("agente completo não tem pendência", () => {
    expect(pendenciasParaPublicar(base)).toEqual([])
  })

  it("aponta a falta do WhatsApp", () => {
    const p = pendenciasParaPublicar({ ...base, whatsapp_phone_number_id: null })
    expect(p).toContain("Conecte um número de WhatsApp.")
  })

  it("só bloqueia o que o trigger do banco também recusa", () => {
    // Saudação e persona não impedem a publicação no banco. Bloquear na
    // tela faria as duas camadas discordarem sobre o que "publicar" exige
    // — e `service_role` passaria por cima da regra inventada.
    const p = pendenciasParaPublicar({
      ...base,
      greeting_message: null,
      persona_instructions: null,
    })
    expect(p).toEqual([])
  })

  it("mas avisa sobre saudação e persona como recomendação", () => {
    const r = recomendacoesAntesDePublicar({
      ...base,
      greeting_message: null,
      persona_instructions: null,
    })
    expect(r).toHaveLength(2)
  })

  it("agente completo não tem recomendação pendente", () => {
    expect(recomendacoesAntesDePublicar(base)).toEqual([])
  })

  it("estaConectado responde pelo número, única coluna visível", () => {
    // O token não é legível pela aplicação; a constraint
    // agents_credenciais_coerentes é o que torna a pergunta honesta.
    expect(estaConectado(base)).toBe(true)
    expect(estaConectado({ ...base, whatsapp_phone_number_id: null })).toBe(false)
  })
})

describe("vocabulário", () => {
  it("toda especialidade tem rótulo", () => {
    for (const e of ESPECIALIDADES) {
      expect(ROTULO_DA_ESPECIALIDADE[e]).toBeTruthy()
    }
  })

  it("todo status tem rótulo", () => {
    for (const s of STATUS_DE_AGENTE) {
      expect(ROTULO_DO_STATUS[s]).toBeTruthy()
    }
  })
})

describe("colunas de leitura", () => {
  it("nunca inclui a coluna do token", () => {
    // Não é só higiene: a coluna está fora do grant de SELECT de
    // `authenticated`, então pedi-la faria a consulta inteira falhar com
    // permission denied. É a regra 7 de lgpd-security materializada.
    expect(AGENT_COLUMNS).not.toContain("token")
    expect(AGENT_COLUMNS).not.toContain("*")
  })

  it("inclui o que a tela precisa", () => {
    for (const coluna of [
      "id",
      "name",
      "specialty",
      "status",
      "whatsapp_phone_number_id",
      "first_published_at",
    ]) {
      expect(AGENT_COLUMNS).toContain(coluna)
    }
  })
})
