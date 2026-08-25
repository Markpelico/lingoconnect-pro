import { expect, gotoFresh, test } from './fixtures'

test.describe('export', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('offers the three formats', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click()

    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: /Anki/ })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /CSV/ })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /JSON/ })).toBeVisible()
  })

  test('downloads a CSV containing the phrases', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /CSV/ }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^lingoconnect-phrases-\d{4}-\d{2}-\d{2}\.csv$/)

    const stream = await download.createReadStream()
    const content = (await streamToString(stream)).replace(/^﻿/, '')

    expect(content.split('\r\n')[0]).toContain('source_text,translated_text')
    expect(content).toContain('Could you say that more slowly?')
    // Accents must survive the round trip.
    expect(content).toContain('¿Podrías decirlo más despacio?')
  })

  test('downloads an Anki file with tab separated fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /Anki/ }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/\.txt$/)

    const content = (await streamToString(await download.createReadStream())).replace(
      /^﻿/,
      ''
    )
    const firstLine = content.split('\n')[0]

    expect(firstLine.split('\t')).toHaveLength(3)
    expect(firstLine).toContain('lingoconnect')
  })

  test('downloads JSON that round trips every phrase', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /JSON/ }).click(),
    ])

    const parsed = JSON.parse(await streamToString(await download.createReadStream()))
    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem('lingoconnect-phrasebook')!).state.phrases
    )

    expect(parsed.version).toBe(1)
    expect(parsed.phrases).toEqual(stored)
  })

  test('is disabled when there is nothing to export', async ({ page }) => {
    await page.evaluate(() => {
      const key = 'lingoconnect-phrasebook'
      // `seeded: true` means the samples will not come back.
      localStorage.setItem(key, JSON.stringify({ state: { phrases: [], seeded: true }, version: 2 }))
    })
    await page.reload()

    await expect(page.getByText('Nothing saved yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export' })).toBeHidden()
  })
})

async function streamToString(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) return ''
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8')
}
