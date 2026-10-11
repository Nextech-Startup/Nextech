import { describe, expect, it } from "vitest"
import { chaveDoNumero, interpretarEvolution, PREFIXO_DO_CANAL, PREFIXO_DO_ID } from "./evolution-webhook"

/**
 * Payloads no formato do `messages.upsert` da Evolution v2.3.7 (notas da
 * tarefa 1 do plano): o envelope do webhook e o `messageRaw` do Baileys,
 * já com o `extendedTextMessage` convertido em `conversation`.
 */

const PACIENTE = "5511987654321"
const cfg = { instancia: "nextech-demo", permitidos: new Set([`+${PACIENTE}`]) }

function payload(data: Record<string, unknown> = {}, envelope: Record<string, unknown> = {}) {
  return {
    event: "messages.upsert",
    instance: "nextech-demo",
    destination: "http://host.docker.internal:3000/api/whatsapp/evolution",
    date_time: "2026-10-11T15:00:00.000Z",
    sender: "5511900000000@s.whatsapp.net",
    server_url: "http://localhost:8080",
    apikey: null,
    data: {
      key: { remoteJid: `${PACIENTE}@s.whatsapp.net`, fromMe: false, id: "3EB0A1B2C3D4E5F6" },
      pushName: "Maria Exemplo",
      status: "DELIVERY_ACK",
      message: { conversation: "Oi, quero marcar uma consulta" },
      messageType: "conversation",
      messageTimestamp: 1791730800,
      instanceId: "6f1c0e2a-0000-4000-8000-000000000000",
      source: "android",
      ...data,
    },
    ...envelope,
  }
}

function chave(parcial: Record<string, unknown>) {
  return { key: { remoteJid: `${PACIENTE}@s.whatsapp.net`, fromMe: false, id: "3EB0A1B2C3D4E5F6", ...parcial } }
}

describe("interpretarEvolution: mensagem", () => {
  it("texto simples vira a mensagem da recepção, com os prefixos", () => {
    expect(interpretarEvolution(payload(), cfg)).toEqual({
      tipo: "mensagem",
      mensagem: {
        tipo: "mensagem",
        autor: "patient",
        wabaId: `${PREFIXO_DO_CANAL}nextech-demo`,
        phoneNumberId: `${PREFIXO_DO_CANAL}nextech-demo`,
        waMessageId: `${PREFIXO_DO_ID}3EB0A1B2C3D4E5F6`,
        waIdDoPaciente: PACIENTE,
        nomeDoPerfil: "Maria Exemplo",
        ocorridaEm: new Date(1791730800 * 1000).toISOString(),
        midia: "text",
        texto: "Oi, quero marcar uma consulta",
      },
    })
  })

  it("os prefixos são os do canal", () => {
    expect(PREFIXO_DO_CANAL).toBe("evolution:")
    expect(PREFIXO_DO_ID).toBe("evo:")
  })

  it("texto estendido também vale (a Evolution costuma converter, mas não depende disso)", () => {
    const r = interpretarEvolution(
      payload({ message: { extendedTextMessage: { text: "Link: https://exemplo.test" } }, messageType: "extendedTextMessage" }),
      cfg,
    )
    expect(r).toMatchObject({ tipo: "mensagem", mensagem: { midia: "text", texto: "Link: https://exemplo.test" } })
  })

  it("fromMe vira human (o eco do celular do chip), sem nome de perfil", () => {
    const r = interpretarEvolution(payload({ ...chave({ fromMe: true }), pushName: "Você" }), cfg)
    expect(r).toMatchObject({ tipo: "mensagem", mensagem: { autor: "human", nomeDoPerfil: null, waIdDoPaciente: PACIENTE } })
  })

  it("áudio vira mídia de áudio, sem texto", () => {
    const r = interpretarEvolution(
      payload({ message: { audioMessage: { seconds: 4, ptt: true, mimetype: "audio/ogg; codecs=opus" } }, messageType: "audioMessage" }),
      cfg,
    )
    expect(r).toMatchObject({ tipo: "mensagem", mensagem: { midia: "audio", texto: null } })
  })

  it("imagem e documento levam a legenda como texto", () => {
    const imagem = interpretarEvolution(
      payload({ message: { imageMessage: { caption: "minha receita" } }, messageType: "imageMessage" }),
      cfg,
    )
    expect(imagem).toMatchObject({ mensagem: { midia: "image", texto: "minha receita" } })

    const documento = interpretarEvolution(
      payload({ message: { documentMessage: { fileName: "exame.pdf" } }, messageType: "documentMessage" }),
      cfg,
    )
    expect(documento).toMatchObject({ mensagem: { midia: "document", texto: null } })
  })

  it("vídeo, figurinha e localização ficam como other, sem conteúdo", () => {
    for (const message of [{ videoMessage: {} }, { stickerMessage: {} }, { locationMessage: { degreesLatitude: -23.5 } }]) {
      expect(interpretarEvolution(payload({ message }), cfg)).toMatchObject({
        tipo: "mensagem",
        mensagem: { midia: "other", texto: null },
      })
    }
  })

  it("texto só com espaços não vira texto", () => {
    const r = interpretarEvolution(payload({ message: { conversation: "   " } }), cfg)
    expect(r).toMatchObject({ mensagem: { midia: "other", texto: null } })
  })

  it("@lid usa o remoteJidAlt, que é o jid do telefone", () => {
    const r = interpretarEvolution(
      payload(chave({ remoteJid: "123456789012345@lid", remoteJidAlt: `${PACIENTE}@s.whatsapp.net` })),
      cfg,
    )
    expect(r).toMatchObject({ tipo: "mensagem", mensagem: { waIdDoPaciente: PACIENTE } })
  })

  it("o evento em maiúsculas, como na configuração, também vale", () => {
    expect(interpretarEvolution(payload({}, { event: "MESSAGES_UPSERT" }), cfg)).toMatchObject({ tipo: "mensagem" })
  })
})

describe("interpretarEvolution: ignoradas", () => {
  it("grupo, status e lista de transmissão", () => {
    for (const remoteJid of ["120363000000000000@g.us", "status@broadcast", "1700000000@broadcast", "120363000000@newsletter"]) {
      expect(interpretarEvolution(payload(chave({ remoteJid })), cfg)).toEqual({ tipo: "ignorada", motivo: "grupo" })
    }
  })

  it("outra instância", () => {
    expect(interpretarEvolution(payload({}, { instance: "outra" }), cfg)).toEqual({ tipo: "ignorada", motivo: "instancia" })
  })

  it("outro evento", () => {
    for (const event of ["messages.update", "send.message", "connection.update", "qrcode.updated", undefined]) {
      expect(interpretarEvolution(payload({}, { event }), cfg)).toEqual({ tipo: "ignorada", motivo: "evento" })
    }
  })

  it("JSON fora do formato", () => {
    const fora = [
      null,
      "texto",
      [],
      { event: "messages.upsert", instance: "nextech-demo" },
      payload({ key: null }),
      payload(chave({ id: "" })),
      payload(chave({ fromMe: "não" })),
      payload(chave({ remoteJid: "sem-arroba" })),
      payload(chave({ remoteJid: "abc@s.whatsapp.net" })),
      payload(chave({ remoteJid: "123456789012345@lid" })),
      payload({ messageTimestamp: "ontem" }),
      payload({ messageTimestamp: -1 }),
      payload({ message: null }),
      { ...payload(), data: [payload().data] },
    ]
    for (const p of fora) expect(interpretarEvolution(p, cfg)).toEqual({ tipo: "ignorada", motivo: "formato" })
  })

  it("reação, edição e mensagem de protocolo não têm o que responder", () => {
    for (const message of [
      { reactionMessage: { text: "👍" } },
      { protocolMessage: { type: 0 } },
      { editedMessage: { message: { conversation: "corrigido" } } },
      { pollUpdateMessage: {} },
    ]) {
      expect(interpretarEvolution(payload({ message }), cfg)).toEqual({ tipo: "ignorada", motivo: "sem-conteudo" })
    }
  })

  it("número fora da lista é ignorado, também com fromMe", () => {
    const fora = chave({ remoteJid: "5511911112222@s.whatsapp.net" })
    expect(interpretarEvolution(payload(fora), cfg)).toEqual({ tipo: "ignorada", motivo: "nao-permitido" })
    expect(interpretarEvolution(payload({ key: { ...fora.key, fromMe: true } }), cfg)).toEqual({
      tipo: "ignorada",
      motivo: "nao-permitido",
    })
  })

  it("lista vazia não deixa ninguém passar", () => {
    expect(interpretarEvolution(payload(), { ...cfg, permitidos: new Set() })).toEqual({
      tipo: "ignorada",
      motivo: "nao-permitido",
    })
  })

  it("o motivo nunca leva o número", () => {
    const r = interpretarEvolution(payload(chave({ remoteJid: "5511911112222@s.whatsapp.net" })), cfg)
    expect(JSON.stringify(r)).not.toContain("5511911112222")
  })
})

describe("lista de permitidos e o nono dígito", () => {
  it("o número da lista com 9 casa com o jid de 12 dígitos (DDD 31 ou maior)", () => {
    const permitidos = new Set(["+5531987654321"])
    const r = interpretarEvolution(payload(chave({ remoteJid: "553187654321@s.whatsapp.net" })), { ...cfg, permitidos })
    expect(r).toMatchObject({ tipo: "mensagem", mensagem: { waIdDoPaciente: "553187654321" } })
  })

  it("o número da lista sem 9 casa com o jid de 13 dígitos", () => {
    const permitidos = new Set(["+553187654321"])
    const r = interpretarEvolution(payload(chave({ remoteJid: "5531987654321@s.whatsapp.net" })), { ...cfg, permitidos })
    expect(r).toMatchObject({ tipo: "mensagem" })
  })

  it("chaveDoNumero tira só o nono dígito do celular brasileiro", () => {
    expect(chaveDoNumero("+5531987654321")).toBe("553187654321")
    expect(chaveDoNumero("553187654321")).toBe("553187654321")
    expect(chaveDoNumero("+55 (11) 98765-4321")).toBe("551187654321")
    // Fixo brasileiro e número de fora ficam como estão.
    expect(chaveDoNumero("+551133334444")).toBe("551133334444")
    expect(chaveDoNumero("+14155550100")).toBe("14155550100")
  })

  it("número diferente não casa só por ter o mesmo final", () => {
    const permitidos = new Set(["+5521987654321"])
    expect(interpretarEvolution(payload(chave({ remoteJid: "5531987654321@s.whatsapp.net" })), { ...cfg, permitidos })).toEqual({
      tipo: "ignorada",
      motivo: "nao-permitido",
    })
  })
})
