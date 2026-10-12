import { Carregando, EsqueletoDeCabecalho, EsqueletoDeKpis, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoCobranca() {
  return (
    <Carregando rotulo="o plano">
      <EsqueletoDeCabecalho />
      <EsqueletoDeKpis quantidade={3} />
      <EsqueletoDeLista linhas={3} />
    </Carregando>
  )
}
