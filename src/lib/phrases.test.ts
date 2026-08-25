import { describe, expect, it } from 'vitest'
import {
  BOX_INTERVALS_DAYS,
  MAX_BOX,
  computeStats,
  createPhrase,
  isDue,
  isMastered,
  phraseKey,
  reviewPhrase,
  selectDuePhrases,
  type CapturedPhrase,
} from './phrases'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-03-01T12:00:00.000Z')

function makePhrase(overrides: Partial<CapturedPhrase> = {}): CapturedPhrase {
  return {
    id: 'p1',
    sourceText: 'Where is the train station?',
    translatedText: '¿Dónde está la estación de tren?',
    sourceLanguage: 'en-US',
    targetLanguage: 'es-ES',
    capturedAt: NOW.toISOString(),
    provider: 'MyMemory',
    quality: 'good',
    confidence: 1,
    box: 0,
    dueAt: NOW.toISOString(),
    reviewCount: 0,
    lapseCount: 0,
    ...overrides,
  }
}

/** Whole days between a phrase's due date and a reference point. */
function daysUntilDue(phrase: CapturedPhrase, from: Date = NOW): number {
  return Math.round((new Date(phrase.dueAt).getTime() - from.getTime()) / DAY_MS)
}

describe('createPhrase', () => {
  it('starts a new phrase in box 0 and makes it immediately reviewable', () => {
    const phrase = createPhrase({
      sourceText: 'Is this seat taken?',
      translatedText: '¿Está ocupado este asiento?',
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      provider: 'MyMemory',
      quality: 'good',
      confidence: 0.9,
    })

    expect(phrase.box).toBe(0)
    expect(phrase.reviewCount).toBe(0)
    expect(phrase.lapseCount).toBe(0)
    // You just needed this phrase, so it should be reviewable right away.
    expect(isDue(phrase)).toBe(true)
  })

  it('gives each phrase a distinct id', () => {
    const input = {
      sourceText: 'same text',
      translatedText: 'mismo texto',
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      provider: 'MyMemory',
      quality: 'good' as const,
      confidence: 1,
    }
    const ids = new Set(Array.from({ length: 50 }, () => createPhrase(input).id))
    expect(ids.size).toBe(50)
  })
})

describe('reviewPhrase', () => {
  it('promotes one box on success and schedules the matching interval', () => {
    const reviewed = reviewPhrase(makePhrase({ box: 1 }), true, NOW)

    expect(reviewed.box).toBe(2)
    expect(daysUntilDue(reviewed)).toBe(BOX_INTERVALS_DAYS[2])
    expect(reviewed.reviewCount).toBe(1)
  })

  it('walks the full ladder with the documented intervals', () => {
    let phrase = makePhrase()
    const intervals: number[] = []

    for (let i = 0; i < MAX_BOX; i++) {
      phrase = reviewPhrase(phrase, true, NOW)
      intervals.push(daysUntilDue(phrase))
    }

    expect(phrase.box).toBe(MAX_BOX)
    expect(intervals).toEqual([...BOX_INTERVALS_DAYS].slice(1))
  })

  it('does not promote past the top box', () => {
    const reviewed = reviewPhrase(makePhrase({ box: MAX_BOX }), true, NOW)

    expect(reviewed.box).toBe(MAX_BOX)
    expect(daysUntilDue(reviewed)).toBe(BOX_INTERVALS_DAYS[MAX_BOX])
  })

  it('resets to box 0 on failure', () => {
    const reviewed = reviewPhrase(makePhrase({ box: 3 }), false, NOW)

    expect(reviewed.box).toBe(0)
    // Box 0 has a zero-day interval, so a forgotten phrase comes straight back.
    expect(isDue(reviewed, NOW)).toBe(true)
  })

  it('counts a lapse only when a previously known phrase is forgotten', () => {
    // Failing from box 0 is not a lapse; you never knew it in the first place.
    expect(reviewPhrase(makePhrase({ box: 0 }), false, NOW).lapseCount).toBe(0)
    expect(reviewPhrase(makePhrase({ box: 2 }), false, NOW).lapseCount).toBe(1)
  })

  it('does not count a lapse on success', () => {
    expect(reviewPhrase(makePhrase({ box: 2 }), true, NOW).lapseCount).toBe(0)
  })

  it('accumulates lapses across repeated forgetting', () => {
    let phrase = makePhrase({ box: 2 })
    phrase = reviewPhrase(phrase, false, NOW) // lapse 1
    phrase = reviewPhrase(phrase, true, NOW) // back to box 1
    phrase = reviewPhrase(phrase, false, NOW) // lapse 2

    expect(phrase.lapseCount).toBe(2)
    expect(phrase.reviewCount).toBe(3)
  })

  it('stamps the review time', () => {
    const reviewed = reviewPhrase(makePhrase(), true, NOW)
    expect(reviewed.lastReviewedAt).toBe(NOW.toISOString())
  })

  it('leaves the original phrase untouched', () => {
    const original = makePhrase({ box: 1 })
    const snapshot = { ...original }
    reviewPhrase(original, true, NOW)

    expect(original).toEqual(snapshot)
  })
})

describe('isMastered', () => {
  it('is true only at the top box', () => {
    expect(isMastered(makePhrase({ box: MAX_BOX - 1 }))).toBe(false)
    expect(isMastered(makePhrase({ box: MAX_BOX }))).toBe(true)
  })
})

describe('isDue', () => {
  it('treats a phrase due exactly now as due', () => {
    expect(isDue(makePhrase({ dueAt: NOW.toISOString() }), NOW)).toBe(true)
  })

  it('is false while the due date is still ahead', () => {
    const future = new Date(NOW.getTime() + DAY_MS).toISOString()
    expect(isDue(makePhrase({ dueAt: future }), NOW)).toBe(false)
  })

  it('is true once overdue', () => {
    const past = new Date(NOW.getTime() - DAY_MS).toISOString()
    expect(isDue(makePhrase({ dueAt: past }), NOW)).toBe(true)
  })
})

describe('phraseKey', () => {
  it('ignores case, surrounding space, and trailing punctuation', () => {
    const a = phraseKey('  Where is the station?  ', 'en-US', 'es-ES')
    const b = phraseKey('where is the station', 'en-US', 'es-ES')
    expect(a).toBe(b)
  })

  it('collapses repeated whitespace', () => {
    expect(phraseKey('two   words', 'en-US', 'es-ES')).toBe(
      phraseKey('two words', 'en-US', 'es-ES')
    )
  })

  it('handles Spanish opening punctuation', () => {
    expect(phraseKey('¿Dónde está?', 'es-ES', 'en-US')).toBe(
      phraseKey('¿Dónde está', 'es-ES', 'en-US')
    )
  })

  it('keeps different language pairs distinct', () => {
    expect(phraseKey('hello', 'en-US', 'es-ES')).not.toBe(
      phraseKey('hello', 'en-US', 'fr-FR')
    )
  })

  it('keeps genuinely different text distinct', () => {
    expect(phraseKey('the check please', 'en-US', 'es-ES')).not.toBe(
      phraseKey('the checks please', 'en-US', 'es-ES')
    )
  })
})

describe('computeStats', () => {
  it('counts totals, due, mastered, and learning', () => {
    const phrases = [
      makePhrase({ id: 'a', box: 0, dueAt: NOW.toISOString() }),
      makePhrase({
        id: 'b',
        box: 2,
        dueAt: new Date(NOW.getTime() + 3 * DAY_MS).toISOString(),
      }),
      makePhrase({
        id: 'c',
        box: MAX_BOX,
        dueAt: new Date(NOW.getTime() + 16 * DAY_MS).toISOString(),
      }),
    ]

    expect(computeStats(phrases, NOW)).toEqual({
      total: 3,
      due: 1,
      mastered: 1,
      learning: 2,
    })
  })

  it('returns zeroes for an empty phrasebook', () => {
    expect(computeStats([], NOW)).toEqual({
      total: 0,
      due: 0,
      mastered: 0,
      learning: 0,
    })
  })
})

describe('selectDuePhrases', () => {
  it('excludes phrases that are not due yet', () => {
    const phrases = [
      makePhrase({ id: 'due', dueAt: NOW.toISOString() }),
      makePhrase({
        id: 'later',
        dueAt: new Date(NOW.getTime() + DAY_MS).toISOString(),
      }),
    ]

    expect(selectDuePhrases(phrases, NOW).map((p) => p.id)).toEqual(['due'])
  })

  it('puts the weakest phrases first', () => {
    const past = new Date(NOW.getTime() - DAY_MS).toISOString()
    const phrases = [
      makePhrase({ id: 'strong', box: 3, dueAt: past }),
      makePhrase({ id: 'weak', box: 0, dueAt: past }),
      makePhrase({ id: 'middle', box: 1, dueAt: past }),
    ]

    expect(selectDuePhrases(phrases, NOW).map((p) => p.id)).toEqual([
      'weak',
      'middle',
      'strong',
    ])
  })

  it('breaks ties by how overdue a phrase is', () => {
    const phrases = [
      makePhrase({
        id: 'recent',
        box: 1,
        dueAt: new Date(NOW.getTime() - DAY_MS).toISOString(),
      }),
      makePhrase({
        id: 'ancient',
        box: 1,
        dueAt: new Date(NOW.getTime() - 10 * DAY_MS).toISOString(),
      }),
    ]

    expect(selectDuePhrases(phrases, NOW).map((p) => p.id)).toEqual([
      'ancient',
      'recent',
    ])
  })

  it('does not mutate the input array', () => {
    const phrases = [
      makePhrase({ id: 'b', box: 2 }),
      makePhrase({ id: 'a', box: 0 }),
    ]
    selectDuePhrases(phrases, NOW)

    expect(phrases.map((p) => p.id)).toEqual(['b', 'a'])
  })
})
