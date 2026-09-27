import Link from "next/link"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { Button } from "@/components/ui/button"

/**
 * Endereço que não existe, ou item de outra clínica (o editor de agente
 * responde 404 em vez de "sem permissão", para não confirmar que o id
 * existe). Fica dentro do shell, com o menu à mão.
 */
export default function PaginaNaoEncontrada() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Página não encontrada" />
      <Vazio
        acao={
          <Button asChild variant="outline">
            <Link href="/dashboard">Ir para o início</Link>
          </Button>
        }
      >
        O endereço pode estar errado, ou o item foi removido.
      </Vazio>
    </div>
  )
}
