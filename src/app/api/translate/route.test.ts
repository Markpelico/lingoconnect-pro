import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The route keeps its rate-limit counters in module scope, so each test file
 * section resets modules to get a clean limiter. Requests also carry distinct
 * IPs where isolation matters.
 */
async function loadRoute() {
  vi.resetModules()
  return import('./route')
}

function post(body: unknown, ip = '203.0.113.1'): NextRequest {
  return new NextRequest('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID = { text: 'Where is the station?', from: 'en-US', to: 'es-ES' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/translate validation', () => {
  it('rejects malformed JSON', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post('{ not json', '198.51.100.1'))

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_JSON')
  })

  it('rejects a missing text field', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post({ from: 'en-US', to: 'es-ES' }, '198.51.100.2'))

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
  })

  it('rejects text that is only whitespace', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post({ ...VALID, text: '   ' }, '198.51.100.3'))

    expect(response.status).toBe(400)
  })

  it('rejects a missing target language', async () => {
    const { POST } = await loadRoute()
    const response = await POST(post({ text: 'hello', from: 'en-US' }, '198.51.100.4'))

    expect(response.status).toBe(400)
  })

  it('rejects text beyond the length cap', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      post({ ...VALID, text: 'a'.repeat(2001) }, '198.51.100.5')
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('TEXT_TOO_LONG')
  })

  it('accepts text at exactly the cap', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      post({ text: 'a'.repeat(2000), from: 'en-US', to: 'en-GB' }, '198.51.100.6')
    )

    // Same base language, so this short-circuits without touching the network.
    expect(response.status).toBe(200)
  })
})

describe('POST /api/translate same-language short circuit', () => {
  it('returns the input unchanged without calling a provider', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      post({ text: 'hello', from: 'en-US', to: 'en-US' }, '198.51.100.7')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.translatedText).toBe('hello')
    expect(body.data.provider).toBe('none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('treats different locales of one language as the same language', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      post({ text: 'colour', from: 'en-GB', to: 'en-US' }, '198.51.100.8')
    )

    expect((await response.json()).data.translatedText).toBe('colour')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('POST /api/translate provider failure', () => {
  it('returns 503 and no invented text when every provider fails', async () => {
    // Every upstream call fails, so the chain exhausts itself.
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const { POST } = await loadRoute()
    const response = await POST(post(VALID, '198.51.100.9'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('TRANSLATION_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('[Spanish Translation]')
  })

  it('reports which providers were tried', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const { POST } = await loadRoute()
    const response = await POST(post(VALID, '198.51.100.10'))
    const body = await response.json()

    expect(Array.isArray(body.error.attempted)).toBe(true)
    expect(body.error.attempted.length).toBeGreaterThan(0)
  })
})

describe('POST /api/translate rate limiting', () => {
  it('rejects once a client exceeds the window allowance', async () => {
    const { POST } = await loadRoute()
    const ip = '192.0.2.50'

    // Same-language requests keep this fast and network free.
    const body = { text: 'hi', from: 'en-US', to: 'en-US' }
    const statuses: number[] = []
    for (let i = 0; i < 62; i++) {
      statuses.push((await POST(post(body, ip))).status)
    }

    expect(statuses.filter((s) => s === 200)).toHaveLength(60)
    expect(statuses.filter((s) => s === 429)).toHaveLength(2)
  })

  it('counts clients independently', async () => {
    const { POST } = await loadRoute()
    const body = { text: 'hi', from: 'en-US', to: 'en-US' }

    for (let i = 0; i < 61; i++) await POST(post(body, '192.0.2.60'))
    const other = await POST(post(body, '192.0.2.61'))

    // One client burning its allowance must not lock everyone else out.
    expect(other.status).toBe(200)
  })

  it('sets rate limit headers on rejection', async () => {
    const { POST } = await loadRoute()
    const body = { text: 'hi', from: 'en-US', to: 'en-US' }
    const ip = '192.0.2.70'

    let response = await POST(post(body, ip))
    for (let i = 0; i < 61; i++) response = await POST(post(body, ip))

    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
  })
})

describe('GET /api/translate', () => {
  it('reports the active providers', async () => {
    const { GET } = await loadRoute()
    const body = await (await GET()).json()

    expect(body.success).toBe(true)
    expect(body.data.providers).toEqual(['MyMemory', 'Apertium'])
  })
})
