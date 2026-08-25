/**
 * Translation orchestration.
 *
 * Tries each provider that claims to support the language pair, in order of
 * quality. If they all fail, it throws — the caller surfaces that to the user.
 *
 * There is deliberately no mock fallback. The previous implementation returned
 * a 40-entry hardcoded phrasebook and, failing that, the literal string
 * "[Spanish Translation] <your text>" labelled with 70% confidence. Silently
 * inventing output is worse than admitting failure, especially in an app whose
 * whole premise is that you trust it mid-conversation.
 */

import type { TranslationRequest } from '@/types'
import {
  ApertiumProvider,
  MyMemoryProvider,
  type ProviderQuality,
  type TranslationProvider,
} from './providers'

export interface TranslationResult {
  translatedText: string
  confidence: number
  provider: string
  quality: ProviderQuality
  detectedLanguage?: string
  /** Providers that were tried and failed, for diagnostics. */
  attempted: Array<{ provider: string; error: string }>
}

export class TranslationUnavailableError extends Error {
  constructor(
    message: string,
    public readonly attempted: Array<{ provider: string; error: string }>
  ) {
    super(message)
    this.name = 'TranslationUnavailableError'
  }
}

export class TranslationService {
  private providers: TranslationProvider[]

  constructor(providers?: TranslationProvider[]) {
    this.providers = providers ?? [new MyMemoryProvider(), new ApertiumProvider()]
  }

  /** Which providers could handle this pair, if any. */
  availableFor(from: string, to: string): string[] {
    return this.providers.filter((p) => p.supports(from, to)).map((p) => p.name)
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const attempted: Array<{ provider: string; error: string }> = []

    for (const provider of this.providers) {
      if (!provider.supports(request.from, request.to)) {
        attempted.push({
          provider: provider.name,
          error: 'language pair not supported',
        })
        continue
      }

      try {
        const result = await provider.translate(request)
        return { ...result, attempted }
      } catch (error) {
        attempted.push({
          provider: provider.name,
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }

    throw new TranslationUnavailableError(
      'No translation provider could handle this request',
      attempted
    )
  }
}

export const translationService = new TranslationService()
export { baseLang } from './providers'
export type { ProviderQuality } from './providers'
