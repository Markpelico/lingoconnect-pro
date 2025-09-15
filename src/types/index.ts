/**
 * Core application types and interfaces
 * Enterprise-grade TypeScript definitions
 */

// Language and Translation Types
export interface Language {
  code: string
  name: string
  flag: string
  rtl?: boolean
}

export interface TranslationRequest {
  text: string
  from: string
  to: string
  context?: string
}

export interface TranslationResponse {
  translatedText: string
  confidence: number
  detectedLanguage?: string
  alternatives?: string[]
}

// Speech Recognition Types
export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

export interface SpeechRecognitionConfig {
  language: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
}

// Voice Synthesis Types
export interface VoiceSynthesisOptions {
  text: string
  language: string
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
}

// Message Types
export interface Message {
  id: string
  content: string
  translatedContent?: string
  language: string
  targetLanguage?: string
  timestamp: Date
  userId: string
  type: 'text' | 'audio' | 'translation'
  confidence?: number
  isSystemMessage?: boolean
}

// User Types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  nativeLanguages: string[]
  learningLanguages: string[]
  proficiencyLevels: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'native'>
  preferences: UserPreferences
  createdAt: Date
  updatedAt: Date
  isOnline: boolean
  lastSeen: Date
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  autoTranslate: boolean
  autoSpeak: boolean
  speechRate: number
  volume: number
  notifications: {
    newMessages: boolean
    newConnections: boolean
    systemUpdates: boolean
  }
  privacy: {
    showOnlineStatus: boolean
    allowRecording: boolean
    shareUsageData: boolean
  }
}

// Room and Session Types
export interface ConversationRoom {
  id: string
  name?: string
  participants: User[]
  languages: string[]
  isPrivate: boolean
  createdBy: string
  createdAt: Date
  lastActivity: Date
  settings: RoomSettings
}

export interface RoomSettings {
  maxParticipants: number
  allowRecording: boolean
  autoModeration: boolean
  requireApproval: boolean
  allowedLanguages?: string[]
}

// WebRTC Types
export interface PeerConnection {
  id: string
  userId: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  stream?: MediaStream
  status: 'connecting' | 'connected' | 'disconnected' | 'failed'
}

export interface WebRTCOffer {
  type: 'offer'
  sdp: string
  userId: string
  roomId: string
}

export interface WebRTCAnswer {
  type: 'answer'
  sdp: string
  userId: string
  roomId: string
}

export interface ICECandidate {
  candidate: string
  sdpMLineIndex: number
  sdpMid: string
  userId: string
  roomId: string
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: any
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

// Audio Processing Types
export interface AudioData {
  blob: Blob
  duration: number
  sampleRate: number
  channels: number
}

export interface AudioProcessingResult {
  transcript: string
  confidence: number
  language: string
  processingTime: number
}

// Analytics Types
export interface AnalyticsEvent {
  event: string
  properties: Record<string, any>
  userId?: string
  sessionId: string
  timestamp: Date
}

export interface UsageMetrics {
  totalConversations: number
  totalTranslations: number
  averageSessionDuration: number
  languagePairs: Record<string, number>
  activeUsers: number
}

// Error Types
export interface AppError {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
  timestamp: Date
  userId?: string
}

// Socket.IO Event Types
export interface ServerToClientEvents {
  'message:new': (message: Message) => void
  'user:joined': (user: User) => void
  'user:left': (userId: string) => void
  'user:typing': (userId: string) => void
  'user:stopped-typing': (userId: string) => void
  'translation:complete': (translation: TranslationResponse & { messageId: string }) => void
  'speech:recognition': (result: SpeechRecognitionResult) => void
  'room:updated': (room: ConversationRoom) => void
  'webrtc:offer': (offer: WebRTCOffer) => void
  'webrtc:answer': (answer: WebRTCAnswer) => void
  'webrtc:ice-candidate': (candidate: ICECandidate) => void
  'error': (error: AppError) => void
}

export interface ClientToServerEvents {
  'message:send': (message: Omit<Message, 'id' | 'timestamp'>) => void
  'user:typing': () => void
  'user:stopped-typing': () => void
  'room:join': (roomId: string) => void
  'room:leave': (roomId: string) => void
  'translation:request': (request: TranslationRequest & { messageId: string }) => void
  'speech:start': (config: SpeechRecognitionConfig) => void
  'speech:stop': () => void
  'webrtc:offer': (offer: WebRTCOffer) => void
  'webrtc:answer': (answer: WebRTCAnswer) => void
  'webrtc:ice-candidate': (candidate: ICECandidate) => void
}

// Component Props Types
export interface ComponentWithChildren {
  children: React.ReactNode
}

export interface ComponentWithClassName {
  className?: string
}

export interface BaseComponentProps extends ComponentWithChildren, ComponentWithClassName {
  id?: string
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox'
  placeholder?: string
  required?: boolean
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: any) => string | null
  }
  options?: Array<{ value: string; label: string }>
}

export interface FormState {
  values: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
}

// Theme Types
export interface ThemeConfig {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
    success: string
    warning: string
    error: string
  }
  spacing: Record<string, string>
  borderRadius: Record<string, string>
  shadows: Record<string, string>
  typography: {
    fontFamily: string
    fontSize: Record<string, string>
    fontWeight: Record<string, number>
    lineHeight: Record<string, string>
  }
}
