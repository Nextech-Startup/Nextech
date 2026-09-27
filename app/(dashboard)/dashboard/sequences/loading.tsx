import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoSequencias() {
  return (
    <Carregando rotulo="as sequências">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
