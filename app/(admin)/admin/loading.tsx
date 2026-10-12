import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoClinicas() {
  return (
    <Carregando rotulo="as clínicas">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={5} />
    </Carregando>
  )
}
