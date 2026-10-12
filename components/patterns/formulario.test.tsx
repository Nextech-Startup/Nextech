import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Aviso, Botao, Campo, Input, Select, estadoInicial } from "./formulario"

describe("Aviso", () => {
  it("erro é anunciado como alerta", () => {
    const html = renderToStaticMarkup(<Aviso state={{ error: "CNPJ inválido", success: null }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain("CNPJ inválido")
  })

  it("sucesso é anunciado como status, sem a urgência de um alerta", () => {
    const html = renderToStaticMarkup(<Aviso state={{ error: null, success: "Salvo." }} />)
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it("sem mensagem não ocupa espaço", () => {
    expect(renderToStaticMarkup(<Aviso state={estadoInicial} />)).toBe("")
  })
})

describe("Campo", () => {
  it("o rótulo envolve o controle, associando os dois sem id", () => {
    const html = renderToStaticMarkup(
      <Campo label="Nome">
        <Input name="name" />
      </Campo>,
    )
    expect(html.startsWith("<label")).toBe(true)
    expect(html.endsWith("</label>")).toBe(true)
    expect(html).toContain('name="name"')
  })
})

describe("controles nativos", () => {
  // As server actions leem FormData: o controle precisa continuar sendo
  // o elemento nativo, com o mesmo name.
  it("Select continua um <select> nativo com name", () => {
    const html = renderToStaticMarkup(
      <Select name="specialty" defaultValue="odonto">
        <option value="odonto">Odontologia</option>
      </Select>,
    )
    expect(html).toMatch(/<select[^>]*name="specialty"/)
  })

  it("Botao preserva type e name", () => {
    const html = renderToStaticMarkup(
      <Botao type="submit" name="intent" value="salvar">
        Salvar
      </Botao>,
    )
    expect(html).toMatch(/<button[^>]*type="submit"/)
    expect(html).toContain('name="intent"')
  })
})
