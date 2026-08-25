/**
 * Captured phrases and their review schedule.
 *
 * The premise: a phrase you reached for mid-conversation is worth more than a
 * phrase from a word list, because you already proved you needed it. Capture
 * is automatic — every translation becomes a card.
 *
 * Scheduling is a plain Leitner box system. It's simple, well-understood, and
 * honest about what it is; a half-implemented SM-2 would be worse than a
 * correct Leitner.
 */

import type { ProviderQuality } from '@/lib/translation'

export interface CapturedPhrase {
  id: string
  /** What you said, in your language. */
  sourceText: string
  /** What it became, in the language you're learning. */
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  capturedAt: string
  provider: string
  quality: ProviderQuality
  confidence: number

  // --- Leitner state ---
  /** 0..4. Higher box = longer interval = better known. */
  box: number
  /** ISO timestamp; the phrase is reviewable once this is in the past. */
  dueAt: string
  reviewCount: number
  /** How many times a known phrase was later forgotten. */
  lapseCount: number
  lastReviewedAt?: string

  /**
   * Which direction this card tests.
   *
   * `production` is something you said and needed rendered into the language
   * you are learning. `comprehension` is something the other person said,
   * where the skill being tested is understanding rather than producing.
   *
   * Optional so phrases saved before two-way capture existed still load.
   */
  mode?: 'production' | 'comprehension'

  /**
   * Seeded demo content rather than something the user captured. Labelled as
   * such in the UI, and cleared as soon as a real phrase is saved.
   */
  isSample?: boolean
}

/** Days until the next review, indexed by Leitner box. */
export const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 16] as const
export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS)
}

/**
 * A phrase is "mastered" once it survives the longest interval. Used for
 * progress display, not for dropping it from review.
 */
export function isMastered(phrase: CapturedPhrase): boolean {
  return phrase.box >= MAX_BOX
}

export function isDue(phrase: CapturedPhrase, now: Date = new Date()): boolean {
  return new Date(phrase.dueAt).getTime() <= now.getTime()
}

export function createPhrase(input: {
  sourceText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  provider: string
  quality: ProviderQuality
  confidence: number
  mode?: 'production' | 'comprehension'
}): CapturedPhrase {
  const now = new Date()
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    ...input,
    capturedAt: now.toISOString(),
    box: 0,
    // New phrases are immediately reviewable — you just needed this one.
    dueAt: now.toISOString(),
    reviewCount: 0,
    lapseCount: 0,
  }
}

/**
 * Advance or reset a phrase after a review.
 *
 * `remembered: true` promotes it one box; `false` sends it back to box 0 and
 * counts a lapse. There's no partial credit — at this depth it would be noise.
 */
export function reviewPhrase(
  phrase: CapturedPhrase,
  remembered: boolean,
  now: Date = new Date()
): CapturedPhrase {
  const nextBox = remembered ? Math.min(phrase.box + 1, MAX_BOX) : 0
  const wasKnown = phrase.box > 0

  return {
    ...phrase,
    box: nextBox,
    dueAt: addDays(now, BOX_INTERVALS_DAYS[nextBox]).toISOString(),
    reviewCount: phrase.reviewCount + 1,
    lapseCount: phrase.lapseCount + (!remembered && wasKnown ? 1 : 0),
    lastReviewedAt: now.toISOString(),
  }
}

/** Normalised key used to detect a phrase you've already captured. */
export function phraseKey(
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string
): string {
  const normalised = sourceText
    .trim()
    .toLowerCase()
    .replace(/[.,!?¿¡;:]+$/g, '')
    .replace(/\s+/g, ' ')
  return `${sourceLanguage}|${targetLanguage}|${normalised}`
}

export interface PhraseStats {
  total: number
  due: number
  mastered: number
  learning: number
}

export function computeStats(
  phrases: CapturedPhrase[],
  now: Date = new Date()
): PhraseStats {
  let due = 0
  let mastered = 0

  for (const phrase of phrases) {
    if (isDue(phrase, now)) due++
    if (isMastered(phrase)) mastered++
  }

  return {
    total: phrases.length,
    due,
    mastered,
    learning: phrases.length - mastered,
  }
}

/**
 * Review order: overdue first, then weakest. Ties broken by capture time so
 * the queue is stable between renders.
 */
export function selectDuePhrases(
  phrases: CapturedPhrase[],
  now: Date = new Date()
): CapturedPhrase[] {
  return phrases
    .filter((p) => isDue(p, now))
    .sort((a, b) => {
      if (a.box !== b.box) return a.box - b.box
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })
}
