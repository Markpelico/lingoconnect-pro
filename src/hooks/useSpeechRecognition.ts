/**
 * Custom React Hook for Speech Recognition
 * Enterprise-grade speech recognition with advanced features
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useConversationStore } from '@/store/conversation'
import { speechRecognition } from '@/lib/ai-services'
import type { SpeechRecognitionResult } from '@/types'

interface UseSpeechRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  autoRestart?: boolean
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  confidence: number
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  alternatives: Array<{ transcript: string; confidence: number }>
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    autoRestart = false,
    onTranscript,
    onError
  } = options

  // Zustand store integration
  const {
    sourceLanguage,
    isListening,
    speechResult,
    speechError,
    startListening: storeStartListening,
    stopListening: storeStopListening,
    setSpeechResult,
    setSpeechError
  } = useConversationStore()

  // Local state for transcript accumulation
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [alternatives, setAlternatives] = useState<Array<{ transcript: string; confidence: number }>>([])

  // Refs for cleanup and persistence
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if speech recognition is supported
  const isSupported = speechRecognition.isSupported()

  // Handle speech recognition results
  const handleResult = useCallback((result: SpeechRecognitionResult) => {
    setSpeechResult(result)
    setConfidence(result.confidence)
    setAlternatives(result.alternatives || [])

    if (result.isFinal) {
      // Final result - add to transcript
      setTranscript(prev => {
        const newTranscript = prev + (prev ? ' ' : '') + result.transcript
        onTranscript?.(newTranscript, true)
        return newTranscript
      })
      setInterimTranscript('')
      
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
        restartTimeoutRef.current = null
      }

      // Auto-restart if enabled and continuous
      if (autoRestart && continuous) {
        restartTimeoutRef.current = setTimeout(() => {
          if (!speechRecognition.getIsListening()) {
            startListening()
          }
        }, 100)
      }
    } else {
      // Interim result
      setInterimTranscript(result.transcript)
      onTranscript?.(result.transcript, false)
    }
  }, [setSpeechResult, onTranscript, autoRestart, continuous])

  // Handle speech recognition errors
  const handleError = useCallback((error: string) => {
    setSpeechError(error)
    onError?.(error)
    
    // Auto-restart on certain recoverable errors
    if (autoRestart && (
      error.includes('no-speech') || 
      error.includes('audio-capture') ||
      error.includes('network')
    )) {
      restartTimeoutRef.current = setTimeout(() => {
        startListening()
      }, 1000)
    }
  }, [setSpeechError, onError, autoRestart])

  // Start speech recognition
  const startListening = useCallback(() => {
    if (!isSupported) {
      handleError('Speech recognition not supported in this browser')
      return
    }

    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    // Update store state
    storeStartListening()
    setSpeechError(null)

    // Start the actual speech recognition
    speechRecognition.startListening(
      sourceLanguage.code,
      handleResult,
      handleError
    )

    // Set a timeout to prevent infinite listening
    timeoutRef.current = setTimeout(() => {
      stopListening()
    }, 30000) // 30 seconds max
  }, [
    isSupported, 
    sourceLanguage.code, 
    storeStartListening, 
    setSpeechError, 
    handleResult, 
    handleError
  ])

  // Stop speech recognition
  const stopListening = useCallback(() => {
    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    // Stop recognition
    speechRecognition.stopListening()
    storeStopListening()
  }, [storeStopListening])

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setConfidence(0)
    setAlternatives([])
    setSpeechResult(null)
    setSpeechError(null)
  }, [setSpeechResult, setSpeechError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
        restartTimeoutRef.current = null
      }
      speechRecognition.stopListening()
    }
  }, [])

  // Auto-stop when language changes
  useEffect(() => {
    if (isListening) {
      stopListening()
    }
  }, [sourceLanguage.code]) // Don't include isListening or stopListening to avoid infinite loop

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    confidence,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
    alternatives
  }
}

/**
 * Advanced Speech Recognition Hook with Auto-Translation
 * Automatically translates speech results
 */
export function useSpeechRecognitionWithTranslation() {
  const {
    sourceLanguage,
    targetLanguage,
    autoTranslate,
    addMessage
  } = useConversationStore()

  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)

  const speechRecognition = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    autoRestart: true,
    onTranscript: async (transcript, isFinal) => {
      if (isFinal && autoTranslate && transcript.trim()) {
        await handleTranslation(transcript)
      }
    }
  })

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
      type: 'text'
    })

    // Only translate if auto-translate is enabled and languages are different
    if (!autoTranslate || sourceLanguage.code === targetLanguage.code) {
      return
    }

    setIsTranslating(true)
    setTranslationError(null)

    try {
      console.log('Starting translation...', {
        text,
        from: sourceLanguage.code.split('-')[0],
        to: targetLanguage.code.split('-')[0]
      })

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          from: sourceLanguage.code.split('-')[0],
          to: targetLanguage.code.split('-')[0]
        })
      })

      console.log('Translation response status:', response.status)
      const result = await response.json()
      console.log('Translation result:', result)

      if (result.success) {
        // Update message with translation
        const store = useConversationStore.getState()
        store.updateMessage(messageId, {
          translatedContent: result.data.translatedText,
          confidence: result.data.confidence
        })
        console.log('✅ Translation added to message')
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
  }, [autoTranslate, sourceLanguage, targetLanguage, addMessage])

  return {
    ...speechRecognition,
    isTranslating,
    translationError,
    handleTranslation
  }
}

/**
 * Voice Commands Hook
 * Recognizes and handles voice commands
 */
export function useVoiceCommands() {
  const commands = useRef(new Map<string, () => void>())
  
  const speechRecognition = useSpeechRecognition({
    continuous: false,
    interimResults: false,
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        handleVoiceCommand(transcript.toLowerCase().trim())
      }
    }
  })

  const handleVoiceCommand = useCallback((command: string) => {
    for (const [pattern, handler] of commands.current) {
      if (command.includes(pattern.toLowerCase())) {
        handler()
        break
      }
    }
  }, [])

  const registerCommand = useCallback((pattern: string, handler: () => void) => {
    commands.current.set(pattern, handler)
  }, [])

  const unregisterCommand = useCallback((pattern: string) => {
    commands.current.delete(pattern)
  }, [])

  return {
    ...speechRecognition,
    registerCommand,
    unregisterCommand
  }
}
