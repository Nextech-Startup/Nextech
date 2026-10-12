import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoEquipe() {
  return (
    <Carregando rotulo="a equipe">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
