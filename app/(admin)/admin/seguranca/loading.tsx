import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

/** A forma da Segurança: cabeçalho sem ação e a lista curta de dispositivos. */
export default function CarregandoSeguranca() {
  return (
    <Carregando rotulo="os dispositivos do segundo fator">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={2} />
    </Carregando>
  )
}
