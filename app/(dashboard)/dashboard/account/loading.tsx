import { Carregando, EsqueletoDeCabecalho, EsqueletoDeFormulario } from "@/components/patterns/esqueleto"

export default function CarregandoMinhaConta() {
  return (
    <Carregando rotulo="a sua conta">
      <EsqueletoDeCabecalho />
      <EsqueletoDeFormulario campos={4} />
    </Carregando>
  )
}
