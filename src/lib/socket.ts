/**
 * Socket.IO Client Integration
 * Real-time communication for language exchange
 */

import { io, Socket } from 'socket.io-client'
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  Message,
  User,
  ConversationRoom
} from '@/types'

// Socket.IO client instance
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

/**
 * Socket.IO Manager Class
 * Handles real-time communication with type safety
 */
export class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private userId: string | null = null
  private currentRoom: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSocket()
    }
  }

  private initializeSocket() {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
      this.isConnected = true
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.isConnected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
      }
    })

    // Handle reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      this.isConnected = true
      this.reconnectAttempts = 0
      
      // Rejoin room if we were in one
      if (this.currentRoom && this.userId) {
        this.joinRoom(this.currentRoom)
      }
    })
  }

  /**
   * Connect to the Socket.IO server
   */
  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'))
        return
      }

      if (this.isConnected) {
        resolve()
        return
      }

      this.userId = userId
      
      this.socket.once('connect', () => {
        resolve()
      })

      this.socket.once('connect_error', (error) => {
        reject(error)
      })

      this.socket.connect()
    })
  }

  /**
   * Disconnect from the Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.isConnected = false
      this.userId = null
      this.currentRoom = null
    }
  }

  /**
   * Join a conversation room
   */
  joinRoom(roomId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot join room')
      return
    }

    this.currentRoom = roomId
    this.socket.emit('room:join', roomId)
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    if (!this.socket || !this.currentRoom) return

    this.socket.emit('room:leave', this.currentRoom)
    this.currentRoom = null
  }

  /**
   * Send a message to the current room
   */
  sendMessage(message: Omit<Message, 'id' | 'timestamp'>): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot send message')
      return
    }

    this.socket.emit('message:send', message)
  }

  /**
   * Request translation for a message
   */
  requestTranslation(messageId: string, text: string, from: string, to: string): void {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('translation:request', {
      messageId,
      text,
      from,
      to
    })
  }

  /**
   * Start speech recognition session
   */
  startSpeechRecognition(language: string): void {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('speech:start', {
      language,
      continuous: true,
      interimResults: true,
      maxAlternatives: 3
    })
  }

  /**
   * Stop speech recognition
   */
  stopSpeechRecognition(): void {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('speech:stop')
  }

  /**
   * Indicate user is typing
   */
  startTyping(): void {
    if (!this.socket || !this.isConnected) return
    this.socket.emit('user:typing')
  }

  /**
   * Indicate user stopped typing
   */
  stopTyping(): void {
    if (!this.socket || !this.isConnected) return
    this.socket.emit('user:stopped-typing')
  }

  /**
   * Subscribe to message events
   */
  onMessage(callback: (message: Message) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('message:new', callback)
    return () => this.socket?.off('message:new', callback)
  }

  /**
   * Subscribe to user events
   */
  onUserJoined(callback: (user: User) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('user:joined', callback)
    return () => this.socket?.off('user:joined', callback)
  }

  onUserLeft(callback: (userId: string) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('user:left', callback)
    return () => this.socket?.off('user:left', callback)
  }

  /**
   * Subscribe to typing events
   */
  onUserTyping(callback: (userId: string) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('user:typing', callback)
    return () => this.socket?.off('user:typing', callback)
  }

  onUserStoppedTyping(callback: (userId: string) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('user:stopped-typing', callback)
    return () => this.socket?.off('user:stopped-typing', callback)
  }

  /**
   * Subscribe to translation events
   */
  onTranslationComplete(callback: (result: { messageId: string; translatedText: string; confidence: number }) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('translation:complete', callback)
    return () => this.socket?.off('translation:complete', callback)
  }

  /**
   * Subscribe to speech recognition events
   */
  onSpeechRecognition(callback: (result: { transcript: string; confidence: number; isFinal: boolean }) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('speech:recognition', callback)
    return () => this.socket?.off('speech:recognition', callback)
  }

  /**
   * Subscribe to room updates
   */
  onRoomUpdated(callback: (room: ConversationRoom) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('room:updated', callback)
    return () => this.socket?.off('room:updated', callback)
  }

  /**
   * Subscribe to error events
   */
  onError(callback: (error: { code: string; message: string }) => void): () => void {
    if (!this.socket) return () => {}
    
    this.socket.on('error', callback)
    return () => this.socket?.off('error', callback)
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean
    userId: string | null
    currentRoom: string | null
    socketId: string | null
  } {
    return {
      connected: this.isConnected,
      userId: this.userId,
      currentRoom: this.currentRoom,
      socketId: this.socket?.id || null
    }
  }

  /**
   * Get socket instance for advanced usage
   */
  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket
  }
}

// Singleton instance
let socketManager: SocketManager | null = null

/**
 * Get or create the global SocketManager instance
 */
export function getSocketManager(): SocketManager {
  if (!socketManager) {
    socketManager = new SocketManager()
  }
  return socketManager
}

/**
 * Hook for using Socket.IO in React components
 */
export function useSocket() {
  const manager = getSocketManager()
  return manager
}

// Export singleton for backward compatibility
export const socketClient = getSocketManager()
