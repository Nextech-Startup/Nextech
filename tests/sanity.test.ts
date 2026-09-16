import { describe, it, expect } from "vitest"

describe("ambiente de teste", () => {
  it("carrega as variáveis do Supabase", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
  })
})
