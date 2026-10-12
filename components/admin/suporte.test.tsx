import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { acessoVigente } from "@/lib/admin/acesso-de-suporte"
import { ClinicasParaSuporte, TelaDeAcessoDeSuporte } from "./tela-de-suporte"
import type { ConversaDeSuporte, ResumoDeSuporte } from "./tipos"

// O HTML estático não mostra o prefetch: o Link de mentira o escreve num atributo.
vi.mock("next/link", () => ({
  default: ({ prefetch, href, ...resto }: { prefetch?: boolean; href: string } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...resto} />
  ),
}))

const AGORA = "2026-09-28T14:32:00-03:00"
const PROTOTIPO = "Protótipo: a ação ainda não existe"

const SORRISO: ResumoDeSuporte = { id: "cl-1", nome: "Clínica Sorriso", plano: "healthtech", abertas: 12, aguardando: 2, comFalha: 1, urgentes: 0 }
const OUTRA: ResumoDeSuporte = { id: "cl-2", nome: "Outra Clínica", plano: "pro", abertas: 4, aguardando: 0, comFalha: 0, urgentes: 0 }

const CONVERSAS: ConversaDeSuporte[] = [
  { id: "conv-1", paciente: "Juliana Prado", agente: "Recepção", estado: "ia", ultimaAtividade: "2026-09-28T14:29:00-03:00" },
  { id: "conv-2", paciente: "Rafael Lima", agente: "Estética", estado: "falha", ultimaAtividade: "2026-09-28T12:10:00-03:00" },
]

const ACESSO = acessoVigente(
  [{ clinicaId: "cl-1", concedidoEm: "2026-09-28T14:20:00-03:00", justificativa: { motivo: "ia-nao-respondeu", chamado: "4821" } }],
  "cl-1",
  AGORA,
)

const acesso = (comAcesso: boolean) =>
  renderToStaticMarkup(
    <TelaDeAcessoDeSuporte
      clinica={SORRISO}
      acesso={comAcesso ? ACESSO : null}
      conversas={CONVERSAS}
      hrefDaLista="/suporte"
      agora={AGORA}
      acaoDesabilitada={PROTOTIPO}
    />,
  )

const botao = (html: string, rotulo: string) =>
  html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}(?:(?!</button>).)*</button>`))?.[0] ?? ""

describe("ClinicasParaSuporte", () => {
  it("mostra só números por clínica, com a que tem falha no topo", () => {
    const html = renderToStaticMarkup(
      <ClinicasParaSuporte clinicas={[OUTRA, SORRISO]} hrefDaClinica={(id) => `/suporte/${id}`} />,
    )
    expect(html).toContain("12 abertas")
    expect(html).toContain("2 aguardando")
    expect(html).toContain("1 com falha")
    expect(html).toContain('href="/suporte/cl-1"')
    expect(html.indexOf("Clínica Sorriso")).toBeLessThan(html.indexOf("Outra Clínica"))
  })
})

describe("TelaDeAcessoDeSuporte sem acesso", () => {
  it("pede o motivo da lista e o número do chamado, sem texto livre", () => {
    const html = acesso(false)
    for (const motivo of ["A IA não respondeu", "A IA respondeu errado", "A mensagem não chegou ao paciente", "Pedido da clínica", "Outro motivo"]) {
      expect(html).toContain(motivo)
    }
    expect(html).toContain("Número do chamado")
    expect(html).not.toContain("<textarea")
    expect(html).toContain("cada conversa aberta ficam registrados na auditoria")
  })

  it("o botão fica desabilitado no protótipo", () => {
    const b = botao(acesso(false), "Liberar acesso por 30 min")
    expect(b).toContain("disabled")
    expect(b).toContain(`title="${PROTOTIPO}"`)
  })

  it("nenhum nome de paciente chega ao HTML, mesmo com as conversas em mãos", () => {
    const html = acesso(false)
    expect(html).not.toContain("Juliana Prado")
    expect(html).not.toContain("Rafael Lima")
  })
})

describe("TelaDeAcessoDeSuporte com acesso", () => {
  it("diz até quando vale, o motivo e o chamado", () => {
    const html = acesso(true)
    expect(html).toContain("Acesso liberado até 14:50")
    expect(html).toContain("A IA não respondeu")
    expect(html).toContain("#4821")
    expect(botao(html, "Encerrar acesso")).toContain("disabled")
  })

  it("lista as conversas com a que falhou no topo", () => {
    const html = acesso(true)
    expect(html.indexOf("Rafael Lima")).toBeGreaterThan(-1)
    expect(html.indexOf("Rafael Lima")).toBeLessThan(html.indexOf("Juliana Prado"))
    expect(html).toContain("Falha da IA")
    expect(html).toContain("há 3 min")
  })

  it("abrir a conversa fica desabilitado e diz que vira registro na auditoria", () => {
    const b = botao(acesso(true), "Abrir conversa")
    expect(b).toContain("disabled")
    expect(b).toContain("registro na auditoria")
  })
})

describe("TelaDeAcessoDeSuporte real", () => {
  const liberar = async () => {}
  const URGENTE: ConversaDeSuporte = {
    id: "conv-3",
    paciente: "Paula Reis",
    agente: "Recepção",
    estado: "urgente",
    ultimaAtividade: "2026-09-28T10:00:00-03:00",
  }
  const real = (comAcesso: boolean, erro: string | null = null) =>
    renderToStaticMarkup(
      <TelaDeAcessoDeSuporte
        clinica={{ ...SORRISO, urgentes: 1 }}
        acesso={comAcesso ? ACESSO : null}
        conversas={[...CONVERSAS, URGENTE]}
        hrefDaLista="/admin/conversations"
        agora={AGORA}
        real={{ liberar, hrefDaConversa: (id) => `/admin/conversations/cl-1/${id}`, erro }}
      />,
    )

  it("o formulário envia para a ação e mostra o erro como alerta", () => {
    const html = real(false, "Informe o número do chamado, só com dígitos.")
    expect(html).toMatch(/<form[^>]*action=/)
    expect(html).toMatch(/role="alert"[^>]*>Informe o número do chamado/)
    expect(botao(html, "Liberar acesso por 30 min")).not.toContain('disabled=""')
  })

  it("abrir é link para a conversa, sem encerrar acesso", () => {
    const html = real(true)
    expect(html).toMatch(/href="\/admin\/conversations\/cl-1\/conv-1"[^>]*data-prefetch="false"/)
    expect(html).not.toContain("Encerrar acesso")
  })

  it("a urgente vem antes da falha e aparece na contagem", () => {
    const html = real(true)
    expect(html.indexOf("Paula Reis")).toBeLessThan(html.indexOf("Rafael Lima"))
    expect(html).toContain(">Urgente<")
    expect(html).toContain("1 urgente")
  })
})
