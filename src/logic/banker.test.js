import { describe, it, expect } from 'vitest'
import { getBankerIndexForHole, computeHolePayouts, computeRunningTotals } from './banker'

describe('getBankerIndexForHole', () => {
  it('rotates banker by hole: H1→0, H2→1, H3→2, H4→3, H5→0', () => {
    expect(getBankerIndexForHole(1, 4)).toBe(0)
    expect(getBankerIndexForHole(2, 4)).toBe(1)
    expect(getBankerIndexForHole(3, 4)).toBe(2)
    expect(getBankerIndexForHole(4, 4)).toBe(3)
    expect(getBankerIndexForHole(5, 4)).toBe(0)
  })

  it('handles 2 players', () => {
    expect(getBankerIndexForHole(1, 2)).toBe(0)
    expect(getBankerIndexForHole(2, 2)).toBe(1)
  })
})

describe('computeHolePayouts', () => {
  const players = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ]

  it('banker (index 0) loses to both: they win their bets', () => {
    const scores = { '1-1': 5, '1-2': 4, '1-3': 4 }
    const bets = { '1-2': 2, '1-3': 3 }
    const out = computeHolePayouts(1, players, scores, bets, 1)
    expect(out[1]).toBe(-5)
    expect(out[2]).toBe(2)
    expect(out[3]).toBe(3)
  })

  it('banker beats both: banker wins', () => {
    const scores = { '1-1': 3, '1-2': 4, '1-3': 5 }
    const bets = { '1-2': 2, '1-3': 2 }
    const out = computeHolePayouts(1, players, scores, bets, 1)
    expect(out[1]).toBe(4)
    expect(out[2]).toBe(-2)
    expect(out[3]).toBe(-2)
  })

  it('returns empty if any score missing', () => {
    const scores = { '1-1': 4, '1-2': 4 }
    const bets = {}
    const out = computeHolePayouts(1, players, scores, bets, 1)
    expect(out).toEqual({})
  })
})

describe('computeRunningTotals', () => {
  const players = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ]

  it('sums hole payouts for completed holes only', () => {
    const scores = { '1-1': 4, '1-2': 5, '2-1': 5, '2-2': 4 }
    const bets = { '1-2': 2, '2-1': 2 }
    const totals = computeRunningTotals(players, scores, bets, 2, 1)
    expect(totals[1]).toBe(0)
    expect(totals[2]).toBe(0)
  })

  it('hole 1: A banker, B wins with 4 vs 5 → B +2, A -2', () => {
    const scores = { '1-1': 5, '1-2': 4 }
    const bets = { '1-2': 2 }
    const totals = computeRunningTotals(players, scores, bets, 1, 1)
    expect(totals[1]).toBe(-2)
    expect(totals[2]).toBe(2)
  })
})
