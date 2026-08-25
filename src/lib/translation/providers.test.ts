import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApertiumProvider, MyMemoryProvider, baseLang } from './providers'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const REQUEST = { text: 'Where is the station?', from: 'en-US', to: 'es-ES' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('baseLang', () => {
  it('strips the locale suffix', () => {
    expect(baseLang('en-US')).toBe('en')
    expect(baseLang('pt-BR')).toBe('pt')
  })

  it('leaves a bare code alone and normalises case', () => {
    expect(baseLang('ES')).toBe('es')
  })
})

describe('MyMemoryProvider', () => {
  const provider = new MyMemoryProvider()

  it('claims support for every pair', () => {
    expect(provider.supports()).toBe(true)
  })

  it('returns the translation and passes through the match score', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        responseData: { translatedText: '¿Dónde está la estación?', match: 0.85 },
      })
    )

    const result = await provider.translate(REQUEST)

    expect(result.translatedText).toBe('¿Dónde está la estación?')
    expect(result.confidence).toBeCloseTo(0.85)
    expect(result.provider).toBe('MyMemory')
    expect(result.quality).toBe('good')
  })

  it('sends base language codes rather than full locales', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        responseData: { translatedText: 'x', match: 1 },
      })
    )

    await provider.translate(REQUEST)

    const url = String(vi.mocked(fetch).mock.calls[0][0])
    expect(url).toContain('langpair=en%7Ces')
  })

  it('caps confidence at 1 when the API reports a match above 1', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        responseData: { translatedText: 'x', match: 1.4 },
      })
    )

    expect((await provider.translate(REQUEST)).confidence).toBe(1)
  })

  it('falls back to a default confidence when match is not a number', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        responseData: { translatedText: 'x', match: 'nonsense' },
      })
    )

    expect((await provider.translate(REQUEST)).confidence).toBe(0.8)
  })

  it('throws on a non-OK HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500))
    await expect(provider.translate(REQUEST)).rejects.toThrow(/500/)
  })

  it('throws when the API reports a non-200 responseStatus in the body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseStatus: 403, responseDetails: 'INVALID LANGUAGE PAIR' })
    )
    await expect(provider.translate(REQUEST)).rejects.toThrow(/INVALID LANGUAGE PAIR/)
  })

  it('treats an exhausted quota as a failure so the chain moves on', async () => {
    // The quota is reported in-band with HTTP 200, which is easy to miss.
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        quotaFinished: true,
        responseData: { translatedText: 'partial', match: 1 },
      })
    )
    await expect(provider.translate(REQUEST)).rejects.toThrow(/quota/i)
  })

  it('rejects the warning string MyMemory puts in the translation field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        responseStatus: 200,
        responseData: {
          translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS',
          match: 1,
        },
      })
    )
    await expect(provider.translate(REQUEST)).rejects.toThrow(/quota/i)
  })

  it('throws on an empty translation rather than returning blank text', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseStatus: 200, responseData: { translatedText: '' } })
    )
    await expect(provider.translate(REQUEST)).rejects.toThrow(/empty/i)
  })
})

describe('ApertiumProvider', () => {
  const provider = new ApertiumProvider()

  describe('pair support', () => {
    it('supports the verified English pairs', () => {
      expect(provider.supports('en-US', 'es-ES')).toBe(true)
      expect(provider.supports('en', 'ca')).toBe(true)
      expect(provider.supports('es-ES', 'en-US')).toBe(true)
    })

    it('rejects pairs Apertium does not cover', () => {
      // Apertium has no English to Japanese or English to German path.
      expect(provider.supports('en-US', 'ja-JP')).toBe(false)
      expect(provider.supports('en-US', 'de-DE')).toBe(false)
      expect(provider.supports('en-US', 'ru-RU')).toBe(false)
    })

    it('rejects languages missing from the code map entirely', () => {
      expect(provider.supports('zh-CN', 'en-US')).toBe(false)
      expect(provider.supports('en-US', 'hi-IN')).toBe(false)
    })

    it('is direction sensitive', () => {
      // eng-glg exists in both directions, but fra-eng does not exist at all.
      expect(provider.supports('fr-FR', 'en-US')).toBe(false)
      expect(provider.supports('fr-FR', 'es-ES')).toBe(true)
    })
  })

  it('translates using three-letter codes', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: '¿Dónde está la estación?' } })
    )

    const result = await provider.translate(REQUEST)

    const url = String(vi.mocked(fetch).mock.calls[0][0])
    expect(url).toContain('langpair=eng%7Cspa')
    expect(result.provider).toBe('Apertium')
  })

  it('is always flagged as approximate so the UI can say so', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: 'una traducción limpia' } })
    )

    expect((await provider.translate(REQUEST)).quality).toBe('approximate')
  })

  it('strips the markers Apertium puts on words it could not analyse', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: 'Dónde es la #canal de tren' } })
    )

    const result = await provider.translate(REQUEST)

    expect(result.translatedText).toBe('Dónde es la canal de tren')
    expect(result.translatedText).not.toContain('#')
  })

  it('lowers confidence as more words fail to translate', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: 'una frase perfectamente normal' } })
    )
    const clean = await provider.translate(REQUEST)

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: '#uno #dos #tres' } })
    )
    const messy = await provider.translate(REQUEST)

    expect(messy.confidence).toBeLessThan(clean.confidence)
  })

  it('never reports confidence below the floor', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ responseData: { translatedText: '#a #b #c #d #e #f #g #h' } })
    )

    expect((await provider.translate(REQUEST)).confidence).toBeGreaterThanOrEqual(0.3)
  })

  it('refuses an unsupported pair without calling the network', async () => {
    await expect(
      provider.translate({ text: 'hello', from: 'en-US', to: 'ja-JP' })
    ).rejects.toThrow(/does not support/i)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws on an empty translation', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ responseData: {} }))
    await expect(provider.translate(REQUEST)).rejects.toThrow(/empty/i)
  })
})
