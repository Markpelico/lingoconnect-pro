import { expect, gotoFresh, test } from './fixtures'

test.describe('capture and review', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('a first visit shows sample phrases so the concept is legible', async ({ page }) => {
    await expect(page.getByText('Sample phrases', { exact: false })).toBeVisible()
    // One sample is deliberately due, so the review card is populated on arrival.
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible()
  })

  test('a translated phrase is saved and replaces the samples', async ({ page }) => {
    await page.getByPlaceholder('Or type a phrase').fill('Is there a pharmacy near here?')
    await page.getByRole('button', { name: 'Translate typed phrase' }).click()

    // Scoped to the conversation panel: the phrase also appears in the saved
    // list below, which would make a bare text match ambiguous.
    await expect(
      page.locator('#talk').getByText('¿Hay una farmacia cerca de aquí?')
    ).toBeVisible()
    await expect(page.getByText('Saved to phrasebook')).toBeVisible()

    // Samples make way for the first real phrase rather than sitting alongside it.
    await expect(page.getByText('Sample phrases', { exact: false })).toBeHidden()

    const phrases = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases
    )
    expect(phrases).toHaveLength(1)
    expect(phrases[0].sourceText).toBe('Is there a pharmacy near here?')
    expect(phrases[0].isSample).toBeFalsy()
    expect(phrases[0].mode).toBe('production')
  })

  test('a failed translation is surfaced and never invented', async ({ page }) => {
    // The mock treats unknown input as a provider outage.
    await page.getByPlaceholder('Or type a phrase').fill('an untranslatable sentence')
    await page.getByRole('button', { name: 'Translate typed phrase' }).click()

    await expect(page.getByText('temporarily unavailable', { exact: false })).toBeVisible()

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('[Spanish Translation]')

    // A failure must not enter the phrasebook; you cannot learn a phrase the
    // app never actually produced.
    const phrases = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases
    )
    expect(phrases.filter((p: { isSample?: boolean }) => !p.isSample)).toHaveLength(0)
  })

  test('reviewing a phrase pushes it further out on the schedule', async ({ page }) => {
    await page.getByPlaceholder('Or type a phrase').fill('Where is the train station?')
    await page.getByRole('button', { name: 'Translate typed phrase' }).click()
    await expect(page.getByText('Saved to phrasebook')).toBeVisible()

    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByRole('button', { name: 'Got it' }).click()

    await expect(page.getByText('All caught up')).toBeVisible()

    const phrase = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases[0]
    )
    expect(phrase.box).toBe(1)
    expect(phrase.reviewCount).toBe(1)

    const daysOut = (new Date(phrase.dueAt).getTime() - Date.now()) / 86_400_000
    expect(daysOut).toBeGreaterThan(0.9)
    expect(daysOut).toBeLessThan(1.1)
  })

  test('forgetting a phrase sends it back to the start', async ({ page }) => {
    await page.getByPlaceholder('Or type a phrase').fill('Where is the train station?')
    await page.getByRole('button', { name: 'Translate typed phrase' }).click()
    await expect(page.getByText('Saved to phrasebook')).toBeVisible()

    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByText('All caught up')).toBeVisible()

    // Force it due again, then fail the review.
    await page.evaluate(() => {
      const key = 'lingoconnect-phrasebook'
      const store = JSON.parse(localStorage.getItem(key)!)
      store.state.phrases[0].dueAt = new Date(Date.now() - 1000).toISOString()
      localStorage.setItem(key, JSON.stringify(store))
    })
    await page.reload()

    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByRole('button', { name: 'Not yet' }).click()

    const phrase = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases[0]
    )
    expect(phrase.box).toBe(0)
    expect(phrase.lapseCount).toBe(1)
  })
})
