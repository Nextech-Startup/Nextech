import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

/** A forma da Auditoria: cabeçalho sem ação e a lista do dia. */
export default function CarregandoAuditoria() {
  return (
    <Carregando rotulo="a trilha de auditoria">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={6} />
    </Carregando>
  )
}
