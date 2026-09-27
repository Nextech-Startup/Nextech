import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoTemplates() {
  return (
    <Carregando rotulo="os templates">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={5} />
    </Carregando>
  )
}
