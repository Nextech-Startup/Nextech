import {
  Carregando,
  EsqueletoDeCabecalho,
  EsqueletoDeKpis,
  EsqueletoDeLista,
} from "@/components/patterns/esqueleto"

export default function CarregandoVisaoGeral() {
  return (
    <Carregando rotulo="a visão geral">
      <EsqueletoDeCabecalho />
      <EsqueletoDeKpis />
      <EsqueletoDeLista linhas={2} />
    </Carregando>
  )
}
