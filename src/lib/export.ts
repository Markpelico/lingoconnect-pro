/**
 * Getting your phrases back out.
 *
 * The phrasebook lives in localStorage, which means clearing your browser
 * loses it. For an app whose whole argument is "don't do things that quietly
 * hurt the user", leaving the data with no way out is inconsistent.
 */

import type { CapturedPhrase } from '@/lib/phrases'

export type ExportFormat = 'csv' | 'anki' | 'json'

/**
 * Escape one CSV field per RFC 4180.
 *
 * A field is quoted when it contains a comma, quote, or newline, and embedded
 * quotes are doubled. Skipping this is the classic way a phrase containing a
 * comma silently shifts every later column.
 */
export function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function toCsv(phrases: CapturedPhrase[]): string {
  const header = [
    'source_text',
    'translated_text',
    'source_language',
    'target_language',
    'direction',
    'box',
    'review_count',
    'lapse_count',
    'captured_at',
    'due_at',
  ]

  const rows = phrases.map((p) =>
    [
      p.sourceText,
      p.translatedText,
      p.sourceLanguage,
      p.targetLanguage,
      p.mode ?? 'production',
      String(p.box),
      String(p.reviewCount),
      String(p.lapseCount),
      p.capturedAt,
      p.dueAt,
    ]
      .map(escapeCsvField)
      .join(',')
  )

  // CRLF line endings, which is what RFC 4180 specifies and what Excel wants.
  return [header.join(','), ...rows].join('\r\n')
}

/**
 * Anki's default import is tab separated: front, back, then tags.
 *
 * Tabs and newlines inside a field would break the row, so they are collapsed
 * to spaces rather than escaped; Anki has no quoting convention to escape to.
 */
export function toAnkiTsv(phrases: CapturedPhrase[]): string {
  const flatten = (value: string) => value.replace(/[\t\r\n]+/g, ' ').trim()

  return phrases
    .map((p) => {
      // sourceText is always what was said and translatedText what it became,
      // so front/back is the same either way: a production card shows your
      // language and asks for theirs, a comprehension card shows theirs and
      // asks what it meant. The mode is carried in the tags instead.
      const front = p.sourceText
      const back = p.translatedText

      const tags = [
        'lingoconnect',
        `${p.sourceLanguage}-${p.targetLanguage}`,
        p.mode ?? 'production',
      ].join(' ')

      return [flatten(front), flatten(back), tags].join('\t')
    })
    .join('\n')
}

/** Full fidelity, so an export can be read back without losing progress. */
export function toJson(phrases: CapturedPhrase[]): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), phrases },
    null,
    2
  )
}

export interface ExportPayload {
  content: string
  filename: string
  mimeType: string
}

export function buildExport(
  phrases: CapturedPhrase[],
  format: ExportFormat,
  now: Date = new Date()
): ExportPayload {
  const stamp = now.toISOString().slice(0, 10)

  switch (format) {
    case 'csv':
      return {
        content: toCsv(phrases),
        filename: `lingoconnect-phrases-${stamp}.csv`,
        mimeType: 'text/csv;charset=utf-8',
      }
    case 'anki':
      return {
        content: toAnkiTsv(phrases),
        filename: `lingoconnect-anki-${stamp}.txt`,
        mimeType: 'text/tab-separated-values;charset=utf-8',
      }
    case 'json':
      return {
        content: toJson(phrases),
        filename: `lingoconnect-phrases-${stamp}.json`,
        mimeType: 'application/json',
      }
  }
}

/**
 * Hand the file to the browser.
 *
 * Kept separate from `buildExport` so the formatting is testable without a
 * DOM.
 */
export function downloadExport(payload: ExportPayload): void {
  // A BOM makes Excel read UTF-8 correctly instead of mangling accents.
  const needsBom = payload.mimeType.startsWith('text/')
  const blob = new Blob([needsBom ? '﻿' : '', payload.content], {
    type: payload.mimeType,
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = payload.filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
