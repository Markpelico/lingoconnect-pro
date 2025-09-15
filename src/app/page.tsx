'use client'

import { useState, useEffect } from 'react'
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
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConversationStore } from '@/store/conversation'
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
            >
              Start Conversation
              <MessageCircle className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="xl" 
              variant="outline"
              className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
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
    isListening, 
    speechResult, 
    speechError,
    autoSpeak,
    startListening,
    stopListening,
    updateSettings 
  } = useConversationStore()
  
  const [isRecording, setIsRecording] = useState(false)

  const handleMicToggle = () => {
    if (isListening) {
      stopListening()
      setIsRecording(false)
    } else {
      startListening()
      setIsRecording(true)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mx-auto max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-gray-900"
    >
      {/* Chat Messages Area */}
      <div className="h-96 overflow-y-auto border-b border-gray-200 p-6 dark:border-gray-700">
        <AnimatePresence>
          {speechResult ? (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20"
            >
              <div className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                You said:
              </div>
              <div className="text-gray-900 dark:text-white">
                {speechResult.transcript}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Confidence: {Math.round(speechResult.confidence * 100)}%
              </div>
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Mic className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg">Start speaking to see real-time translation</p>
              </div>
            </div>
          )}
        </AnimatePresence>
        
        {speechError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200"
          >
            {speechError}
          </motion.div>
        )}
      </div>
      
      {/* Controls */}
      <div className="p-6">
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={handleMicToggle}
            variant={isRecording ? "danger" : "success"}
            size="xl"
            className={cn(
              "h-16 w-16 rounded-full transition-all duration-300",
              isRecording && "animate-pulse shadow-lg shadow-red-500/50"
            )}
          >
            {isRecording ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
          
          <Button
            onClick={() => updateSettings({ autoSpeak: !autoSpeak })}
            variant={autoSpeak ? "default" : "outline"}
            size="lg"
          >
            {autoSpeak ? (
              <Volume2 className="mr-2 h-5 w-5" />
            ) : (
              <VolumeX className="mr-2 h-5 w-5" />
            )}
            Auto-speak
          </Button>
          
          <Button variant="outline" size="lg">
            <Settings className="mr-2 h-5 w-5" />
            Settings
          </Button>
        </div>
        
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {isRecording ? "Listening..." : "Click the microphone to start"}
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
    </div>
  )
}