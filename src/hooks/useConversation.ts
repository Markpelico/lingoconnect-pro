/**
 * The core loop: listen, translate, capture, speak.
 *
 * Replaces the old useEnhancedSpeech + useAutoTextToSpeech pair, which split
 * this flow across two hooks that each held their own copy of the transcript
 * and could disagree about it.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession, type Turn } from '@/store/session'
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
    async (text: string, speechConfidence: number) => {
      const {
        sourceLanguage: from,
        targetLanguage: to,
        autoSpeak: shouldSpeak,
        autoCapture: shouldCapture,
      } = settingsRef.current

      const turn: Turn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sourceText: text,
        status: 'translating',
        confidence: speechConfidence,
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

        if (shouldCapture) {
          const { phrase, isNew } = capture({
            sourceText: text,
            translatedText: data.translatedText,
            sourceLanguage: from.code,
            targetLanguage: to.code,
            provider: data.provider,
            quality: data.quality,
            confidence: data.confidence,
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
        void processUtterance(text, result.confidence)
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

  // Build the recogniser once per source language.
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
    recognition.updateLanguage(sourceLanguage.code)
  }, [sourceLanguage.code])

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (!recognition.isSpeechSupported()) {
      setError('Speech recognition is not supported in this browser.')
      setStatus('error')
      return
    }

    setError(null)
    recognition.startListening(
      handleResult,
      handleError,
      setIsVoiceActive,
      handleStatusChange
    )
  }, [handleResult, handleError, handleStatusChange])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stopListening()
    setInterimTranscript('')
    setIsVoiceActive(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) stopListening()
    else startListening()
  }, [isListening, startListening, stopListening])

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
   * Translate typed text. Speech recognition doesn't exist in Firefox, and
   * some users would rather type than talk, so the whole loop stays reachable
   * without a microphone.
   */
  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      // Typed input is exact, so it carries full confidence.
      void processUtterance(trimmed, 1)
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
    startListening,
    stopListening,
    submitText,
    speak,
    ttsSupported: textToSpeech.isSupported(),
  }
}
