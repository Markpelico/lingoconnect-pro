/**
 * React Hook for Socket.IO Integration
 * Real-time communication with enterprise-grade features
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useConversationStore } from '@/store/conversation'
import { getSocketManager, SocketManager } from '@/lib/socket'
import type { Message, User, ConversationRoom } from '@/types'

interface UseSocketOptions {
  autoConnect?: boolean
  userId?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: { code: string; message: string }) => void
}

interface UseSocketReturn {
  isConnected: boolean
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  connect: (userId: string) => Promise<void>
  disconnect: () => void
  joinRoom: (roomId: string) => void
  leaveRoom: () => void
  sendMessage: (content: string) => void
  startTyping: () => void
  stopTyping: () => void
  error: string | null
  socketId: string | null
  currentRoom: string | null
}

/**
 * Main Socket.IO hook for real-time communication
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = false,
    userId: optionsUserId,
    onConnect,
    onDisconnect,
    onError
  } = options

  // State
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)

  // Store integration
  const {
    addMessage,
    addParticipant,
    removeParticipant,
    updateRoom,
    addTypingUser,
    removeTypingUser,
    sourceLanguage,
    targetLanguage
  } = useConversationStore()

  // Socket manager reference
  const socketManagerRef = useRef<SocketManager | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Initialize socket manager
  useEffect(() => {
    socketManagerRef.current = getSocketManager()
  }, [])

  // Setup event listeners
  useEffect(() => {
    const manager = socketManagerRef.current
    if (!manager) return

    // Message events
    const unsubscribeMessage = manager.onMessage((message: Message) => {
      addMessage(message)
    })

    // User events
    const unsubscribeUserJoined = manager.onUserJoined((user: User) => {
      addParticipant(user)
    })

    const unsubscribeUserLeft = manager.onUserLeft((userId: string) => {
      removeParticipant(userId)
      removeTypingUser(userId)
    })

    // Typing events
    const unsubscribeTyping = manager.onUserTyping((userId: string) => {
      addTypingUser(userId)
    })

    const unsubscribeStoppedTyping = manager.onUserStoppedTyping((userId: string) => {
      removeTypingUser(userId)
    })

    // Room events
    const unsubscribeRoomUpdated = manager.onRoomUpdated((room: ConversationRoom) => {
      updateRoom(room)
      setCurrentRoom(room.id)
    })

    // Translation events
    const unsubscribeTranslation = manager.onTranslationComplete(
      ({ messageId, translatedText, confidence }) => {
        // Update message with translation
        useConversationStore.getState().updateMessage(messageId, {
          translatedContent: translatedText,
          confidence
        })
      }
    )

    // Error events
    const unsubscribeError = manager.onError((error: { code: string; message: string }) => {
      setError(error.message)
      setConnectionStatus('error')
      onError?.(error)
    })

    // Cleanup
    return () => {
      unsubscribeMessage()
      unsubscribeUserJoined()
      unsubscribeUserLeft()
      unsubscribeTyping()
      unsubscribeStoppedTyping()
      unsubscribeRoomUpdated()
      unsubscribeTranslation()
      unsubscribeError()
    }
  }, [
    addMessage,
    addParticipant,
    removeParticipant,
    updateRoom,
    addTypingUser,
    removeTypingUser,
    onError
  ])

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && optionsUserId && !isConnected) {
      connect(optionsUserId)
    }
  }, [autoConnect, optionsUserId, isConnected])

  // Connect function
  const connect = useCallback(async (userId: string) => {
    const manager = socketManagerRef.current
    if (!manager) throw new Error('Socket manager not initialized')

    try {
      setConnectionStatus('connecting')
      setError(null)
      
      await manager.connect(userId)
      
      userIdRef.current = userId
      setIsConnected(true)
      setConnectionStatus('connected')
      
      const status = manager.getConnectionStatus()
      setSocketId(status.socketId)
      setCurrentRoom(status.currentRoom)
      
      onConnect?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      setError(errorMessage)
      setConnectionStatus('error')
      setIsConnected(false)
      throw error
    }
  }, [onConnect])

  // Disconnect function
  const disconnect = useCallback(() => {
    const manager = socketManagerRef.current
    if (!manager) return

    manager.disconnect()
    setIsConnected(false)
    setConnectionStatus('disconnected')
    setSocketId(null)
    setCurrentRoom(null)
    userIdRef.current = null
    
    onDisconnect?.()
  }, [onDisconnect])

  // Join room function
  const joinRoom = useCallback((roomId: string) => {
    const manager = socketManagerRef.current
    if (!manager || !isConnected) {
      console.warn('Cannot join room: socket not connected')
      return
    }

    manager.joinRoom(roomId)
    setCurrentRoom(roomId)
  }, [isConnected])

  // Leave room function
  const leaveRoom = useCallback(() => {
    const manager = socketManagerRef.current
    if (!manager) return

    manager.leaveRoom()
    setCurrentRoom(null)
  }, [])

  // Send message function
  const sendMessage = useCallback((content: string) => {
    const manager = socketManagerRef.current
    const userId = userIdRef.current
    
    if (!manager || !userId || !isConnected) {
      console.warn('Cannot send message: socket not connected')
      return
    }

    const message: Omit<Message, 'id' | 'timestamp'> = {
      content,
      language: sourceLanguage.code,
      targetLanguage: targetLanguage.code,
      userId,
      type: 'text'
    }

    manager.sendMessage(message)
  }, [isConnected, sourceLanguage.code, targetLanguage.code])

  // Typing indicators
  const startTyping = useCallback(() => {
    const manager = socketManagerRef.current
    if (!manager || !isConnected) return
    manager.startTyping()
  }, [isConnected])

  const stopTyping = useCallback(() => {
    const manager = socketManagerRef.current
    if (!manager || !isConnected) return
    manager.stopTyping()
  }, [isConnected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnect()
      }
    }
  }, []) // Don't include disconnect in dependencies to avoid infinite loop

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    error,
    socketId,
    currentRoom
  }
}

/**
 * Hook for managing real-time translation via Socket.IO
 */
export function useSocketTranslation() {
  const { isConnected } = useSocket()
  const socketManager = getSocketManager()

  const requestTranslation = useCallback((
    messageId: string,
    text: string,
    from: string,
    to: string
  ) => {
    if (!isConnected) {
      console.warn('Cannot request translation: socket not connected')
      return
    }

    socketManager.requestTranslation(messageId, text, from, to)
  }, [isConnected, socketManager])

  return { requestTranslation }
}

/**
 * Hook for real-time room management
 */
export function useSocketRoom() {
  const socket = useSocket()
  const [participants, setParticipants] = useState<User[]>([])
  const [roomInfo, setRoomInfo] = useState<ConversationRoom | null>(null)

  // Subscribe to room updates
  useEffect(() => {
    const manager = getSocketManager()
    
    const unsubscribeRoomUpdated = manager.onRoomUpdated((room: ConversationRoom) => {
      setRoomInfo(room)
      setParticipants(room.participants)
    })

    const unsubscribeUserJoined = manager.onUserJoined((user: User) => {
      setParticipants(prev => {
        if (prev.find(p => p.id === user.id)) return prev
        return [...prev, user]
      })
    })

    const unsubscribeUserLeft = manager.onUserLeft((userId: string) => {
      setParticipants(prev => prev.filter(p => p.id !== userId))
    })

    return () => {
      unsubscribeRoomUpdated()
      unsubscribeUserJoined()
      unsubscribeUserLeft()
    }
  }, [])

  return {
    ...socket,
    participants,
    roomInfo,
    participantCount: participants.length
  }
}

/**
 * Hook for real-time typing indicators
 */
export function useSocketTyping() {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const socket = useSocket()

  useEffect(() => {
    const manager = getSocketManager()
    
    const unsubscribeTyping = manager.onUserTyping((userId: string) => {
      setTypingUsers(prev => new Set([...prev, userId]))
    })

    const unsubscribeStoppedTyping = manager.onUserStoppedTyping((userId: string) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    })

    return () => {
      unsubscribeTyping()
      unsubscribeStoppedTyping()
    }
  }, [])

  return {
    typingUsers: Array.from(typingUsers),
    isUserTyping: (userId: string) => typingUsers.has(userId),
    startTyping: socket.startTyping,
    stopTyping: socket.stopTyping
  }
}
