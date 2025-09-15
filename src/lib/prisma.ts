/**
 * Prisma Database Client
 * Enterprise-grade database connection and utilities
 */

import { PrismaClient } from '@prisma/client'

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

/**
 * Create Prisma Client with optimizations
 */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'pretty',
  })
}

/**
 * Global Prisma Client instance
 */
export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

/**
 * Database connection utilities
 */
export class DatabaseService {
  private static instance: DatabaseService
  private client: PrismaClient

  private constructor() {
    this.client = prisma
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database connection failed:', error)
      return false
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const [
        userCount,
        roomCount,
        messageCount,
        activeUsers,
        activeRooms
      ] = await Promise.all([
        this.client.user.count(),
        this.client.conversationRoom.count(),
        this.client.message.count(),
        this.client.user.count({ where: { isOnline: true } }),
        this.client.conversationRoom.count({ where: { isActive: true } })
      ])

      return {
        users: { total: userCount, active: activeUsers },
        rooms: { total: roomCount, active: activeRooms },
        messages: { total: messageCount },
        timestamp: new Date()
      }
    } catch (error) {
      console.error('Failed to get database stats:', error)
      throw new Error('Unable to retrieve database statistics')
    }
  }

  /**
   * Clean up old data
   */
  async cleanup() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      
      // Delete old sessions
      await this.client.userSession.deleteMany({
        where: {
          endTime: { lt: thirtyDaysAgo }
        }
      })

      // Delete old message reactions from deleted messages
      await this.client.messageReaction.deleteMany({
        where: {
          message: { isDeleted: true }
        }
      })

      console.log('Database cleanup completed')
    } catch (error) {
      console.error('Database cleanup failed:', error)
    }
  }

  /**
   * Health check for the database
   */
  async healthCheck() {
    try {
      const start = Date.now()
      await this.client.$queryRaw`SELECT 1`
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    return this.client
  }
}

/**
 * User management utilities
 */
export class UserService {
  private db: PrismaClient

  constructor() {
    this.db = prisma
  }

  /**
   * Create a new user
   */
  async createUser(data: {
    email: string
    name?: string
    username?: string
    nativeLanguages: string[]
    learningLanguages: string[]
    proficiencyLevels: Record<string, string>
  }) {
    try {
      const user = await this.db.user.create({
        data: {
          ...data,
          preferences: {
            theme: 'light',
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
          }
        }
      })

      // Create initial language learning progress
      const progressData = data.learningLanguages.map(lang => ({
        userId: user.id,
        language: lang,
        proficiencyLevel: data.proficiencyLevels[lang] || 'beginner'
      }))

      if (progressData.length > 0) {
        await this.db.languageLearningProgress.createMany({
          data: progressData
        })
      }

      return user
    } catch (error) {
      console.error('Failed to create user:', error)
      throw new Error('User creation failed')
    }
  }

  /**
   * Find users by language preferences
   */
  async findUsersByLanguage(nativeLanguage: string, learningLanguage: string) {
    return this.db.user.findMany({
      where: {
        AND: [
          { nativeLanguages: { has: learningLanguage } },
          { learningLanguages: { has: nativeLanguage } },
          { isActive: true }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        nativeLanguages: true,
        learningLanguages: true,
        isOnline: true,
        lastSeen: true
      }
    })
  }

  /**
   * Update user's online status
   */
  async updateOnlineStatus(userId: string, isOnline: boolean) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: new Date()
      }
    })
  }

  /**
   * Get user's learning progress
   */
  async getUserProgress(userId: string) {
    return this.db.languageLearningProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    })
  }
}

/**
 * Room management utilities
 */
export class RoomService {
  private db: PrismaClient

  constructor() {
    this.db = prisma
  }

  /**
   * Create a new conversation room
   */
  async createRoom(data: {
    name?: string
    description?: string
    createdBy: string
    languages: string[]
    isPrivate?: boolean
    maxParticipants?: number
  }) {
    const room = await this.db.conversationRoom.create({
      data: {
        ...data,
        isPrivate: data.isPrivate ?? false,
        maxParticipants: data.maxParticipants ?? 10
      },
      include: {
        creator: true,
        members: {
          include: { user: true }
        }
      }
    })

    // Add creator as admin member
    await this.db.roomMember.create({
      data: {
        userId: data.createdBy,
        roomId: room.id,
        role: 'ADMIN'
      }
    })

    return room
  }

  /**
   * Join a room
   */
  async joinRoom(userId: string, roomId: string) {
    // Check if room exists and has space
    const room = await this.db.conversationRoom.findUnique({
      where: { id: roomId },
      include: { members: true }
    })

    if (!room) {
      throw new Error('Room not found')
    }

    if (room.members.length >= room.maxParticipants) {
      throw new Error('Room is full')
    }

    // Check if user is already a member
    const existingMember = await this.db.roomMember.findUnique({
      where: {
        userId_roomId: { userId, roomId }
      }
    })

    if (existingMember) {
      if (existingMember.isActive) {
        throw new Error('User is already in the room')
      } else {
        // Reactivate membership
        return this.db.roomMember.update({
          where: { id: existingMember.id },
          data: { isActive: true, leftAt: null }
        })
      }
    }

    // Create new membership
    return this.db.roomMember.create({
      data: { userId, roomId },
      include: { user: true, room: true }
    })
  }

  /**
   * Leave a room
   */
  async leaveRoom(userId: string, roomId: string) {
    return this.db.roomMember.updateMany({
      where: { userId, roomId, isActive: true },
      data: { isActive: false, leftAt: new Date() }
    })
  }

  /**
   * Get active rooms for language pair
   */
  async getActiveRooms(languages: string[]) {
    return this.db.conversationRoom.findMany({
      where: {
        isActive: true,
        languages: { hasSome: languages }
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true }
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, username: true, avatar: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastActivity: 'desc' }
    })
  }
}

/**
 * Message management utilities
 */
export class MessageService {
  private db: PrismaClient

  constructor() {
    this.db = prisma
  }

  /**
   * Send a message
   */
  async sendMessage(data: {
    content: string
    userId: string
    roomId: string
    language: string
    targetLanguage?: string
    type?: 'TEXT' | 'AUDIO' | 'TRANSLATION' | 'SYSTEM'
  }) {
    const message = await this.db.message.create({
      data: {
        ...data,
        type: data.type ?? 'TEXT'
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true }
        }
      }
    })

    // Update room's last activity
    await this.db.conversationRoom.update({
      where: { id: data.roomId },
      data: { lastActivity: new Date() }
    })

    return message
  }

  /**
   * Get room messages with pagination
   */
  async getRoomMessages(roomId: string, limit = 50, offset = 0) {
    return this.db.message.findMany({
      where: {
        roomId,
        isDeleted: false
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true }
        },
        reactions: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Update message with translation
   */
  async updateMessageTranslation(
    messageId: string,
    translatedContent: string,
    confidence: number
  ) {
    return this.db.message.update({
      where: { id: messageId },
      data: { translatedContent, confidence }
    })
  }
}

// Export service instances
export const databaseService = DatabaseService.getInstance()
export const userService = new UserService()
export const roomService = new RoomService()
export const messageService = new MessageService()

// Export Prisma client for direct access
export default prisma
