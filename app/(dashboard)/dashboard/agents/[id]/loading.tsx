import {
  Carregando,
  EsqueletoDeCabecalho,
  EsqueletoDeFormulario,
} from "@/components/patterns/esqueleto"
import { Skeleton } from "@/components/ui/skeleton"

/** Mesma grade do editor: formulário à esquerda, prévia do WhatsApp à direita. */
export default function CarregandoAgente() {
  return (
    <Carregando rotulo="o agente">
      <EsqueletoDeCabecalho acao />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <EsqueletoDeFormulario campos={5} />
        <Skeleton
          aria-hidden="true"
          className="hidden h-96 rounded-card motion-reduce:animate-none lg:block"
        />
      </div>
    </Carregando>
  )
}
