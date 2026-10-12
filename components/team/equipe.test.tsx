import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CAPACIDADES } from "./capacidades"
import { TelaDeEquipe } from "./tela-de-equipe"
import type { MembroDaEquipe } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const membro = (x: Partial<MembroDaEquipe> & { id: string }): MembroDaEquipe => ({
  nome: "Carla Mendes", email: "carla@x.com", papel: "staff", profissional: null, ultimoAcesso: null, voce: false, ...x,
})
const html = renderToStaticMarkup(
  <TelaDeEquipe
    membros={[membro({ id: "a", nome: "Ana Paula", papel: "owner", voce: true }), membro({ id: "b" })]}
    convites={[{ id: "c", email: "novo@x.com", papel: "staff", enviadoEm: "2026-09-18T10:00:00-03:00", expiraEm: "2026-09-25T10:00:00-03:00" }]}
    alteracoes={[]}
    agora={AGORA}
  />,
)

describe("equipe e acessos", () => {
  it("toda célula da matriz diz o acesso em texto", () => {
    const pode = html.match(/>Pode</g)?.length ?? 0
    const naoPode = html.match(/>Não pode</g)?.length ?? 0
    const proprios = html.match(/>Só os próprios</g)?.length ?? 0
    expect(pode + naoPode + proprios).toBe(CAPACIDADES.length * 3)
  })

  it("marca quem é você, uma vez, e não oferece mudar o próprio acesso", () => {
    expect(html.match(/>Você</g)).toHaveLength(1)
    expect(html.match(/Mudar acesso/g)).toHaveLength(1)
  })

  it("convite vencido aparece como expirado, com reenvio", () => {
    expect(html).toContain(">Expirado<")
    expect(html).toContain("expirou há 3 dias")
    expect(html).toContain("Reenviar")
  })

  it("quem nunca entrou é dito assim", () => {
    expect(html).toContain("Ainda não entrou")
  })
})
