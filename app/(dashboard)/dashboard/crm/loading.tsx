import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoCrm() {
  return (
    <Carregando rotulo="o CRM">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
