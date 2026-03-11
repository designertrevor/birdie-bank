/**
 * One-time seeding helper for Utah golf courses (OpenStreetMap Overpass).
 * Produces a best-effort list (name + address). Expect some cleanup.
 *
 * Usage:
 *   node scripts/seed-courses-utah-from-osm.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OUT = path.join(process.cwd(), 'src', 'data', 'courses-utah.json')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

function slugId(name, i) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  return `ut-osm-${base || 'course'}-${String(i + 1).padStart(3, '0')}`
}

function joinAddr(tags) {
  const parts = []
  const hn = tags['addr:housenumber']
  const st = tags['addr:street']
  const city = tags['addr:city']
  const state = tags['addr:state']
  const pc = tags['addr:postcode']
  const line1 = [hn, st].filter(Boolean).join(' ')
  if (line1) parts.push(line1)
  const line2 = [city, state, pc].filter(Boolean).join(', ')
  if (line2) parts.push(line2)
  return parts.join(', ').trim()
}

async function main() {
  const query = `
[out:json][timeout:60];
area["ISO3166-2"="US-UT"]->.ut;
(
  nwr["leisure"="golf_course"](area.ut);
  nwr["sport"="golf"](area.ut);
);
out tags center;`

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })

  if (!res.ok) {
    throw new Error(`Overpass error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  const elems = Array.isArray(json.elements) ? json.elements : []

  const courses = []
  for (const el of elems) {
    const tags = el.tags || {}
    const name = (tags.name || '').trim()
    if (!name) continue

    const addr = joinAddr(tags)
    courses.push({
      id: '',
      name,
      address: addr || 'UT (address unknown)',
    })
  }

  // de-dupe by name
  const seen = new Set()
  const deduped = []
  for (const c of courses) {
    const key = c.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(c)
  }

  deduped.sort((a, b) => a.name.localeCompare(b.name))
  deduped.forEach((c, i) => (c.id = slugId(c.name, i)))

  await fs.writeFile(OUT, JSON.stringify(deduped, null, 2) + '\n', 'utf8')
  console.log(`Seeded ${deduped.length} courses to ${OUT}`)
  console.log('Next: open the file and replace any "address unknown" entries with real addresses.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

