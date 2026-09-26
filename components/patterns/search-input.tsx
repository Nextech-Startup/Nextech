"use client"

import type { ChangeEvent } from "react"
import { Search } from "lucide-react"

export function SearchInput({ placeholder = "Buscar", value, onChange }: { placeholder?: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input className="h-9 w-full rounded-control border border-hairline bg-surface-1 px-3 pl-9 text-sm text-ink-1 outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20" placeholder={placeholder} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value)} />
    </div>
  )
}
