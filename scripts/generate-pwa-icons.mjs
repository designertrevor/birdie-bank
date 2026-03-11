import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const outDir = path.join(ROOT, 'public', 'icons')

const fontPath = path.join(
  ROOT,
  'node_modules',
  '@fontsource',
  'bebas-neue',
  'files',
  'bebas-neue-latin-400-normal.woff2'
)

function svgIcon({ size, bg = '#0d2818', inset = '#142e1e', fg = '#c8f04a', text = 'BB' }) {
  const rx = Math.round(size * 0.19)
  const insetPad = Math.round(size * 0.07)
  const insetRx = Math.round(size * 0.16)
  const fontSize = Math.round(size * 0.42)
  const y = Math.round(size * 0.63)

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>
  <rect x="${insetPad}" y="${insetPad}" width="${size - insetPad * 2}" height="${size - insetPad * 2}" rx="${insetRx}" fill="${inset}" opacity="0.9"/>
  <text x="${size / 2}" y="${y}" text-anchor="middle" fill="${fg}" font-family="Bebas Neue, sans-serif" font-size="${fontSize}" font-weight="400" letter-spacing="${Math.round(size * 0.02)}">${text}</text>
</svg>`.trim()
}

async function main() {
  await fs.mkdir(outDir, { recursive: true })

  const woff2 = await fs.readFile(fontPath)
  const fontB64 = woff2.toString('base64')

  const make = async (size) => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'Bebas Neue';
        src: url(data:font/woff2;base64,${fontB64}) format('woff2');
        font-weight: 400;
        font-style: normal;
      }
    </style>
  </defs>
  ${svgIcon({ size }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}
</svg>`.trim()

    const out = path.join(outDir, `icon-${size}.png`)
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toFile(out)
  }

  await make(192)
  await make(512)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

