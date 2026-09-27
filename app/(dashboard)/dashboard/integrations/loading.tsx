import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoIntegracoes() {
  return (
    <Carregando rotulo="as integrações">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
