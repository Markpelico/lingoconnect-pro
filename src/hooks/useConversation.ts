/**
 * The core loop: listen, translate, capture, speak.
 *
 * Replaces the old useEnhancedSpeech + useAutoTextToSpeech pair, which split
 * this flow across two hooks that each held their own copy of the transcript
 * and could disagree about it.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession, type Speaker, type Turn } from '@/store/session'
import { usePhrasebook } from '@/store/phrasebook'
import {
  getEnhancedSpeechRecognition,
  type SpeechResult,
} from '@/lib/enhanced-speech'
import { textToSpeech } from '@/lib/speech-synthesis'
import type { ProviderQuality } from '@/lib/translation'

export type SpeechStatus = 'idle' | 'listening' | 'processing' | 'error'

interface TranslateSuccess {
  translatedText: string
  confidence: number
  provider: string
  quality: ProviderQuality
}

export function useConversation() {
  const {
    sourceLanguage,
    targetLanguage,
    autoSpeak,
    autoCapture,
    speechRate,
    addTurn,
    updateTurn,
  } = useSession()

  const capture = usePhrasebook((s) => s.capture)

  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<ReturnType<
    typeof getEnhancedSpeechRecognition
  > | null>(null)

  // Handlers are read from a ref inside the recognition callbacks so that
  // changing the target language mid-session doesn't require tearing the
  // recogniser down and losing the audio stream.
  const settingsRef = useRef({
    sourceLanguage,
    targetLanguage,
    autoSpeak,
    autoCapture,
    speechRate,
  })
  useEffect(() => {
    settingsRef.current = {
      sourceLanguage,
      targetLanguage,
      autoSpeak,
      autoCapture,
      speechRate,
    }
  }, [sourceLanguage, targetLanguage, autoSpeak, autoCapture, speechRate])

  const speak = useCallback(async (text: string, language: string) => {
    if (!textToSpeech.isSupported()) return
    setIsSpeaking(true)
    try {
      await textToSpeech.speak({
        text,
        language,
        rate: settingsRef.current.speechRate,
      })
    } catch {
      // A failed utterance shouldn't surface as a conversation error; the
      // translation itself still succeeded and is on screen.
    } finally {
      setIsSpeaking(false)
    }
  }, [])

  /** Translate one finished utterance and fold the result into a turn. */
  const processUtterance = useCallback(
    async (
      text: string,
      speechConfidence: number,
      speaker: Speaker = 'you',
      uncertain = false
    ) => {
      const {
        sourceLanguage,
        targetLanguage,
        autoSpeak: shouldSpeak,
        autoCapture: shouldCapture,
      } = settingsRef.current

      // Their speech runs the pair in reverse: they speak the language you
      // are learning, and it needs rendering back into yours.
      const from = speaker === 'you' ? sourceLanguage : targetLanguage
      const to = speaker === 'you' ? targetLanguage : sourceLanguage

      const turn: Turn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        speaker,
        sourceText: text,
        status: 'translating',
        confidence: speechConfidence,
        uncertain,
        timestamp: new Date().toISOString(),
      }
      addTurn(turn)

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, from: from.code, to: to.code }),
        })

        const payload = await response.json()

        if (!response.ok || !payload.success) {
          updateTurn(turn.id, {
            status: 'failed',
            error:
              payload?.error?.message ??
              'Translation is temporarily unavailable.',
          })
          return
        }

        const data = payload.data as TranslateSuccess

        let phraseId: string | undefined
        let isNewCapture: boolean | undefined

        // A shaky transcript still gets translated and spoken, because that is
        // the immediate need, but it is not filed away unasked: the phrasebook
        // is worth more when it does not fill up with things you never said.
        if (shouldCapture && !uncertain) {
          const { phrase, isNew } = capture({
            sourceText: text,
            translatedText: data.translatedText,
            sourceLanguage: from.code,
            targetLanguage: to.code,
            provider: data.provider,
            quality: data.quality,
            confidence: data.confidence,
            // What you said is production practice; what they said is
            // comprehension, which is the harder half.
            mode: speaker === 'you' ? 'production' : 'comprehension',
          })
          phraseId = phrase.id
          isNewCapture = isNew
        }

        updateTurn(turn.id, {
          status: 'done',
          translatedText: data.translatedText,
          provider: data.provider,
          quality: data.quality,
          phraseId,
          isNewCapture,
        })

        if (shouldSpeak) {
          void speak(data.translatedText, to.code)
        }
      } catch {
        updateTurn(turn.id, {
          status: 'failed',
          error: 'Could not reach the translation service.',
        })
      }
    },
    [addTurn, updateTurn, capture, speak]
  )

  /** Who the current listening session is attributed to. */
  const activeSpeakerRef = useRef<Speaker>('you')
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('you')

  const handleResult = useCallback(
    (result: SpeechResult) => {
      setConfidence(result.confidence)

      if (!result.isFinal) {
        setInterimTranscript(result.transcript)
        return
      }

      setInterimTranscript('')
      const text = result.transcript.trim()
      if (text) {
        void processUtterance(
          text,
          result.confidence,
          activeSpeakerRef.current,
          result.isLowConfidence
        )
      }
    },
    [processUtterance]
  )

  const handleError = useCallback((message: string) => {
    setError(message)
    setIsListening(false)
    setStatus('error')
  }, [])

  const handleStatusChange = useCallback((next: SpeechStatus) => {
    setStatus(next)
    setIsListening(next === 'listening')
  }, [])

  // Build the recogniser once. Its language is set per turn rather than here,
  // because the two speakers use different ones.
  useEffect(() => {
    const recognition = getEnhancedSpeechRecognition({
      language: sourceLanguage.code,
      continuous: true,
      interimResults: true,
      confidenceThreshold: 0.6,
      autoStopTimeout: 45000,
      noSpeechTimeout: 4000,
      maxRetries: 3,
    })
    recognitionRef.current = recognition
    setIsSupported(recognition.isSpeechSupported())
  }, [sourceLanguage.code])

  /**
   * Start listening on behalf of one speaker.
   *
   * The recogniser is told which language to expect, which matters a lot:
   * running Spanish audio through an English model produces confident
   * nonsense rather than an error.
   */
  const listenAs = useCallback(
    (speaker: Speaker) => {
      const recognition = recognitionRef.current
      if (!recognition) return

      if (!recognition.isSpeechSupported()) {
        setError('Speech recognition is not supported in this browser.')
        setStatus('error')
        return
      }

      const { sourceLanguage: mine, targetLanguage: theirs } = settingsRef.current
      activeSpeakerRef.current = speaker
      setActiveSpeaker(speaker)
      recognition.updateLanguage(speaker === 'you' ? mine.code : theirs.code)

      setError(null)
      recognition.startListening(
        handleResult,
        handleError,
        setIsVoiceActive,
        handleStatusChange
      )
    },
    [handleResult, handleError, handleStatusChange]
  )

  const stopListening = useCallback(() => {
    recognitionRef.current?.stopListening()
    setInterimTranscript('')
    setIsVoiceActive(false)
  }, [])

  /**
   * Toggle listening for a speaker. Tapping the other speaker's button while
   * one is live switches sides rather than stopping, which is how a real
   * back-and-forth actually goes.
   */
  const toggleListening = useCallback(
    (speaker: Speaker = 'you') => {
      if (isListening && activeSpeakerRef.current === speaker) {
        stopListening()
        return
      }
      if (isListening) stopListening()
      listenAs(speaker)
    },
    [isListening, listenAs, stopListening]
  )

  // Stop cleanly when the tab is hidden — a hot mic in a background tab is
  // both a battery drain and a privacy surprise.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stopListening()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [stopListening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stopListening()
      textToSpeech.stop()
    }
  }, [])

  /**
   * File a turn the recogniser was unsure about, once you have read it and
   * decided it was right after all.
   */
  const captureTurn = useCallback(
    (turnId: string) => {
      const turn = useSession.getState().turns.find((t) => t.id === turnId)
      if (!turn?.translatedText) return

      const { sourceLanguage, targetLanguage } = settingsRef.current
      const from = turn.speaker === 'you' ? sourceLanguage : targetLanguage
      const to = turn.speaker === 'you' ? targetLanguage : sourceLanguage

      const { phrase, isNew } = capture({
        sourceText: turn.sourceText,
        translatedText: turn.translatedText,
        sourceLanguage: from.code,
        targetLanguage: to.code,
        provider: turn.provider ?? 'unknown',
        quality: turn.quality ?? 'good',
        confidence: turn.confidence,
        mode: turn.speaker === 'you' ? 'production' : 'comprehension',
      })

      updateTurn(turnId, {
        phraseId: phrase.id,
        isNewCapture: isNew,
        uncertain: false,
      })
    },
    [capture, updateTurn]
  )

  /**
   * Translate typed text. Speech recognition doesn't exist in Firefox, and
   * some users would rather type than talk, so the whole loop stays reachable
   * without a microphone.
   */
  const submitText = useCallback(
    (text: string, speaker: Speaker = 'you') => {
      const trimmed = text.trim()
      if (!trimmed) return
      // Typed input is exact, so it carries full confidence.
      void processUtterance(trimmed, 1, speaker)
    },
    [processUtterance]
  )

  return {
    status,
    isListening,
    isSupported,
    interimTranscript,
    confidence,
    isVoiceActive,
    isSpeaking,
    error,
    clearError: useCallback(() => setError(null), []),
    toggleListening,
    listenAs,
    stopListening,
    submitText,
    captureTurn,
    activeSpeaker,
    speak,
    ttsSupported: textToSpeech.isSupported(),
  }
}
