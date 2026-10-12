import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoAgenda() {
  return (
    <Carregando rotulo="a agenda">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={6} />
    </Carregando>
  )
}
