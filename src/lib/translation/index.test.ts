import { describe, expect, it, vi } from 'vitest'
import { TranslationService, TranslationUnavailableError } from './index'
import type { ProviderResult, TranslationProvider } from './providers'

const REQUEST = { text: 'Where is the station?', from: 'en-US', to: 'es-ES' }

function stubProvider(
  name: string,
  behaviour: {
    supports?: boolean
    result?: Partial<ProviderResult>
    error?: string
  } = {}
): TranslationProvider {
  return {
    name,
    supports: vi.fn(() => behaviour.supports ?? true),
    translate: vi.fn(async () => {
      if (behaviour.error) throw new Error(behaviour.error)
      return {
        translatedText: `${name} output`,
        confidence: 0.9,
        provider: name,
        quality: 'good' as const,
        ...behaviour.result,
      }
    }),
  }
}

describe('TranslationService', () => {
  it('uses the first provider that succeeds', async () => {
    const first = stubProvider('First')
    const second = stubProvider('Second')

    const result = await new TranslationService([first, second]).translate(REQUEST)

    expect(result.provider).toBe('First')
    // The second provider is never consulted once the first works.
    expect(second.translate).not.toHaveBeenCalled()
  })

  it('falls through to the next provider when one throws', async () => {
    const failing = stubProvider('Failing', { error: 'upstream exploded' })
    const working = stubProvider('Working')

    const result = await new TranslationService([failing, working]).translate(REQUEST)

    expect(result.provider).toBe('Working')
    expect(failing.translate).toHaveBeenCalled()
  })

  it('skips providers that do not support the pair without calling them', async () => {
    const unsupported = stubProvider('Unsupported', { supports: false })
    const working = stubProvider('Working')

    const result = await new TranslationService([unsupported, working]).translate(REQUEST)

    expect(result.provider).toBe('Working')
    expect(unsupported.translate).not.toHaveBeenCalled()
  })

  it('records why each earlier provider was passed over', async () => {
    const unsupported = stubProvider('Unsupported', { supports: false })
    const failing = stubProvider('Failing', { error: 'timeout' })
    const working = stubProvider('Working')

    const result = await new TranslationService([
      unsupported,
      failing,
      working,
    ]).translate(REQUEST)

    expect(result.attempted).toEqual([
      { provider: 'Unsupported', error: 'language pair not supported' },
      { provider: 'Failing', error: 'timeout' },
    ])
  })

  it('throws rather than inventing a translation when everything fails', async () => {
    const service = new TranslationService([
      stubProvider('A', { error: 'down' }),
      stubProvider('B', { error: 'also down' }),
    ])

    // The whole point of the rewrite: no mock fallback, no fabricated output.
    await expect(service.translate(REQUEST)).rejects.toBeInstanceOf(
      TranslationUnavailableError
    )
  })

  it('carries the full attempt history on the thrown error', async () => {
    const service = new TranslationService([
      stubProvider('A', { error: 'down' }),
      stubProvider('B', { supports: false }),
    ])

    await expect(service.translate(REQUEST)).rejects.toMatchObject({
      attempted: [
        { provider: 'A', error: 'down' },
        { provider: 'B', error: 'language pair not supported' },
      ],
    })
  })

  it('throws when no provider supports the pair at all', async () => {
    const service = new TranslationService([
      stubProvider('A', { supports: false }),
      stubProvider('B', { supports: false }),
    ])

    await expect(service.translate(REQUEST)).rejects.toBeInstanceOf(
      TranslationUnavailableError
    )
  })

  it('preserves the provider quality flag through the chain', async () => {
    const service = new TranslationService([
      stubProvider('Rough', { result: { quality: 'approximate' } }),
    ])

    expect((await service.translate(REQUEST)).quality).toBe('approximate')
  })

  it('reports which providers can handle a pair', () => {
    const service = new TranslationService([
      stubProvider('Yes'),
      stubProvider('No', { supports: false }),
    ])

    expect(service.availableFor('en-US', 'es-ES')).toEqual(['Yes'])
  })
})
