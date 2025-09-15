/**
 * Enhanced Speech Recognition Hook
 * Improved accuracy, intuitive controls, and better UX
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useConversationStore } from '@/store/conversation'
import { getEnhancedSpeechRecognition, debouncedStart, debouncedStop } from '@/lib/enhanced-speech'
import type { SpeechResult } from '@/lib/enhanced-speech'

type SpeechStatus = 'idle' | 'listening' | 'processing' | 'error'

interface UseEnhancedSpeechReturn {
  // Core functionality
  isListening: boolean
  isSupported: boolean
  status: SpeechStatus
  
  // Speech results
  transcript: string
  interimTranscript: string
  confidence: number
  alternatives: Array<{ transcript: string; confidence: number }>
  
  // Voice activity
  isVoiceActive: boolean
  silenceDuration: number
  
  // Controls (intuitive and responsive)
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  resetTranscript: () => void
  
  // Error handling
  error: string | null
  clearError: () => void
  
  // Translation integration
  isTranslating: boolean
  translationError: string | null
}

export function useEnhancedSpeech(): UseEnhancedSpeechReturn {
  const {
    sourceLanguage,
    targetLanguage,
    autoTranslate,
    addMessage
  } = useConversationStore()

  // Core state
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [alternatives, setAlternatives] = useState<Array<{ transcript: string; confidence: number }>>([])
  
  // Voice activity state
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [silenceDuration, setSilenceDuration] = useState(0)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Translation state
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)

  // Refs
  const speechRecognitionRef = useRef<ReturnType<typeof getEnhancedSpeechRecognition> | null>(null)
  const finalTranscriptRef = useRef('')
  const voiceActivityTimerRef = useRef<NodeJS.Timeout>()

  // Initialize speech recognition
  useEffect(() => {
    speechRecognitionRef.current = getEnhancedSpeechRecognition({
      language: sourceLanguage.code,
      continuous: true,
      interimResults: true,
      confidenceThreshold: 0.6, // Lower threshold for better capture
      autoStopTimeout: 45000,    // Longer timeout
      noSpeechTimeout: 4000,     // Shorter silence timeout
      maxRetries: 3
    })

    return () => {
      speechRecognitionRef.current?.destroy()
    }
  }, [sourceLanguage.code])

  // Handle speech results
  const handleResult = useCallback((result: SpeechResult) => {
    console.log('🎤 Speech result:', { 
      transcript: result.transcript, 
      confidence: result.confidence, 
      isFinal: result.isFinal 
    })

    setConfidence(result.confidence)
    setAlternatives(result.alternatives)

    if (result.isFinal) {
      // Final result - add to accumulated transcript
      const newText = result.transcript.trim()
      if (newText.length > 0) {
        const fullTranscript = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + newText
        finalTranscriptRef.current = fullTranscript
        setTranscript(fullTranscript)
        setInterimTranscript('')

        // Auto-translate if enabled
        if (autoTranslate && newText.length > 0) {
          handleTranslation(newText)
        }
      }
    } else {
      // Interim result
      setInterimTranscript(result.transcript)
    }
  }, [autoTranslate])

  // Handle translation
  const handleTranslation = useCallback(async (text: string) => {
    // Always add the original message first
    const messageId = Date.now().toString()
    addMessage({
      id: messageId,
      content: text,
      language: sourceLanguage.code,
      targetLanguage: targetLanguage.code,
      timestamp: new Date(),
      userId: 'user',
      type: 'text',
      confidence
    })

    // Only translate if languages are different
    if (sourceLanguage.code === targetLanguage.code) {
      return
    }

    setIsTranslating(true)
    setTranslationError(null)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          from: sourceLanguage.code.split('-')[0],
          to: targetLanguage.code.split('-')[0]
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update message with translation
        const store = useConversationStore.getState()
        store.updateMessage(messageId, {
          translatedContent: result.data.translatedText,
          confidence: result.data.confidence
        })
      } else {
        throw new Error(result.error?.message || 'Translation failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed'
      console.error('❌ Translation error:', errorMessage)
      setTranslationError(errorMessage)
    } finally {
      setIsTranslating(false)
    }
  }, [sourceLanguage, targetLanguage, addMessage, confidence])

  // Handle speech errors
  const handleError = useCallback((errorMessage: string) => {
    console.error('🚨 Speech error:', errorMessage)
    setError(errorMessage)
    setIsListening(false)
    setStatus('error')
  }, [])

  // Handle voice activity
  const handleVoiceActivity = useCallback((isActive: boolean) => {
    setIsVoiceActive(isActive)
    
    // Update silence duration
    if (voiceActivityTimerRef.current) {
      clearInterval(voiceActivityTimerRef.current)
    }
    
    if (!isActive) {
      const startTime = Date.now()
      voiceActivityTimerRef.current = setInterval(() => {
        setSilenceDuration(Date.now() - startTime)
      }, 100)
    } else {
      setSilenceDuration(0)
    }
  }, [])

  // Handle status changes
  const handleStatusChange = useCallback((newStatus: SpeechStatus) => {
    setStatus(newStatus)
    if (newStatus === 'listening') {
      setIsListening(true)
    } else if (newStatus === 'idle' || newStatus === 'error') {
      setIsListening(false)
    }
  }, [])

  // Start listening (with debouncing)
  const startListening = useCallback(() => {
    if (!speechRecognitionRef.current?.isSpeechSupported()) {
      setError('Speech recognition not supported in this browser')
      return
    }

    console.log('🎤 Starting enhanced speech recognition...')
    setError(null)
    setTranslationError(null)
    
    debouncedStart(
      speechRecognitionRef.current,
      handleResult,
      handleError,
      handleVoiceActivity,
      handleStatusChange
    )
  }, [handleResult, handleError, handleVoiceActivity, handleStatusChange])

  // Stop listening (with debouncing)
  const stopListening = useCallback(() => {
    if (!speechRecognitionRef.current) return
    
    console.log('🛑 Stopping enhanced speech recognition...')
    debouncedStop(speechRecognitionRef.current)
    
    // Clean up voice activity timer
    if (voiceActivityTimerRef.current) {
      clearInterval(voiceActivityTimerRef.current)
      voiceActivityTimerRef.current = undefined
    }
    setSilenceDuration(0)
  }, [])

  // Toggle listening (intuitive control)
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setConfidence(0)
    setAlternatives([])
    finalTranscriptRef.current = ''
    console.log('🗑️ Transcript reset')
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
    setTranslationError(null)
  }, [])

  // Update language when source language changes
  useEffect(() => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.updateLanguage(sourceLanguage.code)
    }
  }, [sourceLanguage.code])

  // Auto-stop when language changes (if listening)
  useEffect(() => {
    if (isListening) {
      console.log('🔄 Language changed, stopping speech recognition')
      stopListening()
    }
  }, [sourceLanguage.code]) // Don't include stopListening to avoid infinite loop

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceActivityTimerRef.current) {
        clearInterval(voiceActivityTimerRef.current)
      }
      speechRecognitionRef.current?.destroy()
    }
  }, [])

  const isSupported = speechRecognitionRef.current?.isSpeechSupported() ?? false

  return {
    // Core functionality
    isListening,
    isSupported,
    status,
    
    // Speech results
    transcript,
    interimTranscript,
    confidence,
    alternatives,
    
    // Voice activity
    isVoiceActive,
    silenceDuration,
    
    // Controls
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    
    // Error handling
    error,
    clearError,
    
    // Translation integration
    isTranslating,
    translationError
  }
}
