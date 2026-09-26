import { UserRound } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { iniciais } from "@/lib/formatters/texto"
import { cn } from "@/lib/utils"

/**
 * Iniciais de uma pessoa. Decorativo: o nome sempre aparece ao lado, então
 * o leitor de tela não precisa ouvir "M A" antes de "Mariana Araújo". Tom
 * neutro — o verde fica para o avatar de quem está logado.
 *
 * Sem letra no nome (paciente que só tem telefone), o avatar é um ícone:
 * "(8" como iniciais seria ruído.
 */
export function AvatarDeIniciais({
  nome,
  tamanho = "default",
  className,
}: {
  nome: string
  tamanho?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={tamanho} aria-hidden="true" className={className}>
      <AvatarFallback className="bg-surface-2 text-xs font-medium text-ink-2">
        {/\p{L}/u.test(nome) ? iniciais(nome) : <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  )
}
