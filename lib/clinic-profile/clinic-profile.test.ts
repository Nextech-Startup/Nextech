import { describe, it, expect } from "vitest"
import {
  consentTextSchema,
  detectarUrgencia,
  insuranceSchema,
  normalizarTermo,
  parseKeywords,
  parsePreco,
  pendenciasRegulatorias,
  prazoDeRetencao,
  procedureSchema,
  professionalSchema,
  regulatoryIdentitySchema,
  schedulingPolicySchema,
  urgencyRuleSchema,
  RETENCAO_PADRAO_ANOS,
  type UrgencyRule,
} from "./schema"
import { hashDoConteudo } from "./mutations"

// ---------------------------------------------------------------------------
// Critério de aceite 1: a clínica consegue preencher os sete blocos.
//
// A parte testável sem banco é a validação: o que ela aceita e o que ela
// recusa decide se o dado chega íntegro do outro lado.
// ---------------------------------------------------------------------------

describe("identidade regulatória", () => {
  it("aceita o perfil preenchido por inteiro", () => {
    const r = regulatoryIdentitySchema.parse({
      technical_responsible_name: "Dra. Ana Lima",
      council: "CRM",
      registration_number: "12345-PE",
      sanitary_license: "ALV-2026-001",
    })

    expect(r.technical_responsible_name).toBe("Dra. Ana Lima")
    expect(r.council).toBe("CRM")
  })

  it("aceita perfil vazio: a clínica preenche aos poucos", () => {
    const r = regulatoryIdentitySchema.parse({})
    expect(r.technical_responsible_name).toBeNull()
    expect(r.council).toBeNull()
  })

  it("converte campo em branco da tela para nulo", () => {
    // Formulário HTML manda "" para campo não preenchido. Gravar "" faria
    // `pendenciasRegulatorias` considerar o campo preenchido.
    const r = regulatoryIdentitySchema.parse({
      technical_responsible_name: "   ",
      sanitary_license: "",
    })
    expect(r.technical_responsible_name).toBeNull()
    expect(r.sanitary_license).toBeNull()
  })

  it("recusa conselho sem número de registro", () => {
    // "CRM" sozinho não identifica ninguém.
    expect(() =>
      regulatoryIdentitySchema.parse({ council: "CRM" }),
    ).toThrow()
  })

  it("recusa número de registro sem conselho", () => {
    expect(() =>
      regulatoryIdentitySchema.parse({ registration_number: "12345" }),
    ).toThrow()
  })

  it("recusa conselho que não existe", () => {
    expect(() =>
      regulatoryIdentitySchema.parse({
        council: "CRX",
        registration_number: "1",
      }),
    ).toThrow()
  })

  it("recusa chave desconhecida, como um clinic_id forjado", () => {
    // Regra 2 do CLAUDE.md: o clinic_id vem da sessão, nunca do input.
    expect(() =>
      regulatoryIdentitySchema.parse({
        technical_responsible_name: "Ana",
        clinic_id: "00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow()
  })

  it("recusa um status forjado", () => {
    // Sair de draft é decisão do onboarding consultivo, não do formulário.
    expect(() =>
      regulatoryIdentitySchema.parse({ status: "active" }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Comportamento 2 da spec: campos regulatórios obrigatórios para sair de draft
// ---------------------------------------------------------------------------

describe("pendenciasRegulatorias", () => {
  const completa = {
    cnpj: "11.222.333/0001-81",
    technical_responsible_name: "Dra. Ana Lima",
    technical_responsible_council: "CRM",
    technical_responsible_registration_number: "12345-PE",
  }

  it("não aponta pendência quando está tudo preenchido", () => {
    expect(pendenciasRegulatorias(completa)).toEqual([])
  })

  it("aponta o CNPJ ausente", () => {
    expect(pendenciasRegulatorias({ ...completa, cnpj: null })).toEqual(["CNPJ"])
  })

  it("aponta cada campo do responsável técnico separadamente", () => {
    // Dizer só "perfil incompleto" obrigaria a clínica a adivinhar o quê.
    const faltando = pendenciasRegulatorias({
      cnpj: null,
      technical_responsible_name: null,
      technical_responsible_council: null,
      technical_responsible_registration_number: null,
    })

    expect(faltando).toHaveLength(4)
    expect(faltando).toContain("CNPJ")
    expect(faltando.some((f) => f.includes("Nome"))).toBe(true)
    expect(faltando.some((f) => f.includes("Conselho"))).toBe(true)
    expect(faltando.some((f) => f.includes("Número"))).toBe(true)
  })

  it("alvará sanitário não é pendência: a spec o marca como opcional", () => {
    expect(pendenciasRegulatorias(completa)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Convênios e equipe
// ---------------------------------------------------------------------------

describe("convênio", () => {
  it("nasce ativo quando não se diz o contrário", () => {
    expect(insuranceSchema.parse({ name: "Unimed" }).active).toBe(true)
  })

  it("recusa nome vazio", () => {
    expect(() => insuranceSchema.parse({ name: "   " })).toThrow()
  })
})

describe("profissional", () => {
  it("aceita o cadastro completo, com convênios próprios", () => {
    const uuid = "11111111-1111-4111-8111-111111111111"
    const r = professionalSchema.parse({
      name: "Dr. Bruno Souza",
      specialty: "Ortodontia",
      council: "CRO",
      registration_number: "999-PE",
      photo_url: "https://cdn.exemplo.test/bruno.jpg",
      google_calendar_id: "bruno@grupo.calendar.google.com",
      insurance_ids: [uuid],
    })

    expect(r.council).toBe("CRO")
    expect(r.insurance_ids).toEqual([uuid])
  })

  it("aceita conselho diferente do responsável técnico da clínica", () => {
    // Edge case da spec: clínica multi-especialidade tem CRM, CRO e
    // CREFITO na mesma equipe. O conselho é do profissional.
    for (const council of ["CRM", "CRO", "CREFITO", "CRP"] as const) {
      const r = professionalSchema.parse({
        name: "Profissional",
        council,
        registration_number: "1",
      })
      expect(r.council).toBe(council)
    }
  })

  it("aceita profissional sem conselho nenhum", () => {
    // Recepção e apoio entram na equipe sem registro de classe.
    const r = professionalSchema.parse({ name: "Carla Recepção" })
    expect(r.council).toBeNull()
    expect(r.registration_number).toBeNull()
  })

  it("exige o par conselho + registro também aqui", () => {
    expect(() =>
      professionalSchema.parse({ name: "X", council: "CRO" }),
    ).toThrow()
    expect(() =>
      professionalSchema.parse({ name: "X", registration_number: "1" }),
    ).toThrow()
  })

  it("recusa foto fora de https", () => {
    // Foto de pessoa identificável é PII; http a expõe em texto claro.
    expect(() =>
      professionalSchema.parse({
        name: "X",
        photo_url: "http://exemplo.test/f.jpg",
      }),
    ).toThrow()
  })

  it("trata foto em branco como ausente, não como url inválida", () => {
    const r = professionalSchema.parse({ name: "X", photo_url: "" })
    expect(r.photo_url).toBeNull()
  })

  it("começa sem convênio quando nenhum é marcado", () => {
    expect(professionalSchema.parse({ name: "X" }).insurance_ids).toEqual([])
  })

  it("recusa id de convênio que não é uuid", () => {
    expect(() =>
      professionalSchema.parse({ name: "X", insurance_ids: ["nao-é-uuid"] }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 2: a duração do procedimento chega ao motor de agendamento
// ---------------------------------------------------------------------------

describe("parsePreco", () => {
  it("entende o preço como o brasileiro digita", () => {
    expect(parsePreco("180,00")).toBe(180)
    expect(parsePreco("1.180,50")).toBe(1180.5)
    expect(parsePreco("180")).toBe(180)
    expect(parsePreco("R$ 250,90")).toBe(250.9)
    expect(parsePreco(" 99,99 ")).toBe(99.99)
  })

  it("entende milhar sem decimal", () => {
    expect(parsePreco("1.200")).toBe(1200)
  })

  it("devolve null para vazio", () => {
    // Null é "não divulgado", que é diferente de grátis.
    expect(parsePreco("")).toBeNull()
    expect(parsePreco("   ")).toBeNull()
  })

  it("devolve null em vez de NaN para texto", () => {
    // NaN viraria null silenciosamente no banco: "não divulgado" no lugar
    // do preço que a clínica quis publicar.
    expect(parsePreco("abc")).toBeNull()
  })

  it("recusa preço negativo", () => {
    expect(parsePreco("-50")).toBeNull()
  })

  it("arredonda para centavos", () => {
    expect(parsePreco("10,999")).toBe(11)
  })
})

describe("procedimento", () => {
  it("exige duração: é o que monta o bloco na agenda", () => {
    expect(() => procedureSchema.parse({ name: "Consulta" })).toThrow()
  })

  it("converte a duração vinda do formulário, que chega como texto", () => {
    const r = procedureSchema.parse({ name: "Consulta", duration_minutes: "45" })
    expect(r.duration_minutes).toBe(45)
  })

  it("recusa duração zero, negativa ou acima de 24h", () => {
    for (const d of [0, -30, 1441]) {
      expect(() =>
        procedureSchema.parse({ name: "X", duration_minutes: d }),
      ).toThrow()
    }
  })

  it("recusa duração fracionada", () => {
    expect(() =>
      procedureSchema.parse({ name: "X", duration_minutes: 30.5 }),
    ).toThrow()
  })

  it("aceita procedimento sem preço", () => {
    const r = procedureSchema.parse({ name: "Consulta", duration_minutes: 30 })
    expect(r.price).toBeNull()
  })

  it("normaliza o preço digitado com vírgula", () => {
    const r = procedureSchema.parse({
      name: "Consulta",
      duration_minutes: 30,
      price: "180,00",
    })
    expect(r.price).toBe(180)
  })
})

// ---------------------------------------------------------------------------
// Política de agendamento
// ---------------------------------------------------------------------------

describe("política de agendamento", () => {
  const valida = {
    default_slot_duration_minutes: 30,
    min_advance_hours: 2,
    min_cancellation_hours: 24,
    no_show_policy: "fee",
  }

  it("aceita a política preenchida", () => {
    expect(schedulingPolicySchema.parse(valida).no_show_policy).toBe("fee")
  })

  it("aceita zero hora de antecedência: agendamento para agora", () => {
    const r = schedulingPolicySchema.parse({ ...valida, min_advance_hours: 0 })
    expect(r.min_advance_hours).toBe(0)
  })

  it("recusa antecedência negativa", () => {
    expect(() =>
      schedulingPolicySchema.parse({ ...valida, min_advance_hours: -1 }),
    ).toThrow()
  })

  it("recusa política de falta que não existe", () => {
    expect(() =>
      schedulingPolicySchema.parse({ ...valida, no_show_policy: "banir" }),
    ).toThrow()
  })

  it("aceita as três políticas de falta da spec", () => {
    for (const p of ["fee", "block_rebooking", "none"]) {
      expect(
        schedulingPolicySchema.parse({ ...valida, no_show_policy: p })
          .no_show_policy,
      ).toBe(p)
    }
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 3: regra de urgência não fica ativa sem confirmação
// ---------------------------------------------------------------------------

describe("normalizarTermo", () => {
  it("iguala grafias do mesmo termo", () => {
    // O paciente escreve como consegue, e a regra não pode falhar por
    // causa de acento ou maiúscula.
    const esperado = "dor no peito"
    expect(normalizarTermo("Dor No Peito")).toBe(esperado)
    expect(normalizarTermo("DOR NO PEITO")).toBe(esperado)
    expect(normalizarTermo("dôr no peito")).toBe("dor no peito")
    expect(normalizarTermo("  dor   no   peito  ")).toBe(esperado)
  })
})

describe("parseKeywords", () => {
  it("aceita uma por linha", () => {
    expect(parseKeywords("dor no peito\nsangramento\nfalta de ar")).toEqual([
      "dor no peito",
      "sangramento",
      "falta de ar",
    ])
  })

  it("aceita separadas por vírgula", () => {
    expect(parseKeywords("dor no peito, sangramento")).toEqual([
      "dor no peito",
      "sangramento",
    ])
  })

  it("descarta entrada vazia", () => {
    // Palavra vazia casaria com QUALQUER mensagem e faria toda conversa
    // escalar como urgência.
    expect(parseKeywords("dor,,\n\n  ,sangramento")).toEqual([
      "dor",
      "sangramento",
    ])
  })

  it("descarta duplicata mesmo com grafia diferente", () => {
    expect(parseKeywords("Dor no peito\ndor no peito\nDOR NO PEITO")).toEqual([
      "Dor no peito",
    ])
  })

  it("devolve lista vazia para texto sem termo nenhum", () => {
    expect(parseKeywords("   \n , ; ")).toEqual([])
  })
})

describe("urgencyRuleSchema", () => {
  it("aceita a regra completa", () => {
    const r = urgencyRuleSchema.parse({
      label: "Dor torácica",
      keywords: "dor no peito\naperto no peito",
      protocol_message: "Procure o pronto-socorro mais próximo agora.",
    })

    expect(r.keywords).toEqual(["dor no peito", "aperto no peito"])
  })

  it("recusa regra sem palavra-chave nenhuma", () => {
    expect(() =>
      urgencyRuleSchema.parse({
        label: "X",
        keywords: "   ",
        protocol_message: "texto",
      }),
    ).toThrow()
  })

  it("recusa protocolo vazio", () => {
    // Regra que escala sem dizer nada ao paciente é pior que regra nenhuma.
    expect(() =>
      urgencyRuleSchema.parse({
        label: "X",
        keywords: "dor",
        protocol_message: "   ",
      }),
    ).toThrow()
  })

  it("não aceita `active` vindo do formulário", () => {
    // Ativar é ação própria, com confirmação registrada — nunca um campo
    // que viaja junto com a edição do texto.
    expect(() =>
      urgencyRuleSchema.parse({
        label: "X",
        keywords: "dor",
        protocol_message: "texto",
        active: true,
      }),
    ).toThrow()
  })

  it("não aceita a trilha de confirmação vinda do formulário", () => {
    expect(() =>
      urgencyRuleSchema.parse({
        label: "X",
        keywords: "dor",
        protocol_message: "texto",
        confirmed_at: new Date().toISOString(),
      }),
    ).toThrow()
  })
})

describe("detectarUrgencia", () => {
  const base = {
    id: "r1",
    clinic_id: "c1",
    label: "Dor torácica",
    keywords: ["dor no peito", "falta de ar"],
    protocol_message: "Procure o pronto-socorro.",
    confirmed_by: "u1",
    confirmed_at: "2026-09-16T12:00:00Z",
    created_at: "2026-09-16T12:00:00Z",
  }

  const ativa: UrgencyRule = { ...base, active: true }
  const inativa: UrgencyRule = {
    ...base,
    active: false,
    confirmed_by: null,
    confirmed_at: null,
  }

  it("dispara quando o termo aparece na frase", () => {
    // O paciente escreve a frase inteira, não a palavra-chave isolada.
    expect(
      detectarUrgencia("estou com uma dor no peito muito forte", [ativa]),
    ).toBe(ativa)
  })

  it("dispara ignorando acento e maiúscula", () => {
    expect(detectarUrgencia("DÔR NO PEITO desde ontem", [ativa])).toBe(ativa)
  })

  it("não dispara para mensagem comum", () => {
    expect(detectarUrgencia("quero marcar uma limpeza", [ativa])).toBeNull()
  })

  it("NÃO dispara regra inativa, mesmo com o termo exato", () => {
    // O coração do critério de aceite 3: regra sem confirmação da clínica
    // não escala nada, por mais que o texto case.
    expect(detectarUrgencia("dor no peito", [inativa])).toBeNull()
  })

  it("ignora a inativa e encontra a ativa na mesma lista", () => {
    // Contraprova: o teste acima passaria se a função nunca disparasse.
    expect(detectarUrgencia("dor no peito", [inativa, ativa])).toBe(ativa)
  })

  it("não dispara com lista de regras vazia", () => {
    expect(detectarUrgencia("dor no peito", [])).toBeNull()
  })

  it("não dispara para mensagem vazia", () => {
    expect(detectarUrgencia("   ", [ativa])).toBeNull()
  })
})

describe("hashDoConteudo", () => {
  it("é estável para o mesmo conteúdo", () => {
    const a = hashDoConteudo("Procure o PS.", ["dor", "sangramento"])
    const b = hashDoConteudo("Procure o PS.", ["dor", "sangramento"])
    expect(a).toBe(b)
  })

  it("muda quando o texto do protocolo muda", () => {
    // É isto que impede confirmar um texto e trocá-lo depois mantendo a
    // regra no ar.
    const antes = hashDoConteudo("Procure o PS.", ["dor"])
    const depois = hashDoConteudo("Tome um analgésico.", ["dor"])
    expect(depois).not.toBe(antes)
  })

  it("muda quando uma palavra-chave é acrescentada", () => {
    // Acrescentar keyword muda o alcance da regra tanto quanto reescrever
    // o texto: as duas coisas precisam de nova confirmação.
    const antes = hashDoConteudo("Procure o PS.", ["dor"])
    const depois = hashDoConteudo("Procure o PS.", ["dor", "sangramento"])
    expect(depois).not.toBe(antes)
  })

  it("distingue listas que a concatenação ingênua confundiria", () => {
    // Com separador comum, ["a,b"] e ["a","b"] colidiriam — e uma edição
    // real passaria por "texto inalterado".
    expect(hashDoConteudo("t", ["a,b"])).not.toBe(hashDoConteudo("t", ["a", "b"]))
  })

  it("distingue mover conteúdo entre texto e keywords", () => {
    expect(hashDoConteudo("ab", [])).not.toBe(hashDoConteudo("a", ["b"]))
  })
})

// ---------------------------------------------------------------------------
// Consentimento e retenção
// ---------------------------------------------------------------------------

describe("termo de consentimento", () => {
  it("aceita texto com prazo próprio", () => {
    const r = consentTextSchema.parse({
      body: "A clínica trata seus dados de saúde para...",
      retention_years: 20,
    })
    expect(r.retention_years).toBe(20)
  })

  it("aceita texto sem prazo definido", () => {
    const r = consentTextSchema.parse({ body: "Termo." })
    expect(r.retention_years).toBeNull()
  })

  it("trata campo de prazo em branco como não informado", () => {
    const r = consentTextSchema.parse({ body: "Termo.", retention_years: "" })
    expect(r.retention_years).toBeNull()
  })

  it("converte o prazo que chega como texto do formulário", () => {
    const r = consentTextSchema.parse({ body: "Termo.", retention_years: "20" })
    expect(r.retention_years).toBe(20)
  })

  it("recusa corpo vazio", () => {
    expect(() => consentTextSchema.parse({ body: "   " })).toThrow()
  })

  it("recusa prazo escrito por extenso em vez de tratá-lo como ausente", () => {
    // "vinte" virando null seria pior que um erro: a clínica acharia que
    // definiu 20 anos, e o sistema aplicaria o default.
    expect(() =>
      consentTextSchema.parse({ body: "Termo.", retention_years: "vinte" }),
    ).toThrow()
  })

  it("recusa prazo fora da faixa ou fracionado", () => {
    for (const anos of [0, -5, 101, 2.5]) {
      expect(() =>
        consentTextSchema.parse({ body: "Termo.", retention_years: anos }),
      ).toThrow()
    }
  })

  it("não aceita `version` vinda do formulário", () => {
    // Quem move a versão é o trigger. Aceitá-la aqui permitiria publicar
    // texto novo sob a versão antiga, e o aceite do paciente deixaria de
    // dizer com o que ele concordou.
    expect(() =>
      consentTextSchema.parse({ body: "Termo.", version: 1 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Edge case da spec: o prazo da clínica prevalece sobre o default genérico
// ---------------------------------------------------------------------------

describe("prazoDeRetencao", () => {
  it("usa o prazo da clínica quando ela definiu um", () => {
    // O CFM exige 20 anos para prontuário médico. Se o produto aplicasse
    // o default, apagaria prontuário antes do prazo do conselho.
    expect(prazoDeRetencao({ retention_years: 20 })).toBe(20)
  })

  it("prefere o prazo da clínica mesmo quando é menor que o default", () => {
    // Prevalece nos dois sentidos: a regra é "o da clínica manda", não
    // "o maior dos dois".
    expect(prazoDeRetencao({ retention_years: 2 })).toBe(2)
  })

  it("cai no default quando a clínica não definiu", () => {
    expect(prazoDeRetencao({ retention_years: null })).toBe(RETENCAO_PADRAO_ANOS)
  })

  it("cai no default quando não há termo cadastrado", () => {
    expect(prazoDeRetencao(null)).toBe(RETENCAO_PADRAO_ANOS)
  })
})
