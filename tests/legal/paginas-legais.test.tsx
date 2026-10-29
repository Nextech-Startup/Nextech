import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import Privacidade, { metadata as metaPrivacidade } from "@/app/(marketing)/privacidade/page"
import Termos, { metadata as metaTermos } from "@/app/(marketing)/termos/page"
import Exclusao, { metadata as metaExclusao } from "@/app/(marketing)/exclusao-de-dados/page"
import { EMPRESA } from "@/components/legal/empresa"
import { SITE_URL } from "@/lib/site-url"

const privacidade = renderToStaticMarkup(<Privacidade />)
const termos = renderToStaticMarkup(<Termos />)
const exclusao = renderToStaticMarkup(<Exclusao />)

/** O texto visível, sem as tags. */
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

/** O código-fonte de `lib/` e `app/`, sem os testes. */
function codigoDoProduto(): string {
  return ["lib", "app"]
    .flatMap((raiz) =>
      readdirSync(raiz, { recursive: true, encoding: "utf8" })
        .map((f) => join(raiz, f))
        .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)),
    )
    .map((f) => readFileSync(f, "utf8"))
    .join("\n")
}

describe("as três páginas", () => {
  it.each([
    ["/privacidade", metaPrivacidade, privacidade],
    ["/termos", metaTermos, termos],
    ["/exclusao-de-dados", metaExclusao, exclusao],
  ])("%s tem título, descrição e canonical próprios, e um h1", (rota, meta, html) => {
    expect(meta.title).toBeTruthy()
    expect(meta.description).toBeTruthy()
    expect(meta.alternates?.canonical).toBe(rota)
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  it.each([
    ["privacidade", privacidade],
    ["termos", termos],
    ["exclusão", exclusao],
  ])("%s não tem placeholder e publica o e-mail do encarregado", (_, html) => {
    // Sem /i: "Todos os direitos reservados", do rodapé, não é TODO.
    expect(texto(html)).not.toMatch(/\[[^\]]*\]|\bXX\b|\bTODO\b|[Ll]orem|a definir/)
    expect(html).toContain(`mailto:${EMPRESA.email}`)
  })

  it("títulos e descrições são diferentes entre as três", () => {
    const metas = [metaPrivacidade, metaTermos, metaExclusao]
    expect(new Set(metas.map((m) => m.title)).size).toBe(3)
    expect(new Set(metas.map((m) => m.description)).size).toBe(3)
  })

  // O canonical relativo vira absoluto pelo metadataBase do layout raiz.
  it("o canonical resolve para o domínio público", () => {
    expect(new URL("/privacidade", SITE_URL).href).toBe(`${SITE_URL}/privacidade`)
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("metadataBase: new URL(SITE_URL)")
  })

  it("o logo do cabeçalho volta para a landing por URL absoluta", () => {
    const cabecalho = privacidade.slice(privacidade.indexOf("<header"), privacidade.indexOf("</header>"))
    const logo = cabecalho.match(/<a [^>]*>/)![0]
    expect(logo).toContain(`href="${SITE_URL}/"`)
    expect(logo).toContain("voltar ao início")
  })

  it("os títulos de seção são âncoras para a própria seção", () => {
    for (const [, id] of privacidade.matchAll(/<section id="([^"]+)"/g)) {
      expect(privacidade).toContain(`href="#${id}"`)
    }
  })
})

describe("/privacidade", () => {
  it("tem as seções #cookies e #seguranca, para onde o rodapé aponta", () => {
    expect(privacidade).toContain('id="cookies"')
    expect(privacidade).toContain('id="seguranca"')
  })

  it("identifica a empresa e o encarregado", () => {
    const t = texto(privacidade)
    expect(t).toContain(EMPRESA.nomeEmpresarial)
    expect(t).toContain(EMPRESA.cnpj)
    expect(t).toContain(EMPRESA.sede)
    expect(t).toContain(EMPRESA.encarregado)
  })

  it("leva aos direitos: exclusão de dados, prazo de 15 dias e ANPD", () => {
    expect(privacidade).toContain('href="/exclusao-de-dados"')
    expect(texto(privacidade)).toContain("15 dias")
    expect(texto(privacidade)).toContain("ANPD")
  })

  it("promete 12 meses para os leads, o mesmo prazo do job no banco", () => {
    expect(texto(privacidade)).toContain("até 12 meses")
    const migration = readFileSync("supabase/migrations/20261026120000_chatbot_leads_retention.sql", "utf8")
    expect(migration).toContain("interval '12 months'")
  })

  it("lista os fornecedores em uso", () => {
    const t = texto(privacidade)
    for (const nome of ["Supabase", "Vercel", "OpenRouter", "Google", "Meta", "Zoho"]) expect(t).toContain(nome)
  })

  // Fornecedor só aparece como em uso quando há código dele (critério 8).
  // Quando a integração entrar, este teste falha até a política mudar junto.
  it.each([
    ["Resend", /from ["']resend["']|api\.resend\.com/],
    ["Asaas", /asaas\.com/i],
    ["Google Calendar", /googleapis\.com\/calendar|from ["']googleapis["']/],
  ])("cita %s só se o código o usa", (nome, marca) => {
    expect(texto(privacidade).includes(nome)).toBe(marca.test(codigoDoProduto()))
  })

  it("a IA vai ao modelo sem retenção e sem treino, como o cliente pede ao OpenRouter", () => {
    expect(texto(privacidade)).toMatch(/não guarde esse conteúdo e não o use para treinar/)
    const cliente = readFileSync("lib/ai/client.ts", "utf8")
    expect(cliente).toContain('data_collection: "deny", zdr: true')
  })

  it("os cookies descritos são os que o código grava", () => {
    expect(texto(privacidade)).toMatch(/menu lateral/)
    expect(readFileSync("components/ui/sidebar.tsx", "utf8")).toContain('SIDEBAR_COOKIE_NAME = "sidebar_state"')
  })

  it("a IA volta depois que a equipe assume, no prazo que o motor usa", () => {
    const t = texto(privacidade)
    expect(t).not.toMatch(/para de responder/)
    expect(t).toMatch(/volta a responder quando a equipe devolve a conversa ou 24 horas depois/)
    expect(readFileSync("lib/conversations/decisao.ts", "utf8")).toContain("RETOMADA_DA_IA_MS = 24 * 60 * 60 * 1000")
  })

  it("a urgência vem das palavras-chave da clínica, não do assistente", () => {
    expect(texto(privacidade)).toMatch(/A urgência não é decidida pelo assistente/)
    expect(readFileSync("lib/conversations/urgencia.ts", "utf8")).toMatch(/detectarUrgencia\(p\.texto, await listActiveUrgencyRules/)
  })
})

describe("as três páginas não expõem detalhe técnico que ajude um ataque", () => {
  it.each([
    ["privacidade", privacidade],
    ["termos", termos],
    ["exclusão", exclusao],
  ])("%s", (_, html) => {
    expect(texto(html)).not.toMatch(/AES|GCM|us-west|Oregon|chatbot_leads|clinic_id|service_role|supabase\.co/i)
  })

  // O rodapé aparece nas páginas legais: o e-mail dele recebe pedido de titular.
  it("o único e-mail publicado é o do encarregado", () => {
    for (const html of [privacidade, termos, exclusao]) {
      expect(new Set([...html.matchAll(/mailto:([^"]+)/g)].map((m) => m[1]))).toEqual(new Set([EMPRESA.email]))
    }
  })
})

describe("/termos", () => {
  it("elege o foro de Recife/PE e não promete SLA", () => {
    const t = texto(termos)
    expect(t).toContain("comarca de Recife/PE")
    expect(t).toContain("não garantimos funcionamento ininterrupto")
  })

  it("diz que o assistente não diagnostica e não é canal de emergência", () => {
    expect(texto(termos)).toMatch(/não faz diagnóstico.*não é canal de emergência/)
  })

  it("remete à política de privacidade", () => {
    expect(termos).toContain('href="/privacidade"')
  })
})

describe("/exclusao-de-dados", () => {
  it("cobre os três titulares, com prazo e verificação de identidade", () => {
    for (const id of ["clinica", "paciente", "contato-do-site"]) expect(exclusao).toContain(`id="${id}"`)
    expect(texto(exclusao)).toContain("15 dias")
    expect(texto(exclusao)).toMatch(/verificação mínima/)
  })

  it("cita o Desconectar do painel, que existe e apaga número, conta e token", () => {
    expect(texto(exclusao)).toContain("Desconectar")
    expect(existsSync("app/(dashboard)/dashboard/agents/actions.ts")).toBe(true)
    expect(readFileSync("app/(dashboard)/dashboard/agents/actions.ts", "utf8")).toContain("desconectarWhatsappAction")
    const mutations = readFileSync("lib/agent-config/mutations.ts", "utf8")
    expect(mutations).toMatch(
      /disconnectWhatsapp[\s\S]*whatsapp_phone_number_id: null,\s*whatsapp_waba_id: null,\s*whatsapp_access_token_encrypted: null/,
    )
  })
})

/**
 * A tabela da seção 1 da spec: cada medida que a política afirma, com o
 * trecho de código que a sustenta. Se o código mudar, o teste aponta a frase
 * da política que deixou de ser verdade.
 */
describe("o que a seção de segurança afirma existe no código", () => {
  it.each([
    ["conteúdo das mensagens fica cifrado", "lib/conversations/conteudo.ts", 'NOME_DA_CHAVE = "MESSAGE_CONTENT_ENCRYPTION_KEY"'],
    ["credenciais que a clínica conecta", "lib/security/tenant-secrets.ts", "process.env.TENANT_SECRETS_ENCRYPTION_KEY"],
    ["sessão de login ativa", "supabase/migrations/20261012140000_session_alive_rls.sql", "sessao_ativa()"],
    ["não guardam conteúdo de mensagem", "lib/security/erro-para-log.ts", "export"],
    ["exige justificativa, tem prazo", "lib/admin/acesso-de-suporte.ts", "DURACAO_DO_ACESSO_MS = 30 * 60 * 1000"],
    ["o conteúdo das conversas dele é removido", "supabase/migrations/20260927140000_patient_anonymization.sql", "anonymize_patient"],
    ["sair das mensagens de acompanhamento", "lib/conversations/opt-out.ts", "PEDIDOS_DE_OPT_OUT"],
    ["métricas de acesso são agregadas", "app/layout.tsx", 'from "@vercel/analytics/next"'],
  ])("“%s” → %s", (frase, arquivo, trecho) => {
    expect(texto(privacidade)).toContain(frase)
    expect(readFileSync(arquivo, "utf8")).toContain(trecho)
  })
})
