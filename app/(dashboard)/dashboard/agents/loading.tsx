import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoAgentes() {
  return (
    <Carregando rotulo="os agentes">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={3} />
    </Carregando>
  )
}
