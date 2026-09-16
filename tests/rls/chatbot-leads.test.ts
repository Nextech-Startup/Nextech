import { describe, it, expect } from "vitest"
import { createClient } from "@supabase/supabase-js"

// chatbot_leads guarda PII de lead da landing (nome, e-mail, WhatsApp).
// A anon key é pública — está no JS servido ao visitante — então a única
// barreira é a RLS.
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

describe("RLS de chatbot_leads", () => {
  it("anônimo não escreve — RLS ativa, não apenas tabela vazia", async () => {
    // Este é o assert que distingue "RLS bloqueando" de "não há o que ler":
    // 42501 é a recusa explícita da policy. Um select vazio sozinho não
    // provaria nada num banco sem leads.
    const { error } = await anonClient().from("chatbot_leads").insert({
      name: "probe-rls",
      email: "probe-rls@exemplo.test",
      origem: "teste-automatizado",
    })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("42501")
  })

  it("anônimo não lê leads", async () => {
    const { data } = await anonClient().from("chatbot_leads").select("id, email")

    expect(data ?? []).toEqual([])
  })
})

describe("RLS de projetoAtivo", () => {
  // Tabela legada da landing, sem código que a referencie.
  // Enquanto existir, não pode ser escrita por quem tem a anon key.
  it("anônimo não escreve", async () => {
    const { error } = await anonClient()
      .from("projetoAtivo")
      .insert({ Ativo: "probe-rls" })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("42501")
  })
})
