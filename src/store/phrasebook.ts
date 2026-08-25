/**
 * The phrasebook: everything you reached for and didn't have.
 *
 * Persisted to localStorage. There's no account and no server — the phrases
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
import type { ProviderQuality } from '@/lib/translation'

interface PhrasebookState {
  phrases: CapturedPhrase[]
}

interface PhrasebookActions {
  /**
   * Capture a phrase. If the same source text was already captured for this
   * language pair, the existing card is kept — re-needing a phrase shouldn't
   * silently reset the progress you've made on it.
   */
  capture: (input: {
    sourceText: string
    translatedText: string
    sourceLanguage: string
    targetLanguage: string
    provider: string
    quality: ProviderQuality
    confidence: number
  }) => { phrase: CapturedPhrase; isNew: boolean }

  review: (id: string, remembered: boolean) => void
  remove: (id: string) => void
  clear: () => void

  getDue: (now?: Date) => CapturedPhrase[]
  getStats: (now?: Date) => PhraseStats
}

export const usePhrasebook = create<PhrasebookState & PhrasebookActions>()(
  persist(
    (set, get) => ({
      phrases: [],

      capture: (input) => {
        const key = phraseKey(
          input.sourceText,
          input.sourceLanguage,
          input.targetLanguage
        )

        const existing = get().phrases.find(
          (p) => phraseKey(p.sourceText, p.sourceLanguage, p.targetLanguage) === key
        )

        if (existing) {
          return { phrase: existing, isNew: false }
        }

        const phrase = createPhrase(input)
        set((state) => ({ phrases: [phrase, ...state.phrases] }))
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

      clear: () => set({ phrases: [] }),

      getDue: (now) => selectDuePhrases(get().phrases, now),
      getStats: (now) => computeStats(get().phrases, now),
    }),
    {
      name: 'lingoconnect-phrasebook',
      version: 1,
      partialize: (state) => ({ phrases: state.phrases }),
    }
  )
)
