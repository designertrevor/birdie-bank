import fs from 'node:fs/promises'
import path from 'node:path'

const file = path.join(process.cwd(), 'src', 'data', 'courses-utah.json')

function fail(msg) {
  console.error(`courses-utah.json: ${msg}`)
  process.exit(1)
}

function norm(s) {
  return String(s || '').trim()
}

async function main() {
  const raw = await fs.readFile(file, 'utf8')
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    fail('invalid JSON')
  }

  if (!Array.isArray(data)) fail('must be an array')
  const seenIds = new Set()

  data.forEach((c, idx) => {
    if (!c || typeof c !== 'object') fail(`row ${idx + 1}: must be an object`)
    const id = norm(c.id)
    const name = norm(c.name)
    const address = norm(c.address)

    if (!id) fail(`row ${idx + 1}: missing "id"`)
    if (!name) fail(`row ${idx + 1}: missing "name"`)
    if (!address) fail(`row ${idx + 1}: missing "address"`)
    if (seenIds.has(id)) fail(`row ${idx + 1}: duplicate id "${id}"`)
    seenIds.add(id)
  })

  console.log(`OK: ${data.length} courses validated`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

