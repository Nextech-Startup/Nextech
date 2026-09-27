import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoPacientes() {
  return (
    <Carregando rotulo="os pacientes">
      <EsqueletoDeCabecalho acao />
      <EsqueletoDeLista linhas={6} />
    </Carregando>
  )
}
