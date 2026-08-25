import { describe, expect, it } from 'vitest'
import { buildSamplePhrases } from './demo-phrases'
import { MAX_BOX, computeStats, isDue, selectDuePhrases } from './phrases'

const NOW = new Date('2026-03-01T12:00:00.000Z')

describe('buildSamplePhrases', () => {
  const samples = buildSamplePhrases(NOW)

  it('marks every sample so the UI can label it honestly', () => {
    // These are demo content, not the visitor's own captures. If this flag is
    // ever dropped, the app starts quietly passing off fake data as real.
    expect(samples.every((p) => p.isSample)).toBe(true)
  })

  it('gives every sample a unique id', () => {
    expect(new Set(samples.map((p) => p.id)).size).toBe(samples.length)
  })

  it('leaves exactly one phrase due, so the review card is populated', () => {
    expect(selectDuePhrases(samples, NOW)).toHaveLength(1)
  })

  it('spans a range of boxes so progress is visible at a glance', () => {
    const boxes = samples.map((p) => p.box)
    expect(new Set(boxes).size).toBeGreaterThan(1)
    expect(Math.min(...boxes)).toBe(0)
    expect(Math.max(...boxes)).toBe(MAX_BOX)
  })

  it('produces stats that read sensibly on arrival', () => {
    expect(computeStats(samples, NOW)).toMatchObject({
      total: samples.length,
      due: 1,
      mastered: 1,
    })
  })

  it('keeps every box within the valid range', () => {
    for (const phrase of samples) {
      expect(phrase.box).toBeGreaterThanOrEqual(0)
      expect(phrase.box).toBeLessThanOrEqual(MAX_BOX)
    }
  })

  it('captures every phrase in the past', () => {
    for (const phrase of samples) {
      expect(new Date(phrase.capturedAt).getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('only claims a last review for phrases that have been reviewed', () => {
    for (const phrase of samples) {
      if (phrase.reviewCount === 0) {
        expect(phrase.lastReviewedAt).toBeUndefined()
      } else {
        expect(phrase.lastReviewedAt).toBeDefined()
      }
    }
  })

  it('carries real source and target text', () => {
    for (const phrase of samples) {
      expect(phrase.sourceText.trim()).not.toBe('')
      expect(phrase.translatedText.trim()).not.toBe('')
      expect(phrase.sourceText).not.toBe(phrase.translatedText)
    }
  })

  it('rebuilds relative to the supplied time', () => {
    const later = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000)
    const fresh = buildSamplePhrases(later)

    // Dates are computed from "now", so samples never go stale.
    expect(selectDuePhrases(fresh, later)).toHaveLength(1)
    expect(isDue(fresh[0], later)).toBe(true)
  })
})
