import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { SinaisDaIntegracao } from "@/lib/integrations/estado"
import { resumoDasIntegracoes } from "./estado"
import { TelaDeIntegracoes } from "./tela-de-integracoes"
import type { IntegracaoDeCrm, PainelDeIntegracoes } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const PROTOTIPO = "Protótipo: a ação ainda não existe"

const NUNCA: SinaisDaIntegracao = {
  conectadaEm: null,
  ultimaSincronizacao: null,
  ultimaFalha: null,
  autorizacaoExpiraEm: null,
}
const naoConectado = (provedor: IntegracaoDeCrm["provedor"]): IntegracaoDeCrm => ({
  provedor,
  sinais: NUNCA,
  registros30d: null,
  credencialSalvaEm: null,
})

const PAINEL: PainelDeIntegracoes = {
  whatsapp: [
    { agenteId: "a1", agente: "Recepção", numero: "+5581991230001", conexao: "conectado", desde: "2026-09-01T17:02:00-03:00" },
    { agenteId: "a2", agente: "Implantes", numero: "+5581991230003", conexao: "desconectado-pela-meta", desde: "2026-09-28T12:31:00-03:00" },
    { agenteId: "a3", agente: "Ortodontia", numero: null, conexao: "sem-numero", desde: null },
  ],
  agenda: {
    conta: "agenda@clinica.com.br",
    sinais: {
      conectadaEm: "2026-09-01T10:00:00-03:00",
      ultimaSincronizacao: "2026-09-28T14:20:00-03:00",
      ultimaFalha: null,
      autorizacaoExpiraEm: "2026-10-03T14:32:00-03:00",
    },
    calendarios: [
      { profissional: "Dra. Ana Lima", calendario: "Consultório 1" },
      { profissional: "Dr. Bruno Reis", calendario: "Implantes" },
    ],
  },
  crms: [
    naoConectado("pipedrive"),
    {
      provedor: "kommo",
      sinais: {
        conectadaEm: "2026-09-05T10:00:00-03:00",
        ultimaSincronizacao: "2026-09-28T13:00:00-03:00",
        ultimaFalha: { em: "2026-09-28T14:05:00-03:00", motivo: "a chave foi recusada." },
        autorizacaoExpiraEm: null,
      },
      registros30d: 312,
      credencialSalvaEm: "2026-09-05T10:00:00-03:00",
    },
    naoConectado("rd-station"),
  ],
}

const tela = (p: PainelDeIntegracoes = PAINEL) =>
  renderToStaticMarkup(<TelaDeIntegracoes painel={p} agora={AGORA} acaoDesabilitada={PROTOTIPO} />)

/** Trecho do HTML entre a âncora `id` e a próxima seção. */
const secao = (html: string, id: string) => html.slice(html.indexOf(`id="${id}"`)).split("</section>")[0]

describe("resumoDasIntegracoes", () => {
  it("põe o erro antes da atenção e deixa de fora o que nunca foi conectado", () => {
    const r = resumoDasIntegracoes(PAINEL, AGORA)
    expect(r.map((i) => [i.nome, i.estado])).toEqual([
      ["WhatsApp de Implantes", "erro"],
      ["Kommo", "erro"],
      ["Google Calendar", "atencao"],
      ["WhatsApp de Recepção", "conectada"],
    ])
  })
})

describe("TelaDeIntegracoes", () => {
  it("resume quantas pedem atenção e quantas estão bem, problema primeiro", () => {
    const html = tela()
    expect(html).toContain("3 pedem atenção")
    expect(html).toContain("1 conectada")
    expect(html.indexOf("3 pedem atenção")).toBeLessThan(html.indexOf("1 conectada"))
    expect(html).toContain('href="#whatsapp-a2"')
  })

  it("sem problema, diz que está tudo funcionando", () => {
    const html = tela({ ...PAINEL, whatsapp: [PAINEL.whatsapp[0]], agenda: { ...PAINEL.agenda, sinais: { ...PAINEL.agenda.sinais, autorizacaoExpiraEm: null } }, crms: [] })
    expect(html).toContain("Tudo funcionando")
  })

  it("WhatsApp: o desconectado explica o que houve e manda reconectar no editor, sem campo de token", () => {
    const html = secao(tela(), "whatsapp-titulo")
    expect(html).toContain("Desconectado pela Meta")
    expect(html).toContain("trocou de celular")
    expect(html).toContain("Reconecte no editor do agente")
    expect(html).toContain("(81) 99123-0001")
    expect(html).toContain("Sem número")
    expect(html).not.toContain("<input")
  })

  it("Agenda: mostra o vencimento próximo e os calendários por profissional", () => {
    const html = secao(tela(), "agenda-titulo")
    expect(html).toContain("vence em 5 dias")
    expect(html).toContain("agenda@clinica.com.br")
    expect(html).toContain("Dr. Bruno Reis")
    expect(html).toContain("Implantes")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Renovar autorização/)
  })

  it("CRM: o conectado com falha mostra o erro e o motivo; o não conectado oferece Conectar, desabilitado", () => {
    const html = secao(tela(), "crm-titulo")
    expect(html).toContain("Com erro")
    expect(html).toContain("A última sincronização falhou: a chave foi recusada.")
    expect(html).toContain("312 registros em 30 dias")
    expect(html).toMatch(/<button[^>]*disabled[^>]*title="Protótipo: a ação ainda não existe"[^>]*>(?:(?!<\/button>).)*Conectar</)
  })

  it("nenhuma credencial aparece: só a data em que a chave foi salva", () => {
    const html = tela()
    expect(html).toContain("Chave salva em 05/09/2026")
    expect(html).not.toContain("<input")
    expect(html).not.toMatch(/value="/)
    expect(html).toContain("não aparecem de novo depois de salvos")
  })
})
