/**
 * Free, key-less translation providers.
 *
 * Every provider here was benchmarked live before being included. Notably
 * absent, and why:
 *
 *   - translate.googleapis.com/translate_a  — bot-blocked, returns a "Sorry..."
 *     interstitial from cloud IPs. This was the previous primary provider.
 *   - lingva.ml and every public mirror      — HTTP 500; they proxy the Google
 *     endpoint above, so they died with it.
 *   - libretranslate.de                      — gone (301, no longer resolves).
 *   - libretranslate.com                     — now requires an API key.
 *
 * That leaves MyMemory (broad coverage) and Apertium (narrow, rule-based).
 */

import type { TranslationRequest } from '@/types'

export type ProviderQuality = 'good' | 'approximate'

export interface ProviderResult {
  translatedText: string
  confidence: number
  provider: string
  quality: ProviderQuality
  detectedLanguage?: string
}

export interface TranslationProvider {
  readonly name: string
  /** Whether this provider can handle the given language pair at all. */
  supports(from: string, to: string): boolean
  translate(request: TranslationRequest): Promise<ProviderResult>
}

/** Strip a locale suffix: "en-US" -> "en". */
export function baseLang(code: string): string {
  return code.split('-')[0].toLowerCase()
}

const REQUEST_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * MyMemory — translation memory backed by human translations plus MT.
 *
 * Free tier is ~5k characters/day per IP. Supplying a contact email via the
 * `de` parameter raises this to ~50k/day; we deliberately do not send one, so
 * no personal data leaves the app. See README for how to opt in.
 */
export class MyMemoryProvider implements TranslationProvider {
  readonly name = 'MyMemory'
  private baseUrl = 'https://api.mymemory.translated.net/get'

  supports(): boolean {
    // Broad coverage across all languages the app offers.
    return true
  }

  async translate(request: TranslationRequest): Promise<ProviderResult> {
    const from = baseLang(request.from)
    const to = baseLang(request.to)

    const params = new URLSearchParams({
      q: request.text,
      langpair: `${from}|${to}`,
    })

    const response = await fetchWithTimeout(`${this.baseUrl}?${params}`)
    if (!response.ok) {
      throw new Error(`MyMemory HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'MyMemory rejected the request')
    }

    // The daily quota is reported in-band rather than as an HTTP error.
    if (data.quotaFinished) {
      throw new Error('MyMemory daily quota exhausted')
    }

    const translatedText: string = data.responseData?.translatedText ?? ''
    if (!translatedText) {
      throw new Error('MyMemory returned an empty translation')
    }

    // MyMemory sometimes puts an error string in the translation field itself.
    if (translatedText.startsWith('MYMEMORY WARNING')) {
      throw new Error('MyMemory quota warning')
    }

    // `match` is 0..1 and reflects how close the memory hit was.
    const match = Number(data.responseData?.match)

    return {
      translatedText,
      confidence: Number.isFinite(match) ? Math.min(match, 1) : 0.8,
      provider: this.name,
      quality: 'good',
      detectedLanguage: from,
    }
  }
}

/**
 * Apertium — rule-based open-source MT.
 *
 * Genuinely free and reliable, but only covers a narrow set of mostly Romance
 * pairs, and output is noticeably rougher than statistical MT (it marks
 * unknown tokens with a leading '#'). Used only as a fallback, and flagged as
 * `approximate` so the UI can say so.
 */
export class ApertiumProvider implements TranslationProvider {
  readonly name = 'Apertium'
  private baseUrl = 'https://apertium.org/apy/translate'

  /** ISO 639-1 -> the ISO 639-3 codes Apertium expects. */
  private static readonly CODE_MAP: Record<string, string> = {
    en: 'eng',
    es: 'spa',
    fr: 'fra',
    it: 'ita',
    pt: 'por',
    ca: 'cat',
    gl: 'glg',
  }

  /** Verified live against Apertium's own /listPairs endpoint. */
  private static readonly PAIRS = new Set([
    'eng-spa', 'eng-cat', 'eng-glg',
    'spa-eng', 'spa-cat', 'spa-fra', 'spa-glg', 'spa-ita', 'spa-por',
    'cat-eng', 'cat-fra', 'cat-ita', 'cat-por', 'cat-spa',
    'fra-cat', 'fra-spa',
    'glg-eng', 'glg-por', 'glg-spa',
    'ita-cat', 'ita-spa',
    'por-cat', 'por-glg', 'por-spa',
  ])

  private pairKey(from: string, to: string): string | null {
    const src = ApertiumProvider.CODE_MAP[baseLang(from)]
    const tgt = ApertiumProvider.CODE_MAP[baseLang(to)]
    if (!src || !tgt) return null
    return `${src}-${tgt}`
  }

  supports(from: string, to: string): boolean {
    const key = this.pairKey(from, to)
    return key !== null && ApertiumProvider.PAIRS.has(key)
  }

  async translate(request: TranslationRequest): Promise<ProviderResult> {
    const key = this.pairKey(request.from, request.to)
    if (!key || !ApertiumProvider.PAIRS.has(key)) {
      throw new Error('Apertium does not support this language pair')
    }

    const params = new URLSearchParams({
      langpair: key.replace('-', '|'),
      q: request.text,
    })

    const response = await fetchWithTimeout(`${this.baseUrl}?${params}`)
    if (!response.ok) {
      throw new Error(`Apertium HTTP ${response.status}`)
    }

    const data = await response.json()
    const raw: string = data.responseData?.translatedText ?? ''
    if (!raw) {
      throw new Error('Apertium returned an empty translation')
    }

    // Apertium prefixes tokens it could not analyse with '#'. Count them
    // before stripping so we can lower confidence honestly.
    const unknownCount = (raw.match(/#/g) ?? []).length
    const wordCount = raw.split(/\s+/).filter(Boolean).length || 1
    const cleaned = raw.replace(/#/g, '')

    const confidence = Math.max(0.3, 0.75 - unknownCount / wordCount)

    return {
      translatedText: cleaned,
      confidence,
      provider: this.name,
      quality: 'approximate',
      detectedLanguage: baseLang(request.from),
    }
  }
}
