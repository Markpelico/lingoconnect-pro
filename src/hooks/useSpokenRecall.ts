/**
 * One-shot speech capture for reviewing a phrase.
 *
 * Separate from the conversation recogniser on purpose. That one is a
 * long-lived singleton configured for the language you speak; review needs a
 * short burst in the language you are learning. Sharing an instance would mean
 * the two panels fighting over `lang` and over start/stop state.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { judgeRecall, type RecallJudgement } from '@/lib/recall'

export type RecallStatus = 'idle' | 'listening' | 'done' | 'error'

/** Give up if the recogniser never reports anything. */
const LISTEN_TIMEOUT_MS = 10_000

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function useSpokenRecall() {
  const [status, setStatus] = useState<RecallStatus>('idle')
  const [judgement, setJudgement] = useState<RecallJudgement | null>(null)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsSupported(getRecognitionCtor() !== null)
  }, [])

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const recognition = recognitionRef.current
    if (recognition) {
      // Detach before aborting so the handlers cannot fire during teardown.
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // Already stopped.
      }
      recognitionRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    cleanup()
    setStatus('idle')
    setJudgement(null)
    setHeard('')
    setError(null)
  }, [cleanup])

  /**
   * Listen once and judge the attempt against `expected`.
   *
   * Resolves with the judgement, or null if we could not get one. A null here
   * is not a failed attempt; it means we have nothing to say about it.
   */
  const listen = useCallback(
    (expected: string, language: string): Promise<RecallJudgement | null> => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) {
        setError('Speech recognition is not supported in this browser.')
        setStatus('error')
        return Promise.resolve(null)
      }

      cleanup()
      setJudgement(null)
      setHeard('')
      setError(null)
      setStatus('listening')

      return new Promise((resolve) => {
        const recognition = new Ctor()
        recognitionRef.current = recognition

        recognition.lang = language
        // One utterance, final result only.
        recognition.continuous = false
        recognition.interimResults = false
        recognition.maxAlternatives = 3

        let settled = false
        const settle = (result: RecallJudgement | null) => {
          if (settled) return
          settled = true
          cleanup()
          resolve(result)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const result = event.results[event.results.length - 1]
          if (!result) {
            setStatus('done')
            settle(null)
            return
          }

          // Judge every alternative and keep the most generous verdict. The
          // top alternative is often not the closest to what was actually
          // said, and this is a recall check, not a transcription contest.
          const alternatives = Array.from(
            result as unknown as ArrayLike<SpeechRecognitionAlternative>
          ).filter(Boolean)

          let best: RecallJudgement | null = null
          let bestTranscript = ''

          for (const alternative of alternatives) {
            const candidate = judgeRecall(
              alternative.transcript,
              expected,
              alternative.confidence || 0.5
            )
            if (!best || candidate.similarity > best.similarity) {
              best = candidate
              bestTranscript = alternative.transcript
            }
          }

          setHeard(bestTranscript)
          setJudgement(best)
          setStatus('done')
          settle(best)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          // "no-speech" and "aborted" are ordinary outcomes, not failures
          // worth showing as an error banner.
          if (event.error === 'no-speech' || event.error === 'aborted') {
            setStatus('done')
            setJudgement(null)
            settle(null)
            return
          }

          setError(
            event.error === 'not-allowed'
              ? 'Microphone permission denied.'
              : 'Could not hear you. Try again, or grade yourself.'
          )
          setStatus('error')
          settle(null)
        }

        recognition.onend = () => {
          // Fires after a silent session with no result.
          if (!settled) {
            setStatus('done')
            settle(null)
          }
        }

        timeoutRef.current = setTimeout(() => {
          if (!settled) {
            setStatus('done')
            settle(null)
          }
        }, LISTEN_TIMEOUT_MS)

        try {
          recognition.start()
        } catch {
          setError('Could not start the microphone.')
          setStatus('error')
          settle(null)
        }
      })
    },
    [cleanup]
  )

  const cancel = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  useEffect(() => cleanup, [cleanup])

  return {
    status,
    isListening: status === 'listening',
    isSupported,
    judgement,
    heard,
    error,
    listen,
    cancel,
    reset,
  }
}
