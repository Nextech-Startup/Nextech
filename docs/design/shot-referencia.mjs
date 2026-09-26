// Referência: script de revisão visual usado no redesign de 2026-09-26.
// NÃO roda do repositório (playwright-core não é dependência do projeto).
// Para usar: copie para o scratchpad da sessão, rode `npm i playwright-core@1` lá
// e execute com MSYS_NO_PATHCONV=1 no Git Bash. Usa o Edge instalado no Windows.

// Screenshots do localhost para revisão visual.
// uso: node shot.mjs <pasta-saida> <papel>:<rota>:<tema>:<largura> ...
//   papel: anon | clinica | admin      tema: dark | light
// modo cores: node shot.mjs --cores <rota>  (lista a cor calculada de quem usa accent/brand)
import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"

const BASE = "http://localhost:3000"
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
const CREDS = {
  clinica: ["clinica@nextech.ia.br", "NextechClinica2026"],
  admin: ["admin@nextech.ia.br", "NextechAdmin2026"],
}

const browser = await chromium.launch({ executablePath: EDGE })
const estados = {}

async function estadoLogado(papel) {
  if (papel === "anon") return undefined
  if (estados[papel]) return estados[papel]
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login?redirect=/${papel === "admin" ? "admin" : "dashboard"}`)
  await page.fill('input[name="email"]', CREDS[papel][0])
  await page.fill('input[name="password"]', CREDS[papel][1])
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ])
  estados[papel] = await ctx.storageState()
  await ctx.close()
  return estados[papel]
}

async function abrir(papel, rota, tema, largura) {
  const ctx = await browser.newContext({
    storageState: await estadoLogado(papel),
    viewport: { width: Number(largura), height: largura < 800 ? 812 : 900 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), tema)
  const page = await ctx.newPage()
  const erros = []
  page.on("pageerror", (e) => erros.push(e.message))
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()))
  await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle", timeout: 120000 })
  await page.waitForTimeout(600)
  return { ctx, page, erros }
}

const args = process.argv.slice(2)

if (args[0] === "--cores") {
  const { ctx, page } = await abrir("anon", args[1] ?? "/", "dark", 1440)
  const r = await page.evaluate(() => {
    const out = {}
    const raiz = document.querySelector(".landing-scope") ?? document.body
    out["--accent no escopo"] = getComputedStyle(raiz.firstElementChild ?? raiz).getPropertyValue("--accent")
    for (const el of document.querySelectorAll('[class*="accent"]')) {
      const cls = [...el.classList].filter((c) => c.includes("accent")).join(" ")
      const s = getComputedStyle(el)
      const chave = cls
      if (out[chave]) continue
      out[chave] = `bg=${s.backgroundColor} color=${s.color} border=${s.borderTopColor}`
    }
    return out
  })
  for (const [k, v] of Object.entries(r)) console.log(`${k}  ->  ${v}`)
  await ctx.close()
} else {
  const [saida, ...specs] = args
  mkdirSync(saida, { recursive: true })
  for (const spec of specs) {
    const [papel, rota, tema, largura] = spec.split(":")
    const { ctx, page, erros } = await abrir(papel, rota, tema, largura)
    const nome = `${papel}${rota.replace(/[/?=&]+/g, "_")}_${tema}_${largura}.png`
    await page.screenshot({ path: `${saida}/${nome}`, fullPage: true })
    console.log(`${nome}${erros.length ? "  ERROS: " + erros.slice(0, 3).join(" | ") : ""}`)
    await ctx.close()
  }
}
await browser.close()
