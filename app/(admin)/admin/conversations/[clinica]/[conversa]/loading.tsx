import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

/** A forma das conversas de suporte: cabeçalho e a lista. */
export default function CarregandoSuporte() {
  return (
    <Carregando rotulo="as conversas de suporte">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={5} />
    </Carregando>
  )
}
