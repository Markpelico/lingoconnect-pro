/**
 * Shared types.
 *
 * This file previously carried 315 lines covering rooms, participants, WebRTC
 * offers, socket event maps and analytics events, none of which had a
 * corresponding implementation. What remains is what the app actually uses.
 */

export interface Language {
  /** BCP 47 locale, e.g. "es-ES". The Web Speech API wants the full locale. */
  code: string
  name: string
  flag: string
  /** Right-to-left script, used to set `dir` on rendered translations. */
  rtl?: boolean
}

export interface TranslationRequest {
  text: string
  from: string
  to: string
  context?: string
}

export interface VoiceSynthesisOptions {
  text: string
  language: string
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
}
