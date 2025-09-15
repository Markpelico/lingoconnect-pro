/**
 * Translation API Route
 * Enterprise-grade translation endpoint with multiple providers
 */

import { NextRequest, NextResponse } from 'next/server'
import { translationService } from '@/lib/translation-service'
import type { TranslationRequest } from '@/types'

// Rate limiting and caching (for production)
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100
const requestCounts = new Map<string, { count: number; resetTime: number }>()


function getRateLimitKey(request: NextRequest): string {
  // In production, use user ID or session ID
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  return ip
}

function checkRateLimit(key: string): { allowed: boolean; resetTime: number } {
  const now = Date.now()
  const userLimit = requestCounts.get(key)

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, resetTime: now + RATE_LIMIT_WINDOW }
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetTime: userLimit.resetTime }
  }

  userLimit.count++
  return { allowed: true, resetTime: userLimit.resetTime }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request)
    const rateLimit = checkRateLimit(rateLimitKey)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Rate limit exceeded', 
            code: 'RATE_LIMIT_EXCEEDED',
            resetTime: rateLimit.resetTime
          } 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString()
          }
        }
      )
    }

    // Parse and validate request
    const body: TranslationRequest = await request.json()
    
    // Input validation
    if (!body.text || !body.from || !body.to) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Missing required fields: text, from, to', 
            code: 'INVALID_REQUEST' 
          } 
        },
        { status: 400 }
      )
    }

    if (body.text.length > 5000) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Text too long. Maximum 5000 characters.', 
            code: 'TEXT_TOO_LONG' 
          } 
        },
        { status: 400 }
      )
    }

    // Check if translation is needed
    if (body.from === body.to) {
      return NextResponse.json({
        success: true,
        data: {
          translatedText: body.text,
          confidence: 1.0,
          detectedLanguage: body.from,
          alternatives: []
        }
      })
    }

    // Perform translation with professional service
    const startTime = Date.now()
    const result = await translationService.translateText(body)
    const processingTime = Date.now() - startTime

    // Log for analytics (in production, use proper logging service)
    console.log(`Translation completed: ${body.from} → ${body.to} (${processingTime}ms)`)

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        processingTime
      }
    })

  } catch (error) {
    console.error('Translation API error:', error)
    
    // Don't expose internal errors to client
    const errorMessage = error instanceof Error ? error.message : 'Translation failed'
    const isServiceUnavailable = errorMessage.includes('unavailable')
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: isServiceUnavailable ? errorMessage : 'Internal translation error',
          code: isServiceUnavailable ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR'
        } 
      },
      { status: isServiceUnavailable ? 503 : 500 }
    )
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    success: true,
    data: {
      service: 'LingoConnect Translation API',
      version: '1.0.0',
      status: 'operational',
      supportedLanguages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 
        'ja', 'ko', 'zh', 'ar', 'hi', 'ru'
      ],
      features: [
        'Real-time translation',
        'Context-aware translation',
        'Multiple AI providers',
        'Rate limiting',
        'Error handling'
      ]
    }
  })
}
