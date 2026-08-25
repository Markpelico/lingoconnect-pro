/**
 * POST /api/translate
 *
 * Translates a phrase using the free provider chain. Fails loudly rather than
 * returning invented text — the client renders the failure.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  translationService,
  TranslationUnavailableError,
} from '@/lib/translation'
import type { TranslationRequest } from '@/types'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60
const MAX_TEXT_LENGTH = 2000

/**
 * In-memory rate limiting. This is per-instance and resets on cold start,
 * which is fine for a single-region deployment but would need Redis or
 * similar to be meaningful across serverless instances.
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return (
    (forwarded ? forwarded.split(',')[0].trim() : null) ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(key: string): { allowed: boolean; resetTime: number } {
  const now = Date.now()
  const entry = requestCounts.get(key)

  if (!entry || now > entry.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS
    requestCounts.set(key, { count: 1, resetTime })
    return { allowed: true, resetTime }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetTime: entry.resetTime }
  }

  entry.count++
  return { allowed: true, resetTime: entry.resetTime }
}

function errorResponse(
  message: string,
  code: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: { message, code, ...extra } },
    { status }
  )
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(getRateLimitKey(request))
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Too many requests. Try again in a moment.',
          code: 'RATE_LIMIT_EXCEEDED',
          resetTime: rateLimit.resetTime,
        },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
        },
      }
    )
  }

  let body: TranslationRequest
  try {
    body = await request.json()
  } catch {
    return errorResponse('Request body must be valid JSON', 'INVALID_JSON', 400)
  }

  if (!body?.text?.trim() || !body.from || !body.to) {
    return errorResponse(
      'Missing required fields: text, from, to',
      'INVALID_REQUEST',
      400
    )
  }

  if (body.text.length > MAX_TEXT_LENGTH) {
    return errorResponse(
      `Text too long. Maximum ${MAX_TEXT_LENGTH} characters.`,
      'TEXT_TOO_LONG',
      400
    )
  }

  // Same language in and out — nothing to do.
  if (body.from.split('-')[0] === body.to.split('-')[0]) {
    return NextResponse.json({
      success: true,
      data: {
        translatedText: body.text,
        confidence: 1,
        provider: 'none',
        quality: 'good',
        detectedLanguage: body.from,
        processingTime: 0,
      },
    })
  }

  const startTime = Date.now()

  try {
    const result = await translationService.translate(body)
    return NextResponse.json({
      success: true,
      data: { ...result, processingTime: Date.now() - startTime },
    })
  } catch (error) {
    if (error instanceof TranslationUnavailableError) {
      // 503: the request was valid, we just couldn't service it right now.
      return errorResponse(
        'Translation is temporarily unavailable for this language pair.',
        'TRANSLATION_UNAVAILABLE',
        503,
        { attempted: error.attempted }
      )
    }

    console.error('Unexpected translation error:', error)
    return errorResponse(
      'Something went wrong while translating.',
      'INTERNAL_ERROR',
      500
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      service: 'LingoConnect Translation API',
      status: 'operational',
      providers: ['MyMemory', 'Apertium'],
      note: 'Free, key-less providers. Fails explicitly rather than returning mock text.',
    },
  })
}
