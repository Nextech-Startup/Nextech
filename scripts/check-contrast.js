/**
 * Verifica o contraste (WCAG 2.1) dos pares de texto/fundo dos dois temas.
 * Roda sobre os mesmos valores oklch declarados em globals.css.
 */

// --- oklch -> sRGB ---------------------------------------------------------
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((v) => Math.min(1, Math.max(0, v)))
}

const relLum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const ratio = (c1, c2) => {
  const [a, b] = [relLum(c1), relLum(c2)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

// --- tokens (espelham globals.css) ----------------------------------------
const light = {
  "surface-0": [0.985, 0.002, 165],
  "surface-1": [1, 0, 0],
  "surface-2": [0.965, 0.004, 165],
  "text-1": [0.22, 0.01, 165],
  "text-2": [0.47, 0.012, 165],
  "text-3": [0.62, 0.012, 165],
  accent: [0.52, 0.11, 165],
  "accent-dim": [0.58, 0.1, 165],
}
const dark = {
  "surface-0": [0.09, 0, 0],
  "surface-1": [0.14, 0.006, 165],
  "surface-2": [0.18, 0.008, 165],
  "text-1": [1, 0, 0],
  "text-2": [0.72, 0.008, 165],
  "text-3": [0.56, 0.01, 165],
  accent: [0.75, 0.14, 165],
  "accent-dim": [0.62, 0.11, 165],
}

const PAIRS = [
  ["text-1", "surface-0", 4.5, "texto principal"],
  ["text-1", "surface-1", 4.5, "texto em card"],
  ["text-2", "surface-0", 4.5, "texto secundário"],
  ["text-2", "surface-1", 4.5, "secundário em card"],
  ["text-3", "surface-0", 3.0, "texto terciário (large/UI)"],
  ["accent", "surface-0", 3.0, "acento sobre fundo"],
  ["accent-dim", "surface-1", 3.0, "acento escuro em card"],
]

for (const [themeName, tokens] of [
  ["CLARO", light],
  ["ESCURO", dark],
]) {
  console.log(`\n=== TEMA ${themeName} ===`)
  for (const [fg, bg, min, label] of PAIRS) {
    const r = ratio(oklchToRgb(...tokens[fg]), oklchToRgb(...tokens[bg]))
    const ok = r >= min
    console.log(
      `${ok ? "PASS" : "FALHA"}  ${r.toFixed(2)}:1 (min ${min})  ${label}  [${fg} / ${bg}]`
    )
  }
}
