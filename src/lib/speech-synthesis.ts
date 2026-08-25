/**
 * Text-to-Speech via the browser's Web Speech Synthesis API.
 *
 * Extracted from the old `ai-services.ts`, which pulled in the entire OpenAI
 * SDK just to reach this class. Nothing here needs a network call or a key.
 */

import type { VoiceSynthesisOptions } from '@/types'

export class TextToSpeechService {
  private synth: SpeechSynthesis | null = null
  private voices: SpeechSynthesisVoice[] = []

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
      this.loadVoices()
    }
  }

  /**
   * Voices load asynchronously in most browsers, so read them once now and
   * again when the browser signals the list is ready.
   */
  private loadVoices() {
    if (!this.synth) return

    const read = () => {
      this.voices = this.synth?.getVoices() ?? []
    }

    read()
    this.synth.addEventListener('voiceschanged', read)
  }

  async speak(options: VoiceSynthesisOptions): Promise<void> {
    const synth = this.synth
    if (!synth) {
      throw new Error('Text-to-speech is not supported in this browser')
    }

    // Cancel anything mid-utterance so rapid translations don't queue up and
    // play over each other.
    synth.cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text)

      const voice = this.findVoiceForLanguage(options.language, options.voice)
      if (voice) utterance.voice = voice
      utterance.lang = options.language

      utterance.rate = options.rate ?? 1.0
      utterance.pitch = options.pitch ?? 1.0
      utterance.volume = options.volume ?? 1.0

      utterance.onend = () => resolve()
      utterance.onerror = (event) =>
        reject(new Error(`Speech synthesis error: ${event.error}`))

      synth.speak(utterance)
    })
  }

  private findVoiceForLanguage(
    language: string,
    preferredVoice?: string
  ): SpeechSynthesisVoice | null {
    const langCode = language.split('-')[0]

    if (preferredVoice) {
      const match = this.voices.find(
        (v) => v.name === preferredVoice && v.lang.startsWith(langCode)
      )
      if (match) return match
    }

    // Prefer an exact locale match (es-MX over es-ES) before falling back to
    // any voice for the base language.
    return (
      this.voices.find((v) => v.lang.replace('_', '-') === language) ??
      this.voices.find((v) => v.lang.startsWith(langCode)) ??
      null
    )
  }

  getAvailableVoices(language?: string): SpeechSynthesisVoice[] {
    if (!language) return this.voices

    const langCode = language.split('-')[0]
    return this.voices.filter((v) => v.lang.startsWith(langCode))
  }

  isSupported(): boolean {
    return !!this.synth
  }

  stop(): void {
    this.synth?.cancel()
  }
}

export const textToSpeech = new TextToSpeechService()
