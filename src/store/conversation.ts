import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { 
  Message, 
  User, 
  ConversationRoom, 
  SpeechRecognitionResult,
  TranslationResponse,
  Language
} from '@/types'

// Store interfaces
interface ConversationState {
  // Current conversation state
  currentRoom: ConversationRoom | null
  messages: Message[]
  participants: User[]
  isConnected: boolean
  
  // Language settings
  sourceLanguage: Language
  targetLanguage: Language
  supportedLanguages: Language[]
  
  // Speech recognition state
  isListening: boolean
  speechResult: SpeechRecognitionResult | null
  speechError: string | null
  
  // Translation state
  isTranslating: boolean
  translationQueue: string[]
  
  // UI state
  isTyping: boolean
  typingUsers: string[]
  sidebarOpen: boolean
  
  // Settings
  autoTranslate: boolean
  autoSpeak: boolean
  speechRate: number
  volume: number
}

interface ConversationActions {
  // Room management
  joinRoom: (room: ConversationRoom) => void
  leaveRoom: () => void
  updateRoom: (room: ConversationRoom) => void
  
  // Message management
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  deleteMessage: (messageId: string) => void
  clearMessages: () => void
  
  // Participant management
  addParticipant: (user: User) => void
  removeParticipant: (userId: string) => void
  updateParticipant: (userId: string, updates: Partial<User>) => void
  
  // Language management
  setSourceLanguage: (language: Language) => void
  setTargetLanguage: (language: Language) => void
  swapLanguages: () => void
  
  // Speech recognition
  startListening: () => void
  stopListening: () => void
  setSpeechResult: (result: SpeechRecognitionResult | null) => void
  setSpeechError: (error: string | null) => void
  
  // Translation
  startTranslation: (messageId: string) => void
  completeTranslation: (messageId: string, translation: TranslationResponse) => void
  setTranslating: (isTranslating: boolean) => void
  
  // Typing indicators
  setTyping: (isTyping: boolean) => void
  addTypingUser: (userId: string) => void
  removeTypingUser: (userId: string) => void
  
  // UI state
  setSidebarOpen: (open: boolean) => void
  setConnected: (connected: boolean) => void
  
  // Settings
  updateSettings: (settings: Partial<{
    autoTranslate: boolean
    autoSpeak: boolean
    speechRate: number
    volume: number
  }>) => void
  
  // Utilities
  reset: () => void
}

type ConversationStore = ConversationState & ConversationActions

// Default supported languages
const defaultLanguages: Language[] = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
]

// Initial state
const initialState: ConversationState = {
  currentRoom: null,
  messages: [],
  participants: [],
  isConnected: false,
  
  sourceLanguage: defaultLanguages[0], // English
  targetLanguage: defaultLanguages[1], // Spanish
  supportedLanguages: defaultLanguages,
  
  isListening: false,
  speechResult: null,
  speechError: null,
  
  isTranslating: false,
  translationQueue: [],
  
  isTyping: false,
  typingUsers: [],
  sidebarOpen: false,
  
  autoTranslate: true,
  autoSpeak: true,
  speechRate: 1.0,
  volume: 1.0,
}

// Create the store with middleware
export const useConversationStore = create<ConversationStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,
        
        // Room management
        joinRoom: (room) => set((state) => {
          state.currentRoom = room
          state.participants = room.participants
          state.isConnected = true
          state.messages = []
        }),
        
        leaveRoom: () => set((state) => {
          state.currentRoom = null
          state.participants = []
          state.isConnected = false
          state.messages = []
          state.typingUsers = []
        }),
        
        updateRoom: (room) => set((state) => {
          state.currentRoom = room
          state.participants = room.participants
        }),
        
        // Message management
        addMessage: (message) => set((state) => {
          state.messages.push(message)
          // Sort messages by timestamp
          state.messages.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        }),
        
        updateMessage: (messageId, updates) => set((state) => {
          const messageIndex = state.messages.findIndex(m => m.id === messageId)
          if (messageIndex !== -1) {
            Object.assign(state.messages[messageIndex], updates)
          }
        }),
        
        deleteMessage: (messageId) => set((state) => {
          state.messages = state.messages.filter(m => m.id !== messageId)
        }),
        
        clearMessages: () => set((state) => {
          state.messages = []
        }),
        
        // Participant management
        addParticipant: (user) => set((state) => {
          if (!state.participants.find(p => p.id === user.id)) {
            state.participants.push(user)
          }
        }),
        
        removeParticipant: (userId) => set((state) => {
          state.participants = state.participants.filter(p => p.id !== userId)
          state.typingUsers = state.typingUsers.filter(id => id !== userId)
        }),
        
        updateParticipant: (userId, updates) => set((state) => {
          const participantIndex = state.participants.findIndex(p => p.id === userId)
          if (participantIndex !== -1) {
            Object.assign(state.participants[participantIndex], updates)
          }
        }),
        
        // Language management
        setSourceLanguage: (language) => set((state) => {
          state.sourceLanguage = language
        }),
        
        setTargetLanguage: (language) => set((state) => {
          state.targetLanguage = language
        }),
        
        swapLanguages: () => set((state) => {
          const temp = state.sourceLanguage
          state.sourceLanguage = state.targetLanguage
          state.targetLanguage = temp
        }),
        
        // Speech recognition
        startListening: () => set((state) => {
          state.isListening = true
          state.speechError = null
        }),
        
        stopListening: () => set((state) => {
          state.isListening = false
        }),
        
        setSpeechResult: (result) => set((state) => {
          state.speechResult = result
        }),
        
        setSpeechError: (error) => set((state) => {
          state.speechError = error
          state.isListening = false
        }),
        
        // Translation
        startTranslation: (messageId) => set((state) => {
          if (!state.translationQueue.includes(messageId)) {
            state.translationQueue.push(messageId)
          }
          state.isTranslating = true
        }),
        
        completeTranslation: (messageId, translation) => set((state) => {
          // Remove from queue
          state.translationQueue = state.translationQueue.filter(id => id !== messageId)
          
          // Update message with translation
          const messageIndex = state.messages.findIndex(m => m.id === messageId)
          if (messageIndex !== -1) {
            state.messages[messageIndex].translatedContent = translation.translatedText
          }
          
          // Update translating state
          state.isTranslating = state.translationQueue.length > 0
        }),
        
        setTranslating: (isTranslating) => set((state) => {
          state.isTranslating = isTranslating
        }),
        
        // Typing indicators
        setTyping: (isTyping) => set((state) => {
          state.isTyping = isTyping
        }),
        
        addTypingUser: (userId) => set((state) => {
          if (!state.typingUsers.includes(userId)) {
            state.typingUsers.push(userId)
          }
        }),
        
        removeTypingUser: (userId) => set((state) => {
          state.typingUsers = state.typingUsers.filter(id => id !== userId)
        }),
        
        // UI state
        setSidebarOpen: (open) => set((state) => {
          state.sidebarOpen = open
        }),
        
        setConnected: (connected) => set((state) => {
          state.isConnected = connected
        }),
        
        // Settings
        updateSettings: (settings) => set((state) => {
          Object.assign(state, settings)
        }),
        
        // Utilities
        reset: () => set(() => ({ ...initialState })),
      })),
      {
        name: 'conversation-store',
        version: 1,
      }
    )
  )
)

// Computed selectors
export const useConversationSelectors = () => {
  const store = useConversationStore()
  
  return {
    // Get messages for current room
    getCurrentMessages: () => store.messages,
    
    // Get typing users with names
    getTypingUsersWithNames: () => 
      store.typingUsers.map(userId => 
        store.participants.find(p => p.id === userId)?.name || 'Unknown'
      ).filter(Boolean),
    
    // Check if user is in room
    isUserInRoom: (userId: string) => 
      store.participants.some(p => p.id === userId),
    
    // Get room participant count
    getParticipantCount: () => store.participants.length,
    
    // Check if translation is enabled
    shouldAutoTranslate: () => store.autoTranslate && store.currentRoom !== null,
    
    // Get current room info
    getRoomInfo: () => ({
      id: store.currentRoom?.id,
      name: store.currentRoom?.name,
      participantCount: store.participants.length,
      languages: store.currentRoom?.languages || [],
    }),
    
    // Get user language preferences
    getLanguagePreferences: () => ({
      source: store.sourceLanguage,
      target: store.targetLanguage,
      canSwap: store.sourceLanguage.code !== store.targetLanguage.code,
    }),
  }
}

// Middleware for persistence (optional)
export const persistConversationSettings = () => {
  return useConversationStore.subscribe(
    (state) => ({
      sourceLanguage: state.sourceLanguage,
      targetLanguage: state.targetLanguage,
      autoTranslate: state.autoTranslate,
      autoSpeak: state.autoSpeak,
      speechRate: state.speechRate,
      volume: state.volume,
    }),
    (settings) => {
      localStorage.setItem('lingoconnect-settings', JSON.stringify(settings))
    }
  )
}

// Load settings from localStorage
export const loadPersistedSettings = () => {
  if (typeof window === 'undefined') return
  
  try {
    const saved = localStorage.getItem('lingoconnect-settings')
    if (saved) {
      const settings = JSON.parse(saved)
      useConversationStore.getState().updateSettings(settings)
      
      // Update languages if they exist in supported languages
      const { supportedLanguages } = useConversationStore.getState()
      const sourceLanguage = supportedLanguages.find(l => l.code === settings.sourceLanguage?.code)
      const targetLanguage = supportedLanguages.find(l => l.code === settings.targetLanguage?.code)
      
      if (sourceLanguage) useConversationStore.getState().setSourceLanguage(sourceLanguage)
      if (targetLanguage) useConversationStore.getState().setTargetLanguage(targetLanguage)
    }
  } catch (error) {
    console.error('Failed to load persisted settings:', error)
  }
}
