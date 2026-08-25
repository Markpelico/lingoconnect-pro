import { expect, gotoFresh, test } from './fixtures'

test.describe('speaking', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('your side listens in the language you speak', async ({ page, speech }) => {
    await page.getByRole('button', { name: /Listen in English/ }).click()
    expect(await speech.currentLanguage()).toBe('en-US')
  })

  test('their side listens in the language you are learning', async ({ page, speech }) => {
    // Running their audio through your language model produces confident
    // nonsense rather than an error, so this switch matters.
    await page.getByRole('button', { name: /Listen in Spanish/ }).click()
    expect(await speech.currentLanguage()).toBe('es-ES')
  })

  test('speaking captures a phrase the same way typing does', async ({ page, speech }) => {
    await page.getByRole('button', { name: /Listen in English/ }).click()
    await speech.say('Where is the train station?')

    await expect(
      page.locator('#talk').getByText('¿Dónde está la estación de tren?')
    ).toBeVisible()
    await expect(page.getByText('Saved to phrasebook')).toBeVisible()
  })

  test('their turn is captured as comprehension, translated back to you', async ({
    page,
    speech,
  }) => {
    await page.getByRole('button', { name: /Listen in Spanish/ }).click()
    await speech.say('¿Dónde está el baño?')

    await expect(
      page.locator('#talk').getByText('Where is the bathroom?')
    ).toBeVisible()

    const phrases = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases
    )
    const captured = phrases.find(
      (p: { sourceText: string }) => p.sourceText === '¿Dónde está el baño?'
    )

    expect(captured).toBeTruthy()
    // Their half runs the pair in reverse and tests understanding, not production.
    expect(captured.mode).toBe('comprehension')
    expect(captured.sourceLanguage).toBe('es-ES')
    expect(captured.targetLanguage).toBe('en-US')
  })

  test('a comprehension card asks what a phrase meant', async ({ page, speech }) => {
    await page.getByRole('button', { name: /Listen in Spanish/ }).click()
    await speech.say('¿Dónde está el baño?')
    await expect(
      page.locator('#talk').getByText('Where is the bathroom?')
    ).toBeVisible()

    // Clear the production cards so the comprehension one is what is due.
    await page.evaluate(() => {
      const key = 'lingoconnect-phrasebook'
      const store = JSON.parse(localStorage.getItem(key)!)
      store.state.phrases = store.state.phrases.filter(
        (p: { mode?: string }) => p.mode === 'comprehension'
      )
      store.state.phrases[0].dueAt = new Date(Date.now() - 1000).toISOString()
      localStorage.setItem(key, JSON.stringify(store))
    })
    await page.reload()

    await expect(page.getByText('What does this mean?')).toBeVisible()
    // Saying a meaning back in your own language proves nothing, so the
    // spoken-recall button is not offered here.
    await expect(page.getByRole('button', { name: 'Say it' })).toBeHidden()
  })
})

test.describe('uncertain speech', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('a low-confidence utterance is still shown, not silently dropped', async ({
    page,
    speech,
  }) => {
    // The regression this guards: the recogniser used to discard any final
    // result below the confidence threshold without telling anyone, so you
    // could speak, be heard correctly, and see nothing happen at all.
    await page.getByRole('button', { name: /Listen in English/ }).click()
    await speech.say('I need a doctor', 0.25)

    await expect(page.locator('#talk').getByText('I need a doctor')).toBeVisible()
    await expect(page.locator('#talk').getByText('Necesito un médico')).toBeVisible()
  })

  test('an uncertain utterance is caveated rather than presented as certain', async ({
    page,
    speech,
  }) => {
    await page.getByRole('button', { name: /Listen in English/ }).click()
    await speech.say('I need a doctor', 0.25)

    await expect(page.getByText('Not sure I heard that right')).toBeVisible()
  })

  test('an uncertain utterance is kept out of the phrasebook until confirmed', async ({
    page,
    speech,
  }) => {
    await page.getByRole('button', { name: /Listen in English/ }).click()
    await speech.say('I need a doctor', 0.25)
    await expect(page.getByText('Not sure I heard that right')).toBeVisible()

    const before = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases.filter(
          (p: { isSample?: boolean }) => !p.isSample
        ).length
    )
    expect(before).toBe(0)

    await page.getByRole('button', { name: 'Save anyway' }).click()

    const after = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases.filter(
          (p: { isSample?: boolean }) => !p.isSample
        )
    )
    expect(after).toHaveLength(1)
    expect(after[0].sourceText).toBe('I need a doctor')
  })

  test('a confident utterance is filed without asking', async ({ page, speech }) => {
    await page.getByRole('button', { name: /Listen in English/ }).click()
    await speech.say('I need a doctor', 0.95)

    await expect(page.getByText('Saved to phrasebook')).toBeVisible()
    await expect(page.getByText('Not sure I heard that right')).toBeHidden()
  })
})

test.describe('spoken recall', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('accepts a correct answer even without accents', async ({ page, speech }) => {
    await page.getByRole('button', { name: 'Say it' }).click()
    // Recognisers drop accents inconsistently; failing here would be unfair.
    await speech.say('Podrias decirlo mas despacio', 0.9)

    await expect(page.getByText('That was it')).toBeVisible()
  })

  test('a clear match advances the card', async ({ page, speech }) => {
    await page.getByRole('button', { name: 'Say it' }).click()
    await speech.say('¿Podrías decirlo más despacio?', 0.95)

    await expect(page.getByText('That was it')).toBeVisible()
    await expect(page.getByText('All caught up')).toBeVisible()
  })

  test('a partial answer is called close, not wrong', async ({ page, speech }) => {
    await page.getByRole('button', { name: 'Say it' }).click()
    await speech.say('Podrias decirlo', 0.9)

    await expect(page.getByText('Close')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('a low-confidence transcript is never called wrong', async ({ page, speech }) => {
    // The core safety property: when the recogniser is unsure, the app
    // declines to judge rather than telling a correct speaker they failed.
    await page.getByRole('button', { name: 'Say it' }).click()
    await speech.say('mmhm uh', 0.05)

    await expect(page.getByText("Didn't catch that")).toBeVisible()
    await expect(page.getByText('That did not sound like it')).toBeHidden()
  })

  test('shows what it heard so a verdict can be checked', async ({ page, speech }) => {
    await page.getByRole('button', { name: 'Say it' }).click()
    await speech.say('algo completamente distinto', 0.95)

    await expect(page.getByText('Heard:', { exact: false })).toBeVisible()
  })
})
