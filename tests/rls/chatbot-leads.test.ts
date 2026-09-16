import { describe, it, expect } from "vitest"
import { createClient } from "@supabase/supabase-js"

describe("RLS de chatbot_leads", () => {
  it("usuário anônimo não consegue LER leads", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    // A landing grava lead pelo servidor, com service_role.
    // Ninguém portando a anon key deve conseguir listar PII.
    const { data } = await anon.from("chatbot_leads").select("id, email")

    expect(data ?? []).toEqual([])
  })
})
