import { describe, expect, it } from 'vitest'
import {
  judgeRecall,
  levenshtein,
  normalizePhrase,
  similarity,
  wordOverlap,
} from './recall'

describe('normalizePhrase', () => {
  it('lowercases and trims', () => {
    expect(normalizePhrase('  Hola Mundo  ')).toBe('hola mundo')
  })

  it('strips accents so recogniser inconsistency does not fail a correct answer', () => {
    expect(normalizePhrase('¿Dónde está la estación?')).toBe('donde esta la estacion')
  })

  it('drops Spanish opening punctuation', () => {
    expect(normalizePhrase('¡Buenos días!')).toBe('buenos dias')
  })

  it('collapses repeated whitespace left by removed punctuation', () => {
    expect(normalizePhrase('hola,   mundo')).toBe('hola mundo')
  })

  it('keeps digits', () => {
    expect(normalizePhrase('cuesta 20 euros')).toBe('cuesta 20 euros')
  })

  it('handles non-Latin script without stripping it', () => {
    expect(normalizePhrase('駅はどこですか。')).toBe('駅はどこですか')
  })

  it('returns empty string for punctuation only', () => {
    expect(normalizePhrase('?!.,')).toBe('')
  })
})

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('hola', 'hola')).toBe(0)
  })

  it('counts a single substitution', () => {
    expect(levenshtein('hola', 'hole')).toBe(1)
  })

  it('counts insertions and deletions', () => {
    expect(levenshtein('hola', 'hol')).toBe(1)
    expect(levenshtein('hol', 'hola')).toBe(1)
  })

  it('handles an empty operand', () => {
    expect(levenshtein('', 'hola')).toBe(4)
    expect(levenshtein('hola', '')).toBe(4)
    expect(levenshtein('', '')).toBe(0)
  })

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'))
  })

  it('matches the textbook example', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('similarity', () => {
  it('is 1 for identical strings', () => {
    expect(similarity('hola', 'hola')).toBe(1)
  })

  it('is 1 for two empty strings', () => {
    expect(similarity('', '')).toBe(1)
  })

  it('is 0 when nothing matches', () => {
    expect(similarity('abc', 'xyz')).toBe(0)
  })

  it('falls as strings diverge', () => {
    const near = similarity('donde esta la estacion', 'donde esta la estacio')
    const far = similarity('donde esta la estacion', 'quiero comer pan')
    expect(near).toBeGreaterThan(far)
  })
})

describe('wordOverlap', () => {
  it('is 1 when every expected word appears', () => {
    expect(wordOverlap('donde esta la estacion', 'donde esta la estacion')).toBe(1)
  })

  it('is unaffected by word order', () => {
    // Character similarity would punish this; word overlap should not.
    expect(wordOverlap('esta donde la estacion', 'donde esta la estacion')).toBe(1)
  })

  it('reports the fraction of expected words found', () => {
    expect(wordOverlap('donde esta', 'donde esta la estacion')).toBe(0.5)
  })

  it('does not double count a repeated word', () => {
    expect(wordOverlap('si si si', 'si si no')).toBeCloseTo(2 / 3)
  })

  it('is 0 when nothing matches', () => {
    expect(wordOverlap('completamente distinto', 'donde esta')).toBe(0)
  })

  it('ignores extra words the user added', () => {
    expect(wordOverlap('pues donde esta la estacion ahora', 'donde esta la estacion')).toBe(1)
  })
})

describe('judgeRecall', () => {
  const EXPECTED = '¿Dónde está la estación?'

  it('accepts an exact answer', () => {
    const result = judgeRecall('¿Dónde está la estación?', EXPECTED)
    expect(result.verdict).toBe('match')
    expect(result.similarity).toBe(1)
  })

  it('accepts an answer missing accents', () => {
    // Recognisers frequently drop these; failing here would be unfair.
    expect(judgeRecall('donde esta la estacion', EXPECTED).verdict).toBe('match')
  })

  it('accepts an answer missing punctuation and casing', () => {
    expect(judgeRecall('Donde esta la estacion', EXPECTED).verdict).toBe('match')
  })

  it('accepts a small transcription slip', () => {
    expect(judgeRecall('donde esta la estacion de', EXPECTED).verdict).toBe('match')
  })

  it('treats a partial attempt as close rather than wrong', () => {
    const result = judgeRecall('donde esta', EXPECTED)
    expect(result.verdict).toBe('close')
  })

  it('rejects an unrelated phrase', () => {
    expect(judgeRecall('quiero comer pan', EXPECTED).verdict).toBe('different')
  })

  it('declines to judge an empty transcript', () => {
    expect(judgeRecall('', EXPECTED).verdict).toBe('unclear')
    expect(judgeRecall('   ', EXPECTED).verdict).toBe('unclear')
  })

  it('declines to judge when the recogniser was not confident and the score is poor', () => {
    // Low confidence plus a bad score is not evidence the user was wrong.
    const result = judgeRecall('mumble noise', EXPECTED, 0.1)
    expect(result.verdict).toBe('unclear')
  })

  it('still accepts a strong match even from a low-confidence transcript', () => {
    const result = judgeRecall('donde esta la estacion', EXPECTED, 0.1)
    expect(result.verdict).toBe('match')
  })

  it('never reports a confident failure it cannot support', () => {
    // The core safety property: a poor transcript we do not trust must come
    // back as 'unclear', never as 'different'.
    for (const attempt of ['', '   ', 'zzz', 'uh']) {
      const verdict = judgeRecall(attempt, EXPECTED, 0.05).verdict
      expect(verdict).toBe('unclear')
    }
  })

  it('exposes the normalised strings for display', () => {
    const result = judgeRecall('¡Dónde ESTÁ!', EXPECTED)
    expect(result.normalizedSpoken).toBe('donde esta')
    expect(result.normalizedExpected).toBe('donde esta la estacion')
  })

  it('handles a single-word phrase', () => {
    expect(judgeRecall('gracias', 'Gracias').verdict).toBe('match')
    expect(judgeRecall('perdon', 'Gracias').verdict).toBe('different')
  })

  it('scores between 0 and 1 for any input', () => {
    const cases: Array<[string, string]> = [
      ['', ''],
      ['a', 'b'],
      ['hola mundo', 'hola'],
      ['completely different words here', 'otra cosa'],
    ]
    for (const [spoken, expected] of cases) {
      const { similarity: score } = judgeRecall(spoken, expected)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})
