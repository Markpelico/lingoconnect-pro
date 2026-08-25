import { test as base, type Page } from '@playwright/test'

/**
 * Shared setup for the end-to-end suite.
 *
 * Two things have to be faked, and both for the same reason: the real thing is
 * non-deterministic and would make the suite flaky rather than useful.
 *
 *  - Speech recognition, because there is no microphone in CI. The stub has to
 *    be installed with `addInitScript` rather than from the console: the app
 *    builds its recogniser from `window.SpeechRecognition` on first mount, so
 *    a stub applied after load is simply never seen.
 *  - The translation API, because it calls a live third-party service with a
 *    daily quota. Tests should fail when the app breaks, not when MyMemory is
 *    rate limiting.
 */

/** Canned translations, so assertions can be exact. */
const TRANSLATIONS: Record<string, string> = {
  'Is there a pharmacy near here?': '¿Hay una farmacia cerca de aquí?',
  'Where is the train station?': '¿Dónde está la estación de tren?',
  'Could you say that more slowly?': '¿Podrías decirlo más despacio?',
  '¿Dónde está el baño?': 'Where is the bathroom?',
  'Está a la vuelta de la esquina': "It's around the corner",
  'I need a doctor': 'Necesito un médico',
}

export interface SpeechControls {
  /** Deliver a final recognition result to whatever is currently listening. */
  say(transcript: string, confidence?: number): Promise<void>
  /** The language the recogniser was last told to expect. */
  currentLanguage(): Promise<string | null>
}

async function installSpeechStub(page: Page) {
  await page.addInitScript(() => {
    class StubRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart: ((e: Event) => void) | null = null
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: ((e: Event) => void) | null = null
      onspeechstart: ((e: Event) => void) | null = null
      onspeechend: ((e: Event) => void) | null = null
      onnomatch: ((e: Event) => void) | null = null

      start() {
        ;(window as unknown as Record<string, unknown>).__activeRecognition = this
        this.onstart?.(new Event('start'))
      }
      stop() {
        this.onend?.(new Event('end'))
      }
      abort() {}
      addEventListener() {}
      removeEventListener() {}
    }

    const w = window as unknown as Record<string, unknown>
    w.SpeechRecognition = StubRecognition
    w.webkitSpeechRecognition = StubRecognition

    w.__say = (transcript: string, confidence = 0.9) => {
      const recognition = w.__activeRecognition as StubRecognition | undefined
      if (!recognition?.onresult) return false
      const alternative = { transcript, confidence }
      const result = Object.assign([alternative], {
        length: 1,
        isFinal: true,
        item: () => alternative,
      })
      recognition.onresult({
        resultIndex: 0,
        results: Object.assign([result], { length: 1 }),
      })
      return true
    }

    w.__recognitionLanguage = () =>
      (w.__activeRecognition as StubRecognition | undefined)?.lang ?? null

    // Speech synthesis is fire-and-forget in the app, but jsdom-less Chromium
    // in CI has no voices, so make it a no-op that resolves.
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = () => {}
      window.speechSynthesis.getVoices = () => []
    }
  })
}

async function mockTranslationApi(page: Page) {
  await page.route('**/api/translate', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()

    const body = request.postDataJSON() as { text: string; from: string; to: string }
    const translated = TRANSLATIONS[body.text.trim()]

    if (!translated) {
      // Unknown input is treated as a provider outage, which exercises the
      // honest-failure path rather than inventing output.
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Translation is temporarily unavailable for this language pair.',
            code: 'TRANSLATION_UNAVAILABLE',
            attempted: [{ provider: 'MyMemory', error: 'mocked outage' }],
          },
        }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          translatedText: translated,
          confidence: 0.95,
          provider: 'MyMemory',
          quality: 'good',
          detectedLanguage: body.from,
          processingTime: 12,
        },
      }),
    })
  })
}

export const test = base.extend<{ stubs: void; speech: SpeechControls }>({
  /**
   * Installed for every test, not just the ones that ask for `speech`.
   *
   * Playwright fixtures are lazy: a `beforeEach` that only destructures
   * `page` would navigate before a non-auto fixture had run, and
   * `addInitScript` applied after navigation is never seen by the page.
   */
  stubs: [
    async ({ page }, use) => {
      await installSpeechStub(page)
      await mockTranslationApi(page)
      await use()
    },
    { auto: true },
  ],

  speech: async ({ page }, use) => {
    await use({
      async say(transcript, confidence = 0.9) {
        await page.evaluate(
          ([text, conf]) =>
            (window as unknown as Record<string, (t: string, c: number) => boolean>)
              .__say(text as string, conf as number),
          [transcript, confidence] as const
        )
      },
      async currentLanguage() {
        return page.evaluate(() =>
          (window as unknown as Record<string, () => string | null>).__recognitionLanguage()
        )
      },
    })
  },
})

export { expect } from '@playwright/test'

/** Land on a clean first visit, with the demo samples freshly seeded. */
export async function gotoFresh(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  // The phrasebook renders only after hydration seeds the samples.
  await page.getByText('Sample phrases', { exact: false }).waitFor()
}
