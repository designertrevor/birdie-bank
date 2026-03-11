import { describe, it, expect } from 'vitest'
import { computeMinTransfers } from './settlement'

describe('computeMinTransfers', () => {
  const players = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ]

  it('no transfers when all even', () => {
    const net = { 1: 0, 2: 0, 3: 0 }
    expect(computeMinTransfers(players, net)).toEqual([])
  })

  it('one winner one loser: single transfer', () => {
    const net = { 1: 10, 2: -10, 3: 0 }
    const out = computeMinTransfers(players, net)
    expect(out).toHaveLength(1)
    expect(out[0].fromId).toBe(2)
    expect(out[0].toId).toBe(1)
    expect(out[0].amount).toBe(10)
  })

  it('one loser pays two winners: two transfers', () => {
    const net = { 1: 6, 2: 4, 3: -10 }
    const out = computeMinTransfers(players, net)
    expect(out).toHaveLength(2)
    const from3 = out.filter((t) => t.fromId === 3)
    expect(from3).toHaveLength(2)
    const amts = out.map((t) => t.amount).sort((a, b) => a - b)
    expect(amts).toEqual([4, 6])
  })
})
