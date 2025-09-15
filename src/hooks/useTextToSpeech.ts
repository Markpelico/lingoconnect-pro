/**
 * Custom React Hook for Text-to-Speech
 * Enterprise-grade speech synthesis with voice selection and controls
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConversationStore } from '@/store/conversation'
import { textToSpeech } from '@/lib/ai-services'
import type { VoiceSynthesisOptions } from '@/types'

interface UseTextToSpeechOptions {
  autoSpeak?: boolean
  rate?: number
  pitch?: number
  volume?: number
  voice?: string
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface UseTextToSpeechReturn {
  speak: (text: string, options?: Partial<VoiceSynthesisOptions>) => Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  voices: SpeechSynthesisVoice[]
  currentVoice: SpeechSynthesisVoice | null
  setVoice: (voice: SpeechSynthesisVoice | string) => void
  error: string | null
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
  const {
    autoSpeak = false,
    rate: defaultRate = 1.0,
    pitch: defaultPitch = 1.0,
    volume: defaultVolume = 1.0,
    voice: defaultVoice,
    onStart,
    onEnd,
    onError
  } = options

  // Zustand store integration
  const { targetLanguage, autoSpeak: storeAutoSpeak, speechRate, volume } = useConversationStore()

  // Local state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  // Refs for cleanup
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const queueRef = useRef<string[]>([])

  // Check if text-to-speech is supported
  const isSupported = textToSpeech.isSupported()

  // Load available voices
  useEffect(() => {
    if (isSupported) {
      const loadVoices = () => {
        const availableVoices = textToSpeech.getAvailableVoices()
        setVoices(availableVoices)
        
        // Set default voice for target language
        if (!currentVoice && availableVoices.length > 0) {
          const langCode = targetLanguage.code.split('-')[0]
          const preferredVoice = availableVoices.find(v => 
            v.lang.startsWith(langCode) && v.default
          ) || availableVoices.find(v => 
            v.lang.startsWith(langCode)
          ) || availableVoices[0]
          
          setCurrentVoice(preferredVoice)
        }
      }

      loadVoices()
      
      // Listen for voice changes (some browsers load voices asynchronously)
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    }
  }, [isSupported, targetLanguage.code, currentVoice])

  // Set voice by name or object
  const setVoice = useCallback((voice: SpeechSynthesisVoice | string) => {
    if (typeof voice === 'string') {
      const foundVoice = voices.find(v => v.name === voice)
      setCurrentVoice(foundVoice || null)
    } else {
      setCurrentVoice(voice)
    }
  }, [voices])

  // Stop current speech
  const stop = useCallback(() => {
    if (isSupported) {
      textToSpeech.stop()
      setIsSpeaking(false)
      setIsPaused(false)
      currentUtteranceRef.current = null
      queueRef.current = []
    }
  }, [isSupported])

  // Pause speech
  const pause = useCallback(() => {
    if (isSupported && isSpeaking && typeof window !== 'undefined') {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }, [isSupported, isSpeaking])

  // Resume speech
  const resume = useCallback(() => {
    if (isSupported && isPaused && typeof window !== 'undefined') {
      window.speechSynthesis.resume()
      setIsPaused(false)
    }
  }, [isSupported, isPaused])

  // Main speak function
  const speak = useCallback(async (
    text: string, 
    overrideOptions: Partial<VoiceSynthesisOptions> = {}
  ): Promise<void> => {
    if (!isSupported) {
      const error = 'Text-to-speech not supported in this browser'
      setError(error)
      onError?.(error)
      return
    }

    if (!text.trim()) {
      return
    }

    // Clear any previous errors
    setError(null)

    // Prepare options
    const speechOptions: VoiceSynthesisOptions = {
      text: text.trim(),
      language: targetLanguage.code,
      voice: overrideOptions.voice || currentVoice?.name || defaultVoice,
      rate: overrideOptions.rate ?? speechRate ?? defaultRate,
      pitch: overrideOptions.pitch ?? defaultPitch,
      volume: overrideOptions.volume ?? volume ?? defaultVolume,
      ...overrideOptions
    }

    try {
      // Stop any current speech
      if (isSpeaking) {
        stop()
      }

      setIsSpeaking(true)
      onStart?.()

      await textToSpeech.speak(speechOptions)

      setIsSpeaking(false)
      onEnd?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Speech synthesis failed'
      setError(errorMessage)
      setIsSpeaking(false)
      onError?.(errorMessage)
    }
  }, [
    isSupported,
    targetLanguage.code,
    currentVoice,
    speechRate,
    volume,
    defaultVoice,
    defaultRate,
    defaultPitch,
    isSpeaking,
    stop,
    onStart,
    onEnd,
    onError
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    currentVoice,
    setVoice,
    error
  }
}

/**
 * Auto Text-to-Speech Hook
 * Automatically speaks translated messages
 */
export function useAutoTextToSpeech() {
  const { messages, autoSpeak, targetLanguage } = useConversationStore()
  const lastProcessedMessageRef = useRef<string>('')
  
  const textToSpeech = useTextToSpeech({
    autoSpeak: true,
    onError: (error) => console.warn('Auto TTS error:', error)
  })

  // Auto-speak new translated messages
  useEffect(() => {
    if (!autoSpeak || !textToSpeech.isSupported) return

    const latestMessage = messages[messages.length - 1]
    
    if (
      latestMessage && 
      latestMessage.id !== lastProcessedMessageRef.current &&
      latestMessage.translatedContent &&
      latestMessage.userId === 'user' // Speak user's translations so they can hear the result
    ) {
      lastProcessedMessageRef.current = latestMessage.id
      console.log('🔊 Speaking translation:', latestMessage.translatedContent)
      textToSpeech.speak(latestMessage.translatedContent, {
        language: targetLanguage.code
      }).catch(error => {
        console.warn('Text-to-speech failed:', error)
      })
    }
  }, [messages, autoSpeak, targetLanguage.code, textToSpeech])

  return textToSpeech
}

/**
 * Speech Queue Hook
 * Manages a queue of text to be spoken
 */
export function useSpeechQueue() {
  const [queue, setQueue] = useState<Array<{ id: string; text: string; options?: Partial<VoiceSynthesisOptions> }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const textToSpeech = useTextToSpeech({
    onEnd: () => processNext()
  })

  const processNext = useCallback(() => {
    setQueue(current => {
      const next = current.slice(1)
      if (next.length === 0) {
        setIsProcessing(false)
      }
      return next
    })
  }, [])

  const addToQueue = useCallback((
    text: string, 
    options?: Partial<VoiceSynthesisOptions>
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    setQueue(current => [...current, { id, text, options }])
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setIsProcessing(false)
    textToSpeech.stop()
  }, [textToSpeech])

  // Process queue
  useEffect(() => {
    if (queue.length > 0 && !isProcessing && !textToSpeech.isSpeaking) {
      setIsProcessing(true)
      const current = queue[0]
      textToSpeech.speak(current.text, current.options)
    }
  }, [queue, isProcessing, textToSpeech])

  return {
    ...textToSpeech,
    queue,
    queueLength: queue.length,
    addToQueue,
    clearQueue,
    isProcessing
  }
}
