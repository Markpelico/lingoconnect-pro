/**
 * Sample phrases shown on a first visit.
 *
 * Without these, a first-time visitor lands on an empty phrasebook and the
 * whole point of the app is invisible: they see a translator next to a box
 * that says "Nothing saved yet". Seeding a few phrases at different review
 * stages makes the capture-and-review loop legible in about two seconds.
 *
 * These are labelled as samples in the UI rather than passed off as the
 * visitor's own data, and they are cleared the moment a real phrase is saved.
 *
 * The translations are real output from the app's own provider chain, not
 * invented, so nothing here claims a quality the app cannot actually deliver.
 */

import type { CapturedPhrase } from '@/lib/phrases'

interface SampleSpec {
  sourceText: string
  translatedText: string
  /** Leitner box, 0 to MAX_BOX. */
  box: number
  /** Negative means overdue, so it shows up in the review queue now. */
  dueInDays: number
  reviewCount: number
  capturedDaysAgo: number
}

/**
 * Chosen to sound like things you actually get stuck on mid-conversation
 * rather than phrasebook filler. Nobody needs "hello" translated; people do
 * freeze on the allergy one.
 *
 * Exactly one is due, so the review card is populated on arrival.
 */
const SAMPLES: SampleSpec[] = [
  {
    sourceText: 'Could you say that more slowly?',
    translatedText: '¿Podrías decirlo más despacio?',
    box: 0,
    dueInDays: -0.2,
    reviewCount: 0,
    capturedDaysAgo: 0.5,
  },
  {
    sourceText: 'Where do I pay for this?',
    translatedText: '¿Dónde pago esto?',
    box: 1,
    dueInDays: 1,
    reviewCount: 1,
    capturedDaysAgo: 2,
  },
  {
    sourceText: 'Is this seat taken?',
    translatedText: '¿Está ocupado este asiento?',
    box: 2,
    dueInDays: 2,
    reviewCount: 2,
    capturedDaysAgo: 5,
  },
  {
    sourceText: 'My daughter has a nut allergy',
    translatedText: 'Mi hija tiene alergia a los frutos secos',
    box: 3,
    dueInDays: 5,
    reviewCount: 3,
    capturedDaysAgo: 9,
  },
  {
    sourceText: "I'll take the one on the left",
    translatedText: 'Tomaré el de la izquierda',
    box: 4,
    dueInDays: 12,
    reviewCount: 5,
    capturedDaysAgo: 21,
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Build the sample phrases relative to now, so the review dates are always
 * sensible no matter when the page is opened.
 */
export function buildSamplePhrases(now: Date = new Date()): CapturedPhrase[] {
  return SAMPLES.map((spec, index) => ({
    id: `sample-${index}`,
    sourceText: spec.sourceText,
    translatedText: spec.translatedText,
    sourceLanguage: 'en-US',
    targetLanguage: 'es-ES',
    capturedAt: new Date(now.getTime() - spec.capturedDaysAgo * DAY_MS).toISOString(),
    provider: 'MyMemory',
    quality: 'good' as const,
    confidence: 1,
    box: spec.box,
    dueAt: new Date(now.getTime() + spec.dueInDays * DAY_MS).toISOString(),
    reviewCount: spec.reviewCount,
    lapseCount: 0,
    lastReviewedAt:
      spec.reviewCount > 0
        ? new Date(now.getTime() - spec.capturedDaysAgo * DAY_MS * 0.4).toISOString()
        : undefined,
    isSample: true,
  }))
}
