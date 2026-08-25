/**
 * Live session state: the languages you're working in, your settings, and the
 * turns of the conversation currently on screen.
 *
 * Replaces the old `conversation.ts`, which carried rooms, participants,
 * typing indicators and socket connection state for a multi-user feature that
 * was never wired up.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '@/types'
import type { ProviderQuality } from '@/lib/translation'

export type TurnStatus = 'translating' | 'done' | 'failed'

/** One thing you said, and what became of it. */
export interface Turn {
  id: string
  sourceText: string
  translatedText?: string
  status: TurnStatus
  error?: string
  provider?: string
  quality?: ProviderQuality
  /** Speech-recognition confidence for the source text. */
  confidence: number
  /** Set once the turn has been added to the phrasebook. */
  phraseId?: string
  /** False when this phrase was already in the phrasebook. */
  isNewCapture?: boolean
  timestamp: string
}

/**
 * Full BCP 47 locales, because that is what the Web Speech API expects. The
 * translation providers want the bare ISO 639-1 code, which is derived where
 * it is needed rather than stored twice.
 */
export const LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ar-SA', name: 'Arabic', rtl: true },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'ru-RU', name: 'Russian' },
]

interface SessionState {
  sourceLanguage: Language
  targetLanguage: Language
  turns: Turn[]
  autoSpeak: boolean
  autoCapture: boolean
  speechRate: number
}

interface SessionActions {
  setSourceLanguage: (language: Language) => void
  setTargetLanguage: (language: Language) => void
  swapLanguages: () => void

  addTurn: (turn: Turn) => void
  updateTurn: (id: string, updates: Partial<Turn>) => void
  clearTurns: () => void

  updateSettings: (
    settings: Partial<Pick<SessionState, 'autoSpeak' | 'autoCapture' | 'speechRate'>>
  ) => void
}

export const useSession = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      sourceLanguage: LANGUAGES[0],
      targetLanguage: LANGUAGES[1],
      turns: [],
      autoSpeak: true,
      autoCapture: true,
      speechRate: 1.0,

      setSourceLanguage: (language) =>
        set((state) =>
          // Picking the language you're already translating into is almost
          // always a mis-tap; swap instead of creating a no-op pair.
          language.code === state.targetLanguage.code
            ? { sourceLanguage: language, targetLanguage: state.sourceLanguage }
            : { sourceLanguage: language }
        ),

      setTargetLanguage: (language) =>
        set((state) =>
          language.code === state.sourceLanguage.code
            ? { targetLanguage: language, sourceLanguage: state.targetLanguage }
            : { targetLanguage: language }
        ),

      swapLanguages: () =>
        set((state) => ({
          sourceLanguage: state.targetLanguage,
          targetLanguage: state.sourceLanguage,
        })),

      addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),

      updateTurn: (id, updates) =>
        set((state) => ({
          turns: state.turns.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      clearTurns: () => set({ turns: [] }),

      updateSettings: (settings) => set(settings),
    }),
    {
      name: 'lingoconnect-session',
      version: 1,
      // Turns are ephemeral; only preferences survive a reload.
      partialize: (state) => ({
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        autoSpeak: state.autoSpeak,
        autoCapture: state.autoCapture,
        speechRate: state.speechRate,
      }),
    }
  )
)
