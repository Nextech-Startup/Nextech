import {
  Carregando,
  EsqueletoDeCabecalho,
  EsqueletoDeFormulario,
  EsqueletoDeLista,
} from "@/components/patterns/esqueleto"

/** Mesma grade do perfil: subnavegação vertical e a seção aberta. */
export default function CarregandoPerfil() {
  return (
    <Carregando rotulo="o perfil da clínica">
      <EsqueletoDeCabecalho />
      <div className="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden lg:block">
          <EsqueletoDeLista linhas={4} />
        </div>
        <EsqueletoDeFormulario campos={5} />
      </div>
    </Carregando>
  )
}
