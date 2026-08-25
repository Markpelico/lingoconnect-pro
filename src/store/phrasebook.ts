/**
 * The phrasebook: everything you reached for and didn't have.
 *
 * Persisted to localStorage. There's no account and no server, so the phrases
 * never leave the device, which is both a privacy property worth stating and
 * the reason this deploys anywhere without a database.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  computeStats,
  createPhrase,
  phraseKey,
  reviewPhrase,
  selectDuePhrases,
  type CapturedPhrase,
  type PhraseStats,
} from '@/lib/phrases'
import { buildSamplePhrases } from '@/lib/demo-phrases'
import type { ProviderQuality } from '@/lib/translation'

interface PhrasebookState {
  phrases: CapturedPhrase[]
  /**
   * Whether the demo samples have been seeded once. Persisted so that a user
   * who deliberately clears the phrasebook doesn't get samples pushed back at
   * them on the next visit.
   */
  seeded: boolean
}

interface PhrasebookActions {
  /**
   * Capture a phrase. If the same source text was already captured for this
   * language pair, the existing card is kept, since re-needing a phrase
   * shouldn't silently reset the progress you've made on it.
   */
  capture: (input: {
    sourceText: string
    translatedText: string
    sourceLanguage: string
    targetLanguage: string
    provider: string
    quality: ProviderQuality
    confidence: number
    mode?: 'production' | 'comprehension'
  }) => { phrase: CapturedPhrase; isNew: boolean }

  review: (id: string, remembered: boolean) => void
  remove: (id: string) => void
  clear: () => void

  /** Populate the demo samples. No-op once anything is stored. */
  seedSamples: () => void
  /** Drop the samples, keeping anything the user actually captured. */
  clearSamples: () => void

  hasSamples: () => boolean
  getDue: (now?: Date) => CapturedPhrase[]
  getStats: (now?: Date) => PhraseStats
}

export const usePhrasebook = create<PhrasebookState & PhrasebookActions>()(
  persist(
    (set, get) => ({
      phrases: [],
      seeded: false,

      capture: (input) => {
        // Samples make way for the first real phrase. This has to happen
        // before the duplicate check, otherwise capturing a phrase that
        // matches a sample would be treated as already-saved and the user
        // would never see it land.
        const existingPhrases = get().phrases.filter((p) => !p.isSample)

        const key = phraseKey(
          input.sourceText,
          input.sourceLanguage,
          input.targetLanguage
        )

        const existing = existingPhrases.find(
          (p) => phraseKey(p.sourceText, p.sourceLanguage, p.targetLanguage) === key
        )

        if (existing) {
          set({ phrases: existingPhrases, seeded: true })
          return { phrase: existing, isNew: false }
        }

        const phrase = createPhrase(input)
        set({ phrases: [phrase, ...existingPhrases], seeded: true })
        return { phrase, isNew: true }
      },

      review: (id, remembered) =>
        set((state) => ({
          phrases: state.phrases.map((p) =>
            p.id === id ? reviewPhrase(p, remembered) : p
          ),
        })),

      remove: (id) =>
        set((state) => ({ phrases: state.phrases.filter((p) => p.id !== id) })),

      // Marked as seeded so clearing everything is respected as a choice.
      clear: () => set({ phrases: [], seeded: true }),

      seedSamples: () => {
        const { phrases, seeded } = get()
        if (seeded || phrases.length > 0) return
        set({ phrases: buildSamplePhrases(), seeded: true })
      },

      clearSamples: () =>
        set((state) => ({
          phrases: state.phrases.filter((p) => !p.isSample),
        })),

      hasSamples: () => get().phrases.some((p) => p.isSample),
      getDue: (now) => selectDuePhrases(get().phrases, now),
      getStats: (now) => computeStats(get().phrases, now),
    }),
    {
      name: 'lingoconnect-phrasebook',
      version: 2,
      partialize: (state) => ({ phrases: state.phrases, seeded: state.seeded }),
    }
  )
)
