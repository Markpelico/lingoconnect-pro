/**
 * Enhanced Speech Recognition Service
 * Improved accuracy, intuitive controls, and voice activity detection
 */

import { debounce } from '@/lib/utils'

export interface EnhancedSpeechConfig {
  language: string
  continuous?: boolean
  interimResults?: boolean
  confidenceThreshold?: number
  autoStopTimeout?: number
  noSpeechTimeout?: number
  maxRetries?: number
}

export interface SpeechResult {
  transcript: string
  confidence: number
  isFinal: boolean
  alternatives: Array<{ transcript: string; confidence: number }>
  timestamp: Date
}

interface VoiceActivityState {
  isActive: boolean
  lastActivity: number
  silenceDuration: number
}

export class EnhancedSpeechRecognition {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private isSupported = false
  private config: Required<EnhancedSpeechConfig>
  private voiceActivity: VoiceActivityState = {
    isActive: false,
    lastActivity: 0,
    silenceDuration: 0
  }
  
  private onResult?: (result: SpeechResult) => void
  private onError?: (error: string) => void
  private onVoiceActivity?: (isActive: boolean) => void
  private onStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'error') => void
  
  private autoStopTimer?: ReturnType<typeof setTimeout>
  private noSpeechTimer?: ReturnType<typeof setTimeout>
  private retryCount = 0

  constructor(config: EnhancedSpeechConfig) {
    this.config = {
      continuous: true,
      interimResults: true,
      confidenceThreshold: 0.7,
      autoStopTimeout: 30000, // 30 seconds
      noSpeechTimeout: 5000,   // 5 seconds of silence
      maxRetries: 3,
      ...config
    }

    this.initializeRecognition()
  }

  private initializeRecognition() {
    if (typeof window === 'undefined') return

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition
    
    if (!SpeechRecognitionCtor) {
      console.warn('Speech recognition not supported')
      this.isSupported = false
      return
    }

    this.recognition = new SpeechRecognitionCtor()
    this.isSupported = true
    
    // Enhanced configuration for maximum accuracy
    this.recognition.continuous = this.config.continuous
    this.recognition.interimResults = this.config.interimResults
    this.recognition.lang = this.config.language
    this.recognition.maxAlternatives = 5
    
    // Additional accuracy improvements
    if ('webkitSpeechRecognition' in window) {
      // Chrome-specific optimizations
      try {
        this.recognition.serviceURI = 'wss://www.google.com/speech-api/v2/recognize'
      } catch {
        // serviceURI is not writable in every Chrome build.
      }
    }

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    if (!this.recognition) return

    this.recognition.onstart = () => {
      this.isListening = true
      this.retryCount = 0
      this.onStatusChange?.('listening')
      this.startAutoStopTimer()
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.onStatusChange?.('processing')
      this.resetNoSpeechTimer()
      
      const lastResultIndex = event.results.length - 1
      const result = event.results[lastResultIndex]
      
      if (result) {
        const transcript = result[0].transcript.trim()
        const confidence = result[0].confidence || 0.8
        const isFinal = result.isFinal

        // Voice activity detection
        if (transcript.length > 0) {
          this.updateVoiceActivity(true)
        }

        // Filter by confidence threshold
        if (confidence >= this.config.confidenceThreshold || !isFinal) {
          const alternatives = Array.from(
            result as unknown as ArrayLike<SpeechRecognitionAlternative>
          )
            .slice(0, 5)
            .map((alt, index) => ({
              transcript: alt.transcript.trim(),
              confidence: alt.confidence || (0.9 - index * 0.1)
            }))
            .filter(alt => alt.confidence >= this.config.confidenceThreshold)

          this.onResult?.({
            transcript,
            confidence,
            isFinal,
            alternatives,
            timestamp: new Date()
          })

          // Auto-stop after final result if short speech
          if (isFinal && transcript.length < 100) {
            this.startNoSpeechTimer()
          }
        }
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      this.isListening = false
      this.onStatusChange?.('error')
      
      // Smart error handling with auto-retry
      const errorMessage = this.getErrorMessage(event.error)
      
      if (this.shouldRetry(event.error)) {
        this.retryCount++
        if (this.retryCount <= this.config.maxRetries) {
          setTimeout(() => this.restart(), 1000)
          return
        }
      }
      
      this.onError?.(errorMessage)
      this.cleanup()
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.onStatusChange?.('idle')
      this.updateVoiceActivity(false)
      this.cleanup()
    }

    // Voice activity detection with silence detection
    this.recognition.onspeechstart = () => {
      this.updateVoiceActivity(true)
      this.resetNoSpeechTimer()
    }

    this.recognition.onspeechend = () => {
      this.updateVoiceActivity(false)
      this.startNoSpeechTimer()
    }

    this.recognition.onnomatch = () => {
      this.startNoSpeechTimer()
    }
  }

  private getErrorMessage(error: string): string {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Please try speaking again.'
      case 'audio-capture':
        return 'Microphone not accessible. Please check permissions.'
      case 'not-allowed':
        return 'Microphone permission denied. Please allow microphone access.'
      case 'network':
        return 'Network error. Please check your connection.'
      case 'aborted':
        return 'Speech recognition was stopped.'
      case 'bad-grammar':
        return 'Speech recognition grammar error.'
      case 'language-not-supported':
        return 'Selected language not supported.'
      default:
        return `Speech recognition error: ${error}`
    }
  }

  private shouldRetry(error: string): boolean {
    return ['no-speech', 'audio-capture', 'network'].includes(error)
  }

  private updateVoiceActivity(isActive: boolean) {
    const now = Date.now()
    
    if (isActive !== this.voiceActivity.isActive) {
      this.voiceActivity.isActive = isActive
      this.voiceActivity.lastActivity = now
      this.onVoiceActivity?.(isActive)
    }
    
    if (isActive) {
      this.voiceActivity.lastActivity = now
      this.voiceActivity.silenceDuration = 0
    } else {
      this.voiceActivity.silenceDuration = now - this.voiceActivity.lastActivity
    }
  }

  private startAutoStopTimer() {
    this.clearAutoStopTimer()
    this.autoStopTimer = setTimeout(() => {
      this.stopListening()
    }, this.config.autoStopTimeout)
  }

  private clearAutoStopTimer() {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer)
      this.autoStopTimer = undefined
    }
  }

  private startNoSpeechTimer() {
    this.clearNoSpeechTimer()
    this.noSpeechTimer = setTimeout(() => {
      this.stopListening()
    }, this.config.noSpeechTimeout)
  }

  private resetNoSpeechTimer() {
    this.clearNoSpeechTimer()
    this.startNoSpeechTimer()
  }

  private clearNoSpeechTimer() {
    if (this.noSpeechTimer) {
      clearTimeout(this.noSpeechTimer)
      this.noSpeechTimer = undefined
    }
  }

  private cleanup() {
    this.clearAutoStopTimer()
    this.clearNoSpeechTimer()
  }

  // Public API methods
  /**
   * Resume after a recoverable error, reusing the handlers the caller already
   * registered. The public startListening() requires them as arguments, which
   * the retry path has no access to.
   */
  private restart() {
    if (!this.onResult || !this.onError) return
    this.startListening(
      this.onResult,
      this.onError,
      this.onVoiceActivity,
      this.onStatusChange
    )
  }

  public startListening(
    onResult: (result: SpeechResult) => void,
    onError: (error: string) => void,
    onVoiceActivity?: (isActive: boolean) => void,
    onStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'error') => void
  ) {
    if (!this.isSupported) {
      onError('Speech recognition not supported in this browser')
      return
    }

    if (this.isListening) {
      this.stopListening()
    }

    this.onResult = onResult
    this.onError = onError
    this.onVoiceActivity = onVoiceActivity
    this.onStatusChange = onStatusChange

    if (!this.recognition) {
      onError('Speech recognition is not available')
      return
    }

    try {
      this.recognition.start()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition'
      onError(errorMessage)
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
    this.cleanup()
  }

  public isCurrentlyListening(): boolean {
    return this.isListening
  }

  public isSpeechSupported(): boolean {
    return this.isSupported
  }

  public updateLanguage(language: string) {
    const wasListening = this.isListening
    if (wasListening) {
      this.stopListening()
    }
    
    this.config.language = language
    if (this.recognition) {
      this.recognition.lang = language
    }
    
    // Don't auto-restart to avoid unwanted activation
  }

  public getVoiceActivity(): VoiceActivityState {
    return { ...this.voiceActivity }
  }

  public updateConfig(newConfig: Partial<EnhancedSpeechConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  public destroy() {
    this.stopListening()
    this.onResult = undefined
    this.onError = undefined
    this.onVoiceActivity = undefined
    this.onStatusChange = undefined
  }
}

// Singleton instance with debounced controls
let enhancedSpeechInstance: EnhancedSpeechRecognition | null = null

export function getEnhancedSpeechRecognition(config: EnhancedSpeechConfig): EnhancedSpeechRecognition {
  if (!enhancedSpeechInstance || enhancedSpeechInstance.isSpeechSupported() === false) {
    enhancedSpeechInstance = new EnhancedSpeechRecognition(config)
  } else {
    enhancedSpeechInstance.updateConfig(config)
  }
  
  return enhancedSpeechInstance
}

// Debounced start/stop functions for better UX
export const debouncedStart = debounce((
  speechRecognition: EnhancedSpeechRecognition,
  onResult: (result: SpeechResult) => void,
  onError: (error: string) => void,
  onVoiceActivity?: (isActive: boolean) => void,
  onStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'error') => void
) => {
  speechRecognition.startListening(onResult, onError, onVoiceActivity, onStatusChange)
}, 300)

export const debouncedStop = debounce((speechRecognition: EnhancedSpeechRecognition) => {
  speechRecognition.stopListening()
}, 200)
