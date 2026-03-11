import fs from 'node:fs/promises'
import path from 'node:path'

const inFile = process.argv[2]
if (!inFile) {
  console.error('Usage: node scripts/import-courses-utah-from-csv.mjs <path/to/courses.csv>')
  process.exit(1)
}

const outFile = path.join(process.cwd(), 'src', 'data', 'courses-utah.json')

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => String(s || '').trim())
}

function norm(s) {
  return String(s || '').trim()
}

async function main() {
  const raw = await fs.readFile(path.resolve(inFile), 'utf8')
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) throw new Error('CSV is empty')

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const idIdx = header.indexOf('id')
  const nameIdx = header.indexOf('name')
  const addressIdx = header.indexOf('address')
  if (idIdx < 0 || nameIdx < 0 || addressIdx < 0) {
    throw new Error('CSV must have headers: id,name,address')
  }

  const out = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const id = norm(cols[idIdx])
    const name = norm(cols[nameIdx])
    const address = norm(cols[addressIdx])
    if (!id || !name || !address) continue
    out.push({ id, name, address })
  }

  out.sort((a, b) => a.name.localeCompare(b.name))

  await fs.writeFile(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${out.length} courses to ${outFile}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

