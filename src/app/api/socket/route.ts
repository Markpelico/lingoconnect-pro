/**
 * Socket.IO Server Integration
 * Real-time communication API endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { Server as SocketServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  Message,
  User,
  ConversationRoom,
  TranslationRequest,
  SpeechRecognitionConfig
} from '@/types'

// Global socket server instance
let io: SocketServer<ClientToServerEvents, ServerToClientEvents> | null = null

// In-memory storage (in production, use Redis or database)
const activeRooms = new Map<string, ConversationRoom>()
const userSessions = new Map<string, { userId: string; roomId?: string; socketId: string }>()
const roomParticipants = new Map<string, Set<string>>() // roomId -> Set of userIds

/**
 * Initialize Socket.IO server
 */
function initializeSocketServer(httpServer: HTTPServer) {
  if (io) return io

  io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Handle room joining
    socket.on('room:join', async (roomId: string) => {
      try {
        // Leave previous room if any
        const session = userSessions.get(socket.id)
        if (session?.roomId) {
          socket.leave(session.roomId)
          const oldParticipants = roomParticipants.get(session.roomId)
          if (oldParticipants) {
            oldParticipants.delete(session.userId)
            if (oldParticipants.size === 0) {
              roomParticipants.delete(session.roomId)
              activeRooms.delete(session.roomId)
            }
          }
        }

        // Join new room
        socket.join(roomId)
        
        // Update session
        const userId = session?.userId || `user_${socket.id}`
        userSessions.set(socket.id, { userId, roomId, socketId: socket.id })

        // Update room participants
        if (!roomParticipants.has(roomId)) {
          roomParticipants.set(roomId, new Set())
        }
        roomParticipants.get(roomId)!.add(userId)

        // Create or update room
        const participants = Array.from(roomParticipants.get(roomId) || []).map(id => ({
          id,
          name: `User ${id.slice(-4)}`,
          email: `${id}@example.com`,
          nativeLanguages: ['en'],
          learningLanguages: ['es'],
          proficiencyLevels: { en: 'native' as const, es: 'beginner' as const },
          preferences: {
            theme: 'light' as const,
            autoTranslate: true,
            autoSpeak: true,
            speechRate: 1.0,
            volume: 1.0,
            notifications: {
              newMessages: true,
              newConnections: true,
              systemUpdates: true
            },
            privacy: {
              showOnlineStatus: true,
              allowRecording: true,
              shareUsageData: false
            }
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          isOnline: true,
          lastSeen: new Date()
        }))

        const room: ConversationRoom = {
          id: roomId,
          name: `Language Exchange Room ${roomId.slice(-4)}`,
          participants,
          languages: ['en', 'es', 'fr', 'de'],
          isPrivate: false,
          createdBy: userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          settings: {
            maxParticipants: 10,
            allowRecording: true,
            autoModeration: false,
            requireApproval: false,
            allowedLanguages: ['en', 'es', 'fr', 'de']
          }
        }

        activeRooms.set(roomId, room)

        // Notify room of new user
        const user = participants.find(p => p.id === userId)
        if (user) {
          socket.to(roomId).emit('user:joined', user)
        }

        // Send room update to all participants
        io.to(roomId).emit('room:updated', room)

        console.log(`User ${userId} joined room ${roomId}`)
      } catch (error) {
        console.error('Error joining room:', error)
        socket.emit('error', {
          code: 'ROOM_JOIN_ERROR',
          message: 'Failed to join room'
        })
      }
    })

    // Handle room leaving
    socket.on('room:leave', (roomId: string) => {
      try {
        const session = userSessions.get(socket.id)
        if (session && session.roomId === roomId) {
          socket.leave(roomId)
          
          // Remove from participants
          const participants = roomParticipants.get(roomId)
          if (participants) {
            participants.delete(session.userId)
            if (participants.size === 0) {
              roomParticipants.delete(roomId)
              activeRooms.delete(roomId)
            }
          }

          // Update session
          userSessions.set(socket.id, { ...session, roomId: undefined })

          // Notify room
          socket.to(roomId).emit('user:left', session.userId)
          
          console.log(`User ${session.userId} left room ${roomId}`)
        }
      } catch (error) {
        console.error('Error leaving room:', error)
      }
    })

    // Handle message sending
    socket.on('message:send', (messageData) => {
      try {
        const session = userSessions.get(socket.id)
        if (!session?.roomId) {
          socket.emit('error', {
            code: 'NO_ROOM',
            message: 'Must join a room to send messages'
          })
          return
        }

        const message: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...messageData,
          timestamp: new Date(),
          userId: session.userId
        }

        // Broadcast message to room
        io.to(session.roomId).emit('message:new', message)
        
        console.log(`Message sent in room ${session.roomId}:`, message.content)
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', {
          code: 'MESSAGE_SEND_ERROR',
          message: 'Failed to send message'
        })
      }
    })

    // Handle translation requests
    socket.on('translation:request', async (request) => {
      try {
        const session = userSessions.get(socket.id)
        if (!session?.roomId) return

        // Simulate translation (in production, integrate with actual translation service)
        const translatedText = `[TRANSLATED] ${request.text}`
        const confidence = 0.95

        socket.emit('translation:complete', {
          messageId: request.messageId,
          translatedText,
          confidence
        })
      } catch (error) {
        console.error('Translation error:', error)
        socket.emit('error', {
          code: 'TRANSLATION_ERROR',
          message: 'Translation failed'
        })
      }
    })

    // Handle speech recognition
    socket.on('speech:start', (config: SpeechRecognitionConfig) => {
      console.log('Speech recognition started for', socket.id)
      // In production, integrate with speech recognition service
    })

    socket.on('speech:stop', () => {
      console.log('Speech recognition stopped for', socket.id)
    })

    // Handle typing indicators
    socket.on('user:typing', () => {
      const session = userSessions.get(socket.id)
      if (session?.roomId) {
        socket.to(session.roomId).emit('user:typing', session.userId)
      }
    })

    socket.on('user:stopped-typing', () => {
      const session = userSessions.get(socket.id)
      if (session?.roomId) {
        socket.to(session.roomId).emit('user:stopped-typing', session.userId)
      }
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason)
      
      const session = userSessions.get(socket.id)
      if (session) {
        // Remove from room
        if (session.roomId) {
          const participants = roomParticipants.get(session.roomId)
          if (participants) {
            participants.delete(session.userId)
            socket.to(session.roomId).emit('user:left', session.userId)
            
            if (participants.size === 0) {
              roomParticipants.delete(session.roomId)
              activeRooms.delete(session.roomId)
            }
          }
        }
        
        // Remove session
        userSessions.delete(socket.id)
      }
    })
  })

  return io
}

/**
 * API endpoint for Socket.IO server
 */
export async function GET(request: NextRequest) {
  // Health check for Socket.IO server
  return NextResponse.json({
    success: true,
    data: {
      service: 'LingoConnect Socket.IO Server',
      status: 'operational',
      activeRooms: activeRooms.size,
      activeSessions: userSessions.size,
      features: [
        'Real-time messaging',
        'Room management',
        'User presence',
        'Typing indicators',
        'Translation integration',
        'Speech recognition support'
      ]
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()

    switch (action) {
      case 'broadcast':
        // Broadcast message to all connected clients
        if (io) {
          io.emit('message:new', data)
          return NextResponse.json({ success: true, message: 'Message broadcasted' })
        }
        break

      case 'room_stats':
        // Get room statistics
        const roomId = data.roomId
        const room = activeRooms.get(roomId)
        const participants = roomParticipants.get(roomId)
        
        return NextResponse.json({
          success: true,
          data: {
            room,
            participantCount: participants?.size || 0,
            participants: Array.from(participants || [])
          }
        })

      case 'active_rooms':
        // Get all active rooms
        const rooms = Array.from(activeRooms.values())
        return NextResponse.json({
          success: true,
          data: { rooms, count: rooms.length }
        })

      default:
        return NextResponse.json(
          { success: false, error: { message: 'Invalid action', code: 'INVALID_ACTION' } },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Socket.IO API error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    )
  }
}

// Export socket server for external access
export { io }
export default initializeSocketServer
