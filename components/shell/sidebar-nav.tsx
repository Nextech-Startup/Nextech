"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavGroup } from "@/lib/navigation/schema"
import { resolveDashboardNav } from "@/lib/navigation/dashboard-nav"
import { resolveAdminNav } from "@/lib/navigation/admin-nav"
import type { ClinicRole } from "@/lib/auth/context"

/**
 * Navegação lateral dos dois painéis.
 *
 * Client component por um motivo só: precisa do `usePathname()` para saber
 * qual item está aceso. O filtro por papel acontece a partir do `role` que
 * o layout do servidor já obteve de `requireClinicContext()` — nenhuma
 * consulta nova, e nada aqui decide acesso, só o que fica visível.
 */
export function SidebarNav(
  props:
    | { painel: "clinica"; role: ClinicRole }
    | { painel: "interno" },
) {
  const pathname = usePathname()

  const grupos =
    props.painel === "clinica"
      ? resolveDashboardNav(props.role, pathname)
      : resolveAdminNav(pathname)

  return (
    <nav aria-label="Seções do painel" className="flex flex-col gap-7">
      {grupos.map((grupo) => (
        <Grupo key={grupo.label} label={grupo.label} mostrarTitulo={grupos.length > 1}>
          {grupo.items.map((item) =>
            item.status === "pronto" ? (
              <ItemAtivo
                key={item.href}
                href={item.href}
                label={item.label}
                atual={item.active}
              />
            ) : (
              <ItemEmBreve key={item.href} label={item.label} />
            ),
          )}
        </Grupo>
      ))}
    </nav>
  )
}

/**
 * O título do grupo some quando há um grupo só: rotular uma lista única
 * não organiza nada, só adiciona uma linha de ruído.
 */
function Grupo({
  label,
  mostrarTitulo,
  children,
}: {
  label: string
  mostrarTitulo: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      {mostrarTitulo && (
        <h2 className="mb-2 px-3 text-xs font-medium text-[var(--text-3)]">
          {label}
        </h2>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  )
}

/**
 * Item navegável. O estado atual é marcado por uma barra de acento à
 * esquerda, não por um bloco preenchido: quem vive no painel olha para
 * esta lista o dia inteiro, e uma marca fina cansa menos do que um
 * retângulo colorido.
 */
function ItemAtivo({
  href,
  label,
  atual,
}: {
  href: string
  label: string
  atual: boolean
}) {
  return (
    <li className="relative">
      {atual && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-pill bg-[var(--accent)]"
        />
      )}
      <Link
        href={href}
        aria-current={atual ? "page" : undefined}
        className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
          atual
            ? "bg-[var(--surface-2)] font-medium text-[var(--text-1)]"
            : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
        }`}
      >
        {label}
      </Link>
    </li>
  )
}

/**
 * Tela desenhada, ainda não construída. Não é link, não recebe foco de
 * teclado e não responde ao hover — a marca "em breve" precisa ser a
 * única leitura possível, sem sugerir que clicar leva a algum lugar.
 */
function ItemEmBreve({ label }: { label: string }) {
  return (
    <li>
      <div
        aria-disabled="true"
        className="flex items-baseline justify-between gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-3)]"
      >
        <span>{label}</span>
        <span className="text-[0.6875rem] text-[var(--text-3)]">em breve</span>
      </div>
    </li>
  )
}
