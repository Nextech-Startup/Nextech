/**
 * Redimensiona os assets de public/ para o maior tamanho que a página
 * realmente exibe (com folga para telas 2x/3x) e recomprime.
 * O next/image ainda gera AVIF/WebP por cima disto; esta etapa só evita
 * guardar e processar originais de 1024px+ para elementos de 40px.
 */
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const PUBLIC = path.join(process.cwd(), "public")

// largura máxima de saída por asset, derivada do uso real na página
const TARGETS = {
  "professional-headshot-1.png": 120, // avatar 40px @3x
  "professional-headshot-2.png": 120,
  "professional-headshot-3.png": 120,
  "professional-headshot-4.png": 120,
  "professional-headshot-5.png": 120,
  "Logo.png": 480, // exibido a ~160px de largura @3x
  "FotoPerfilBot.png": 160, // avatar do chatbot @3x
  "Favicon.png": 256, // mantém
}

async function run() {
  let before = 0
  let after = 0
  const rows = []

  for (const [file, width] of Object.entries(TARGETS)) {
    const src = path.join(PUBLIC, file)
    if (!fs.existsSync(src)) continue

    const sizeBefore = fs.statSync(src).size
    const meta = await sharp(src).metadata()

    const buf = await sharp(src)
      .resize({
        width: Math.min(width, meta.width),
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toBuffer()

    // só grava se realmente ficou menor
    if (buf.length < sizeBefore) {
      fs.writeFileSync(src, buf)
    }

    const sizeAfter = fs.statSync(src).size
    before += sizeBefore
    after += sizeAfter
    rows.push({
      file,
      from: `${meta.width}px / ${(sizeBefore / 1024).toFixed(0)}KB`,
      to: `${Math.min(width, meta.width)}px / ${(sizeAfter / 1024).toFixed(0)}KB`,
      saved: `${(100 - (sizeAfter / sizeBefore) * 100).toFixed(1)}%`,
    })
  }

  console.table(rows)
  console.log(
    `TOTAL: ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB ` +
      `(-${(100 - (after / before) * 100).toFixed(1)}%)`
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
