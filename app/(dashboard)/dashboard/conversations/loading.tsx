import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoConversas() {
  return (
    <Carregando rotulo="as conversas">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={6} />
    </Carregando>
  )
}
