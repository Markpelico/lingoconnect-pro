import { describe, expect, it } from 'vitest'
import {
  ASSUMED_CONFIDENCE,
  LOW_CONFIDENCE_THRESHOLD,
  isLowConfidence,
  normalizeConfidence,
  rankAlternatives,
} from './speech-result'

describe('normalizeConfidence', () => {
  it('passes a reported confidence through', () => {
    expect(normalizeConfidence(0.42)).toBe(0.42)
  })

  it('treats zero as unreported rather than certainly wrong', () => {
    // Chrome returns 0 on plenty of good results; taking it literally would
    // mark correct speech as garbage.
    expect(normalizeConfidence(0)).toBe(ASSUMED_CONFIDENCE)
  })

  it('treats undefined and null as unreported', () => {
    expect(normalizeConfidence(undefined)).toBe(ASSUMED_CONFIDENCE)
    expect(normalizeConfidence(null)).toBe(ASSUMED_CONFIDENCE)
  })

  it('treats NaN as unreported', () => {
    expect(normalizeConfidence(Number.NaN)).toBe(ASSUMED_CONFIDENCE)
  })

  it('clamps an out-of-range value to 1', () => {
    expect(normalizeConfidence(1.5)).toBe(1)
  })

  it('treats a negative value as unreported', () => {
    expect(normalizeConfidence(-0.3)).toBe(ASSUMED_CONFIDENCE)
  })
})

describe('isLowConfidence', () => {
  it('flags a value below the threshold', () => {
    expect(isLowConfidence(0.3)).toBe(true)
  })

  it('does not flag a value at the threshold', () => {
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD)).toBe(false)
  })

  it('does not flag a confident value', () => {
    expect(isLowConfidence(0.95)).toBe(false)
  })

  it('accepts a custom threshold', () => {
    expect(isLowConfidence(0.7, 0.9)).toBe(true)
  })
})

describe('rankAlternatives', () => {
  it('keeps low-confidence alternatives', () => {
    // These are most useful exactly when the top result is shaky; the old
    // code filtered them by the same threshold that dropped the result.
    const ranked = rankAlternatives([
      { transcript: 'best guess', confidence: 0.9 },
      { transcript: 'shaky guess', confidence: 0.2 },
    ])

    expect(ranked).toHaveLength(2)
    expect(ranked.map((a) => a.transcript)).toContain('shaky guess')
  })

  it('orders by confidence, best first', () => {
    const ranked = rankAlternatives([
      { transcript: 'third', confidence: 0.3 },
      { transcript: 'first', confidence: 0.9 },
      { transcript: 'second', confidence: 0.6 },
    ])

    expect(ranked.map((a) => a.transcript)).toEqual(['first', 'second', 'third'])
  })

  it('trims whitespace', () => {
    expect(rankAlternatives([{ transcript: '  hola  ', confidence: 0.9 }])[0].transcript).toBe(
      'hola'
    )
  })

  it('drops empty transcripts', () => {
    const ranked = rankAlternatives([
      { transcript: '', confidence: 0.9 },
      { transcript: '   ', confidence: 0.8 },
      { transcript: 'real', confidence: 0.7 },
    ])

    expect(ranked).toHaveLength(1)
    expect(ranked[0].transcript).toBe('real')
  })

  it('assigns a descending fallback when confidence is missing', () => {
    const ranked = rankAlternatives([
      { transcript: 'one' },
      { transcript: 'two' },
      { transcript: 'three' },
    ])

    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence)
    expect(ranked[1].confidence).toBeGreaterThan(ranked[2].confidence)
  })

  it('never assigns a fallback below the floor', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ transcript: `alt ${i}` }))
    for (const alt of rankAlternatives(many, 20)) {
      expect(alt.confidence).toBeGreaterThanOrEqual(0.1)
    }
  })

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      transcript: `alt ${i}`,
      confidence: 0.9 - i * 0.05,
    }))
    expect(rankAlternatives(many, 3)).toHaveLength(3)
  })

  it('handles an empty list', () => {
    expect(rankAlternatives([])).toEqual([])
  })
})
