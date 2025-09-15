'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ArrowLeftRight, 
  Settings,
  Users,
  MessageCircle,
  Globe,
  Zap,
  Shield,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConversationStore } from '@/store/conversation'
import { useSpeechRecognitionWithTranslation } from '@/hooks/useSpeechRecognition'
import { useAutoTextToSpeech } from '@/hooks/useTextToSpeech'
import { cn } from '@/lib/utils'

// Hero Section Component
const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white">
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      
      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-3 rounded-full bg-white/10 px-6 py-3 backdrop-blur-lg"
          >
            <Sparkles className="h-5 w-5 text-yellow-300" />
            <span className="text-sm font-medium">Powered by Enterprise AI</span>
          </motion.div>
          
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-7xl">
            LingoConnect
            <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              {" "}Pro
            </span>
          </h1>
          
          <p className="mb-10 text-xl leading-8 text-blue-100 sm:text-2xl">
            Break language barriers with AI-powered real-time translation. 
            Connect, communicate, and collaborate across cultures seamlessly.
          </p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col gap-4 sm:flex-row sm:justify-center"
          >
            <Button 
              size="xl" 
              variant="gradient"
              className="text-lg shadow-2xl shadow-blue-500/25"
              onClick={() => {
                // Scroll to conversation interface
                const conversationElement = document.querySelector('.conversation-interface')
                if (conversationElement) {
                  conversationElement.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              Start Conversation
              <MessageCircle className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="xl" 
              variant="outline"
              className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              onClick={() => {
                // Scroll to the conversation interface for demo
                const conversationElement = document.querySelector('.conversation-interface')
                if (conversationElement) {
                  conversationElement.scrollIntoView({ behavior: 'smooth' })
                  // Show a helpful demo message
                  setTimeout(() => {
                    alert('🎬 Demo Instructions:\n\n1. Click the green microphone button\n2. Say "Hello" or "Thank you"\n3. Watch it translate to Spanish automatically\n4. Hear the translation spoken aloud!\n\nTry it now! 🎤')
                  }, 1000)
                } else {
                  // Fallback: scroll to main content
                  window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
                }
              }}
            >
              Watch Demo
              <Volume2 className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
        
        {/* Floating Elements */}
        <div className="absolute left-10 top-20 hidden lg:block">
          <motion.div
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-full bg-white/10 p-4 backdrop-blur-lg"
          >
            <Globe className="h-8 w-8 text-blue-200" />
          </motion.div>
        </div>
        
        <div className="absolute right-10 top-32 hidden lg:block">
          <motion.div
            animate={{ y: [10, -10, 10] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-full bg-white/10 p-4 backdrop-blur-lg"
          >
            <Zap className="h-8 w-8 text-yellow-200" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// Language Selector Component
const LanguageSelector = () => {
  const { 
    sourceLanguage, 
    targetLanguage, 
    supportedLanguages,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages 
  } = useConversationStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900"
    >
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
        Choose Your Languages
      </h2>
      
      <div className="flex flex-col items-center gap-6 lg:flex-row">
        {/* Source Language */}
        <div className="flex-1">
          <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
            I speak:
          </label>
          <select
            value={sourceLanguage.code}
            onChange={(e) => {
              const language = supportedLanguages.find(l => l.code === e.target.value)
              if (language) setSourceLanguage(language)
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Swap Button */}
        <div className="flex items-end pb-3">
          <Button
            onClick={swapLanguages}
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full transition-transform hover:scale-110"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Target Language */}
        <div className="flex-1">
          <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Translate to:
          </label>
          <select
            value={targetLanguage.code.split('-')[0]} // Convert speech code to translation code
            onChange={(e) => {
              const language = supportedLanguages.find(l => l.code.startsWith(e.target.value))
              if (language) setTargetLanguage(language)
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code.split('-')[0]}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  )
}

// Conversation Interface Component
const ConversationInterface = () => {
  const { 
    messages,
    autoSpeak,
    updateSettings 
  } = useConversationStore()
  
  // Enhanced speech recognition with auto-translation
  const {
    isListening,
    isSupported: speechSupported,
    transcript,
    interimTranscript,
    confidence,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
    isTranslating,
    translationError
  } = useSpeechRecognitionWithTranslation()
  
  // Text-to-speech for auto-speaking translations
  const {
    isSpeaking,
    isSupported: ttsSupported,
    error: ttsError
  } = useAutoTextToSpeech()

  const handleMicToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="conversation-interface mx-auto max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-gray-900"
    >
      {/* Chat Messages Area */}
      <div className="h-96 overflow-y-auto border-b border-gray-200 p-6 dark:border-gray-700">
        <AnimatePresence>
          {messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    "rounded-lg p-4 max-w-[80%]",
                    message.userId === 'user' 
                      ? "ml-auto bg-blue-500 text-white" 
                      : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                  )}
                >
                  <div className="mb-2 text-sm opacity-75">
                    {message.userId === 'user' ? 'You' : 'Assistant'} • {message.language}
                  </div>
                  
                  {/* Original text */}
                  <div className="mb-2 font-medium">
                    {message.content}
                  </div>
                  
                  {/* Translation */}
                  {message.translatedContent && (
                    <div className="border-t border-white/20 pt-2 text-sm opacity-90">
                      <div className="mb-1 text-xs uppercase tracking-wide">
                        Translation ({message.targetLanguage}):
                      </div>
                      <div>{message.translatedContent}</div>
                    </div>
                  )}
                  
                  {/* Confidence score */}
                  {message.confidence && (
                    <div className="mt-2 flex items-center gap-2 text-xs opacity-75">
                      <CheckCircle className="h-3 w-3" />
                      {Math.round(message.confidence * 100)}% confidence
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Mic className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg mb-2">Start speaking to see real-time translation</p>
                <p className="text-sm">
                  {speechSupported ? "Click the microphone and speak" : "Speech recognition not supported"}
                </p>
              </div>
            </div>
          )}
          
          {/* Current speech input */}
          {(transcript || interimTranscript) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-900/20"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                <Mic className={cn("h-4 w-4", isListening && "animate-pulse")} />
                Listening...
                {isTranslating && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              
              <div className="text-gray-900 dark:text-white">
                <span className="font-medium">{transcript}</span>
                <span className="opacity-60">{interimTranscript}</span>
              </div>
              
              {confidence > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Confidence: {Math.round(confidence * 100)}%
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Error States */}
        {(speechError || translationError || ttsError) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            {speechError && <div>Speech: {speechError}</div>}
            {translationError && <div>Translation: {translationError}</div>}
            {ttsError && <div>Text-to-Speech: {ttsError}</div>}
          </motion.div>
        )}
      </div>
      
      {/* Controls */}
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* Main Microphone Button */}
          <Button
            onClick={handleMicToggle}
            disabled={!speechSupported}
            variant={isListening ? "danger" : "success"}
            size="xl"
            className={cn(
              "h-16 w-16 rounded-full transition-all duration-300",
              isListening && "animate-pulse shadow-lg shadow-red-500/50",
              !speechSupported && "opacity-50 cursor-not-allowed"
            )}
          >
            {isListening ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
          
          {/* Auto-speak Toggle */}
          <Button
            onClick={() => updateSettings({ autoSpeak: !autoSpeak })}
            disabled={!ttsSupported}
            variant={autoSpeak ? "default" : "outline"}
            size="lg"
          >
            {isSpeaking ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : autoSpeak ? (
              <Volume2 className="mr-2 h-5 w-5" />
            ) : (
              <VolumeX className="mr-2 h-5 w-5" />
            )}
            Auto-speak {autoSpeak ? "ON" : "OFF"}
          </Button>
          
          {/* Clear Chat */}
          <Button 
            onClick={() => {
              console.log('🗑️ Clear button clicked')
              const store = useConversationStore.getState()
              store.clearMessages()
              resetTranscript()
            }}
            variant="outline" 
            size="lg"
            disabled={messages.length === 0}
          >
            <Trash2 className="mr-2 h-5 w-5" />
            Clear ({messages.length})
          </Button>
          
          {/* Settings */}
          <Button variant="outline" size="lg">
            <Settings className="mr-2 h-5 w-5" />
            Settings
          </Button>
        </div>
        
        {/* Status Display */}
        <div className="mt-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm">
            {isListening && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Listening</span>
              </div>
            )}
            {isTranslating && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Translating</span>
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Volume2 className="h-4 w-4" />
                <span>Speaking</span>
              </div>
            )}
            {!isListening && !isTranslating && !isSpeaking && (
              <div className="text-gray-500 dark:text-gray-400">
                {speechSupported ? "Ready to listen" : "Speech recognition not supported"}
              </div>
            )}
          </div>
          
          {/* Feature Support Indicators */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <div className={cn(
                "h-2 w-2 rounded-full",
                speechSupported ? "bg-green-500" : "bg-red-500"
              )} />
              Speech Recognition
            </div>
            <div className="flex items-center gap-1">
              <div className={cn(
                "h-2 w-2 rounded-full",
                ttsSupported ? "bg-green-500" : "bg-red-500"
              )} />
              Text-to-Speech
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              AI Translation
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Features Section Component
const FeaturesSection = () => {
  const features = [
    {
      icon: Zap,
      title: "Real-time Translation",
      description: "Instant AI-powered translation with sub-second latency"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "End-to-end encryption and enterprise-grade privacy"
    },
    {
      icon: Users,
      title: "Multi-user Support",
      description: "Group conversations with real-time translation for all"
    },
    {
      icon: Globe,
      title: "12+ Languages",
      description: "Support for major world languages with more coming"
    }
  ]

  return (
    <section className="bg-gray-50 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Enterprise-Grade Features
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Built with modern technologies for scalable, secure, and efficient communication
          </p>
        </motion.div>
        
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
              >
                <div className="mb-4 inline-flex rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
                  <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Main Page Component
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Professional Header */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-white" />
              <div>
                <h1 className="text-white font-bold text-lg">LingoConnect Pro</h1>
                <p className="text-white/70 text-xs">AI Language Exchange Platform</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-medium text-sm">Created by Mark Pelico</p>
              <p className="text-white/70 text-xs">Full-Stack Developer</p>
            </div>
          </div>
        </div>
      </header>
      
      <HeroSection />
      
      <main className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="space-y-24">
            <LanguageSelector />
            <ConversationInterface />
          </div>
        </div>
      </main>
      
      <FeaturesSection />
      
      {/* Professional Footer with Attribution */}
      <footer className="bg-gray-900 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <MessageCircle className="h-6 w-6 text-blue-400" />
              <span className="text-xl font-bold text-white">LingoConnect Pro</span>
            </div>
            
            <p className="text-gray-300">
              Enterprise AI Language Exchange Platform
            </p>
            
            <div className="border-t border-gray-700 pt-6 mt-6">
              <p className="text-gray-400 text-sm">
                &copy; 2025 LingoConnect Pro. Built with passion for connecting cultures.
              </p>
              <p className="text-gray-300 font-medium mt-2">
                Created by <span className="text-blue-400 font-semibold">Mark Pelico</span>
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <a 
                  href="https://github.com/Markpelico/lingoconnect-pro" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Source Code
                </a>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">
                  Full-Stack Developer Portfolio
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">
                  Next.js • TypeScript • AI Integration
                </span>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-800">
              <p>This application demonstrates enterprise-level full-stack development skills</p>
              <p>featuring real-time AI translation, speech recognition, and modern web technologies.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}