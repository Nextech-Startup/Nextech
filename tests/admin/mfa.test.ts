import { createHmac } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { situacaoDoMfa } from "@/lib/admin/context"
import { admin, comoUsuario, criarUsuario, type Usuario } from "../fixtures/clinica-de-conversas"

/**
 * Segundo fator do painel interno (spec admin-mfa-v1) contra o Supabase Auth
 * de verdade, com o TOTP calculado aqui (RFC 6238). Fixa o que `lib/admin/mfa.ts`
 * assume do Auth: os códigos de erro que ele traduz, o `aal2` no token que o
 * verify devolve, a leitura do nível por token e a API de admin dos fatores.
 */

function base32(texto: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const c of texto.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0")
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(segredo: string, passo = 0): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + passo))
  const hmac = createHmac("sha1", base32(segredo)).update(contador).digest()
  const deslocamento = hmac[hmac.length - 1] & 0xf
  const valor = (hmac.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000
  return String(valor).padStart(6, "0")
}

/** O claim `aal` do token, só para conferência no teste. */
const aalDo = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).aal as string

let equipe: Usuario
let primeiro: { id: string; segredo: string }

beforeAll(async () => {
  equipe = await criarUsuario("mfa")
})

afterAll(async () => {
  if (equipe) await admin.auth.admin.deleteUser(equipe.id)
})

describe("cadastro e desafio no Auth real", () => {
  it("sem fator, a sessão é aal1 e a situação é sem_fator", async () => {
    const client = await comoUsuario(equipe)
    const { data: nivel } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    const { data } = await client.auth.getUser()

    expect(nivel?.currentLevel).toBe("aal1")
    expect(situacaoDoMfa(nivel?.currentLevel, data.user?.factors)).toBe("sem_fator")
  })

  it("enroll devolve QR, segredo e URI com o emissor Nextech", async () => {
    const client = await comoUsuario(equipe)
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Celular", issuer: "Nextech" })
    if (error) throw error

    expect(data.totp.secret).toMatch(/^[A-Z2-7]+=*$/)
    expect(data.totp.uri).toContain("issuer=Nextech")
    expect(data.totp.qr_code).toContain("svg")
    primeiro = { id: data.id, segredo: data.totp.secret }
  })

  it("código errado: mfa_verification_failed, e a sessão segue aal1", async () => {
    const client = await comoUsuario(equipe)
    const errado = totp(primeiro.segredo) === "000000" ? "111111" : "000000"
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: primeiro.id, code: errado })

    expect(error?.code).toBe("mfa_verification_failed")
    const { data: nivel } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    expect(nivel?.currentLevel).toBe("aal1")
  })

  it("código certo: o token devolvido é aal2, e o nível lido por ele também", async () => {
    const client = await comoUsuario(equipe)
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: primeiro.id, code: totp(primeiro.segredo) })
    if (error) throw error

    expect(aalDo(data.access_token)).toBe("aal2")
    const { data: nivel } = await client.auth.mfa.getAuthenticatorAssuranceLevel(data.access_token)
    expect(nivel?.currentLevel).toBe("aal2")

    const { data: usuario } = await client.auth.getUser(data.access_token)
    expect(situacaoDoMfa(nivel?.currentLevel, usuario.user?.factors)).toBe("ok")
  })

  it("um login novo, com senha, volta a aal1: o desafio é por sessão", async () => {
    const { anonClient } = await import("../fixtures/clinica-de-conversas")
    const outra = anonClient()
    const { data, error } = await outra.auth.signInWithPassword({ email: equipe.email, password: equipe.password })
    if (error) throw error

    expect(aalDo(data.session.access_token)).toBe("aal1")
    const { data: nivel } = await outra.auth.mfa.getAuthenticatorAssuranceLevel()
    expect(situacaoDoMfa(nivel?.currentLevel, data.user.factors)).toBe("desafio_pendente")
    await outra.auth.signOut({ scope: "local" })
  })

  it("nome repetido de fator: mfa_factor_name_conflict", async () => {
    const client = await comoUsuario(equipe)
    const { error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Celular", issuer: "Nextech" })
    expect(error?.code).toBe("mfa_factor_name_conflict")
  })
})

describe("gestão pela API de admin do Auth", () => {
  it("lista os fatores da pessoa e remove pelo userId", async () => {
    const client = await comoUsuario(equipe)
    const { data: reserva, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Reserva", issuer: "Nextech" })
    if (error) throw error

    const { data: lista, error: erroLista } = await admin.auth.admin.mfa.listFactors({ userId: equipe.id })
    if (erroLista) throw erroLista
    expect(lista.factors.map((f) => [f.friendly_name, f.status]).sort()).toEqual([
      ["Celular", "verified"],
      ["Reserva", "unverified"],
    ])

    const { error: erroRemocao } = await admin.auth.admin.mfa.deleteFactor({ userId: equipe.id, id: reserva.id })
    expect(erroRemocao).toBeNull()

    const { data: depois } = await admin.auth.admin.mfa.listFactors({ userId: equipe.id })
    expect(depois?.factors.map((f) => f.id)).toEqual([primeiro.id])
  })
})

describe("contagem de erros do código (admin_mfa_failures)", () => {
  it("a função registra e conta na janela; a sessão não lê, não grava e não chama", async () => {
    const um = await admin.rpc("register_admin_mfa_failure", { p_user: equipe.id, p_janela: "15 minutes" })
    const dois = await admin.rpc("register_admin_mfa_failure", { p_user: equipe.id, p_janela: "15 minutes" })
    expect([um.error, dois.error]).toEqual([null, null])
    expect(dois.data).toBe((um.data as number) + 1)

    const client = await comoUsuario(equipe)
    const leitura = await client.from("admin_mfa_failures").select("id")
    expect(leitura.error?.code).toBe("42501")
    const escrita = await client.from("admin_mfa_failures").delete().eq("user_id", equipe.id)
    expect(escrita.error?.code).toBe("42501")
    const chamada = await client.rpc("register_admin_mfa_failure", { p_user: equipe.id, p_janela: "15 minutes" })
    expect(chamada.error).not.toBeNull()

    await admin.from("admin_mfa_failures").delete().eq("user_id", equipe.id)
  })
})
