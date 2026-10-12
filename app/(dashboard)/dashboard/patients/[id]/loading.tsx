import { Carregando, EsqueletoDeCabecalho, EsqueletoDeLista } from "@/components/patterns/esqueleto"

export default function CarregandoPaciente() {
  return (
    <Carregando rotulo="a ficha do paciente">
      <EsqueletoDeCabecalho />
      <EsqueletoDeLista linhas={4} />
    </Carregando>
  )
}
