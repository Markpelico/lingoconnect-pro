/**
 * Enterprise AI Services Integration
 * Supports multiple AI providers for translation and speech processing
 */

import OpenAI from 'openai'
import type { 
  TranslationRequest, 
  TranslationResponse, 
  SpeechRecognitionResult,
  VoiceSynthesisOptions 
} from '@/types'

// Initialize OpenAI client only when needed
let openai: OpenAI | null = null

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

/**
 * OpenAI GPT-4 Translation Service
 * Provides context-aware, culturally sensitive translations
 */
export class OpenAITranslationService {
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const client = getOpenAIClient()
      if (!client) {
        throw new Error('OpenAI API key not configured')
      }

      const systemPrompt = `You are a professional translator with expertise in cultural nuances and context. 
Translate the following text from ${this.getLanguageName(request.from)} to ${this.getLanguageName(request.to)}.
Maintain the tone, cultural context, and any informal expressions appropriately.
Provide only the translation without explanations.`

      const userPrompt = `Text to translate: "${request.text}"
${request.context ? `Context: ${request.context}` : ''}`

      const completion = await client.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      })

      const translatedText = completion.choices[0]?.message?.content?.trim() || ''
      
      return {
        translatedText,
        confidence: 0.95, // GPT-4 typically has high confidence
        detectedLanguage: request.from,
        alternatives: [] // Could be enhanced with multiple translations
      }
    } catch (error) {
      console.error('OpenAI translation error:', error)
      throw new Error('Translation service unavailable')
    }
  }

  /**
   * Advanced context-aware translation with conversation history
   */
  async translateWithContext(
    request: TranslationRequest, 
    conversationHistory: string[] = []
  ): Promise<TranslationResponse> {
    try {
      const client = getOpenAIClient()
      if (!client) {
        throw new Error('OpenAI API key not configured')
      }

      const systemPrompt = `You are an expert translator specializing in real-time conversation translation.
Translate from ${this.getLanguageName(request.from)} to ${this.getLanguageName(request.to)}.
Consider the conversation context and maintain natural flow.
Preserve informal language, slang, and cultural expressions appropriately.`

      const contextPrompt = conversationHistory.length > 0 
        ? `\nConversation context:\n${conversationHistory.slice(-3).join('\n')}\n\n`
        : ''

      const userPrompt = `${contextPrompt}Current message to translate: "${request.text}"`

      const completion = await client.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 800,
      })

      const translatedText = completion.choices[0]?.message?.content?.trim() || ''
      
      return {
        translatedText,
        confidence: 0.92,
        detectedLanguage: request.from,
        alternatives: []
      }
    } catch (error) {
      console.error('OpenAI context translation error:', error)
      throw new Error('Context translation service unavailable')
    }
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'ru': 'Russian',
    }
    return languages[code] || code
  }
}

/**
 * Google Translate Service (Fallback)
 * Enterprise-grade translation API with high availability
 */
export class GoogleTranslateService {
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const response = await fetch('/api/translate/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error('Google Translate API error')
      }

      return await response.json()
    } catch (error) {
      console.error('Google Translate error:', error)
      throw new Error('Google translation service unavailable')
    }
  }
}

/**
 * Browser Speech Recognition Service
 * Uses Web Speech API with enhanced error handling
 */
export class SpeechRecognitionService {
  private recognition: any | null = null
  private isListening = false

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition()
        this.setupRecognition()
      }
    }
  }

  private setupRecognition() {
    if (!this.recognition) return

    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 3
  }

  async startListening(
    language: string,
    onResult: (result: SpeechRecognitionResult) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.recognition) {
      onError('Speech recognition not supported in this browser')
      return
    }

    if (this.isListening) {
      this.stopListening()
    }

    this.recognition.lang = language
    this.isListening = true

    this.recognition.onresult = (event) => {
      const lastResultIndex = event.results.length - 1
      const result = event.results[lastResultIndex]
      
      if (result) {
        const transcript = result[0].transcript
        const confidence = result[0].confidence || 0.8
        const isFinal = result.isFinal
        
        const alternatives = Array.from(result).map((alt, index) => ({
          transcript: alt.transcript,
          confidence: alt.confidence || (0.8 - index * 0.1)
        }))

        onResult({
          transcript,
          confidence,
          isFinal,
          alternatives
        })
      }
    }

    this.recognition.onerror = (event) => {
      this.isListening = false
      onError(`Speech recognition error: ${event.error}`)
    }

    this.recognition.onend = () => {
      this.isListening = false
    }

    try {
      this.recognition.start()
    } catch (error) {
      this.isListening = false
      onError('Failed to start speech recognition')
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  isSupported(): boolean {
    return !!this.recognition
  }

  getIsListening(): boolean {
    return this.isListening
  }
}

/**
 * Text-to-Speech Service
 * Enhanced browser speech synthesis with voice selection
 */
export class TextToSpeechService {
  private synth: any | null = null
  private voices: any[] = []

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = (window as any).speechSynthesis
      this.loadVoices()
    }
  }

  private loadVoices() {
    if (!this.synth) return

    const loadVoicesImpl = () => {
      this.voices = this.synth!.getVoices()
    }

    loadVoicesImpl()
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoicesImpl
    }
  }

  async speak(options: VoiceSynthesisOptions): Promise<void> {
    if (!this.synth) {
      throw new Error('Text-to-speech not supported')
    }

    return new Promise((resolve, reject) => {
      const utterance = new (window as any).SpeechSynthesisUtterance(options.text)
      
      // Find appropriate voice for language
      const voice = this.findVoiceForLanguage(options.language, options.voice)
      if (voice) utterance.voice = voice

      utterance.rate = options.rate || 1.0
      utterance.pitch = options.pitch || 1.0
      utterance.volume = options.volume || 1.0

      utterance.onend = () => resolve()
      utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`))

      this.synth.speak(utterance)
    })
  }

  private findVoiceForLanguage(language: string, preferredVoice?: string): any | null {
    const langCode = language.split('-')[0]
    
    // First try to find the preferred voice
    if (preferredVoice) {
      const voice = this.voices.find(v => v.name === preferredVoice && v.lang.startsWith(langCode))
      if (voice) return voice
    }

    // Find any voice for the language
    return this.voices.find(v => v.lang.startsWith(langCode)) || null
  }

  getAvailableVoices(language?: string): any[] {
    if (!language) return this.voices
    
    const langCode = language.split('-')[0]
    return this.voices.filter(v => v.lang.startsWith(langCode))
  }

  isSupported(): boolean {
    return !!this.synth
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel()
    }
  }
}

/**
 * Translation Service Manager
 * Manages multiple translation providers with fallback
 */
export class TranslationServiceManager {
  private openaiService = new OpenAITranslationService()
  private googleService = new GoogleTranslateService()

  async translate(
    request: TranslationRequest, 
    preferredProvider: 'openai' | 'google' = 'openai'
  ): Promise<TranslationResponse> {
    try {
      if (preferredProvider === 'openai') {
        return await this.openaiService.translateText(request)
      } else {
        return await this.googleService.translateText(request)
      }
    } catch (error) {
      console.warn(`Primary translation service failed, trying fallback...`)
      
      // Try fallback service
      try {
        if (preferredProvider === 'openai') {
          return await this.googleService.translateText(request)
        } else {
          return await this.openaiService.translateText(request)
        }
      } catch (fallbackError) {
        console.error('All translation services failed:', fallbackError)
        throw new Error('Translation services unavailable')
      }
    }
  }

  async translateWithContext(
    request: TranslationRequest,
    conversationHistory: string[] = []
  ): Promise<TranslationResponse> {
    try {
      return await this.openaiService.translateWithContext(request, conversationHistory)
    } catch (error) {
      console.warn('Context translation failed, falling back to basic translation...')
      return await this.translate(request)
    }
  }
}

// Export service instances
export const translationManager = new TranslationServiceManager()
export const speechRecognition = new SpeechRecognitionService()
export const textToSpeech = new TextToSpeechService()

// Export individual services for testing and advanced usage
// Note: Services are already exported above as classes
