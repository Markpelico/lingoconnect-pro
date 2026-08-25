import { describe, expect, it } from 'vitest'
import {
  buildExport,
  escapeCsvField,
  toAnkiTsv,
  toCsv,
  toJson,
} from './export'
import type { CapturedPhrase } from './phrases'

const NOW = new Date('2026-03-01T12:00:00.000Z')

function makePhrase(overrides: Partial<CapturedPhrase> = {}): CapturedPhrase {
  return {
    id: 'p1',
    sourceText: 'Where is the station?',
    translatedText: '¿Dónde está la estación?',
    sourceLanguage: 'en-US',
    targetLanguage: 'es-ES',
    capturedAt: NOW.toISOString(),
    provider: 'MyMemory',
    quality: 'good',
    confidence: 1,
    box: 2,
    dueAt: NOW.toISOString(),
    reviewCount: 3,
    lapseCount: 1,
    ...overrides,
  }
}

describe('escapeCsvField', () => {
  it('leaves an ordinary field alone', () => {
    expect(escapeCsvField('hola')).toBe('hola')
  })

  it('quotes a field containing a comma', () => {
    // Without this the row silently gains a column and every later field
    // shifts, which is the classic way CSV exports corrupt data.
    expect(escapeCsvField('hola, amigo')).toBe('"hola, amigo"')
  })

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('say "hola"')).toBe('"say ""hola"""')
  })

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"')
  })

  it('quotes a field containing a carriage return', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"')
  })

  it('handles an empty field', () => {
    expect(escapeCsvField('')).toBe('')
  })
})

describe('toCsv', () => {
  it('writes a header row', () => {
    const csv = toCsv([])
    expect(csv.split('\r\n')[0]).toBe(
      'source_text,translated_text,source_language,target_language,direction,box,review_count,lapse_count,captured_at,due_at'
    )
  })

  it('writes one row per phrase', () => {
    const csv = toCsv([makePhrase({ id: 'a' }), makePhrase({ id: 'b' })])
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('uses CRLF line endings', () => {
    const csv = toCsv([makePhrase()])
    expect(csv).toContain('\r\n')
  })

  it('preserves accented characters', () => {
    expect(toCsv([makePhrase()])).toContain('¿Dónde está la estación?')
  })

  it('escapes a phrase containing a comma', () => {
    const csv = toCsv([makePhrase({ sourceText: 'Well, hello there' })])
    expect(csv).toContain('"Well, hello there"')
    // Header plus exactly one data row, so the comma did not split the row.
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  it('defaults the direction to production', () => {
    expect(toCsv([makePhrase()])).toContain(',production,')
  })

  it('records a comprehension phrase as such', () => {
    expect(toCsv([makePhrase({ mode: 'comprehension' })])).toContain(
      ',comprehension,'
    )
  })

  it('includes review progress', () => {
    const row = toCsv([makePhrase({ box: 4, reviewCount: 7, lapseCount: 2 })])
      .split('\r\n')[1]
      .split(',')
    expect(row).toContain('4')
    expect(row).toContain('7')
    expect(row).toContain('2')
  })
})

describe('toAnkiTsv', () => {
  it('writes front, back, and tags separated by tabs', () => {
    const line = toAnkiTsv([makePhrase()]).split('\n')[0]
    const fields = line.split('\t')

    expect(fields).toHaveLength(3)
    expect(fields[0]).toBe('Where is the station?')
    expect(fields[1]).toBe('¿Dónde está la estación?')
  })

  it('tags the language pair and direction', () => {
    const tags = toAnkiTsv([makePhrase()]).split('\t')[2]
    expect(tags).toContain('lingoconnect')
    expect(tags).toContain('en-US-es-ES')
    expect(tags).toContain('production')
  })

  it('tags a comprehension card as such', () => {
    const tags = toAnkiTsv([makePhrase({ mode: 'comprehension' })]).split('\t')[2]
    expect(tags).toContain('comprehension')
  })

  it('collapses tabs inside a field so the row cannot break', () => {
    // Anki has no quoting convention, so a stray tab would shift the columns.
    const line = toAnkiTsv([makePhrase({ sourceText: 'a\tb' })])
    expect(line.split('\t')).toHaveLength(3)
    expect(line).toContain('a b')
  })

  it('collapses newlines inside a field', () => {
    const out = toAnkiTsv([makePhrase({ sourceText: 'a\nb' })])
    expect(out.split('\n')).toHaveLength(1)
  })

  it('writes one line per phrase', () => {
    const out = toAnkiTsv([makePhrase({ id: 'a' }), makePhrase({ id: 'b' })])
    expect(out.split('\n')).toHaveLength(2)
  })

  it('returns empty output for no phrases', () => {
    expect(toAnkiTsv([])).toBe('')
  })
})

describe('toJson', () => {
  it('round trips every phrase without loss', () => {
    const phrases = [makePhrase({ id: 'a' }), makePhrase({ id: 'b', box: 4 })]
    const parsed = JSON.parse(toJson(phrases))

    expect(parsed.version).toBe(1)
    expect(parsed.phrases).toEqual(phrases)
  })

  it('records when the export was made', () => {
    expect(JSON.parse(toJson([])).exportedAt).toBeTruthy()
  })
})

describe('buildExport', () => {
  it('names the CSV file with the date', () => {
    const out = buildExport([makePhrase()], 'csv', NOW)
    expect(out.filename).toBe('lingoconnect-phrases-2026-03-01.csv')
    expect(out.mimeType).toContain('text/csv')
  })

  it('names the Anki file with a txt extension, which is what Anki expects', () => {
    const out = buildExport([makePhrase()], 'anki', NOW)
    expect(out.filename).toBe('lingoconnect-anki-2026-03-01.txt')
  })

  it('names the JSON file with the date', () => {
    const out = buildExport([makePhrase()], 'json', NOW)
    expect(out.filename).toBe('lingoconnect-phrases-2026-03-01.json')
    expect(out.mimeType).toBe('application/json')
  })

  it('produces content for every format', () => {
    for (const format of ['csv', 'anki', 'json'] as const) {
      expect(buildExport([makePhrase()], format, NOW).content.length).toBeGreaterThan(0)
    }
  })

  it('handles an empty phrasebook without throwing', () => {
    for (const format of ['csv', 'anki', 'json'] as const) {
      expect(() => buildExport([], format, NOW)).not.toThrow()
    }
  })
})
