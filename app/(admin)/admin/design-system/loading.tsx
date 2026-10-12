import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

/** Sem isto, a galeria herdaria o esqueleto da lista de clínicas. */
export default function CarregandoPrototipo() {
  return (
    <Carregando rotulo="o protótipo">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
