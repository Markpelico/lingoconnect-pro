/**
 * Judging a spoken recall attempt.
 *
 * Deliberately NOT pronunciation scoring. Browser speech recognition is
 * unreliable on non-native speech, so a system that graded your accent would
 * confidently tell correct speakers they were wrong. That is the same failure
 * this project removed from the translation layer, and it is not worth
 * reintroducing for a nicer-sounding feature name.
 *
 * What this does instead: check whether you produced roughly the right words,
 * and when the recogniser is not confident enough to say, admit it and hand
 * the judgement back to you.
 */

export type RecallVerdict =
  /** Close enough to count. */
  | 'match'
  /** Recognisably the same attempt, but words are missing or wrong. */
  | 'close'
  /** Not the phrase. */
  | 'different'
  /** The recogniser did not give us enough to judge. Ask the user. */
  | 'unclear'

export interface RecallJudgement {
  verdict: RecallVerdict
  /** 0 to 1 similarity between the normalised strings. */
  similarity: number
  normalizedSpoken: string
  normalizedExpected: string
}

/** At or above this, the attempt counts. */
const MATCH_THRESHOLD = 0.82
/**
 * At or above this, it is the right attempt but imperfect. Recalling half
 * the words means you were on the right track, so this sits below 0.5.
 */
const CLOSE_THRESHOLD = 0.45
/**
 * Below this recognition confidence we do not trust the transcript enough to
 * contradict the user.
 */
const MIN_RECOGNITION_CONFIDENCE = 0.3

/**
 * Strip everything that is not the words themselves.
 *
 * Accents are removed on purpose. Speech recognisers are inconsistent about
 * emitting them, and this is a recall check, not a spelling test. It does mean
 * `año` and `ano` compare equal, which is a real distinction in Spanish, but
 * being strict here would fail people who actually said it correctly.
 */
export function normalizePhrase(text: string): string {
  return (
    text
      .normalize('NFD')
      // Latin combining diacriticals only. Deliberately not \p{M}: NFD also
      // splits Japanese voiced kana (ど -> と + U+3099), and stripping that
      // mark would turn どこ into とこ, changing the word.
      .replace(/[̀-ͯ]/g, '')
      // Recompose, so any decomposition we did not strip (the kana above)
      // becomes a single character again rather than a bare combining mark
      // that the punctuation filter below would turn into a space.
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Levenshtein edit distance, iterative with two rows so memory stays O(min).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Iterate over the shorter string to keep the row small.
  if (a.length > b.length) [a, b] = [b, a]

  let previous = Array.from({ length: a.length + 1 }, (_, i) => i)
  let current = new Array<number>(a.length + 1)

  for (let j = 1; j <= b.length; j++) {
    current[0] = j
    for (let i = 1; i <= a.length; i++) {
      const substitution = previous[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[i] = Math.min(
        substitution,
        previous[i] + 1, // deletion
        current[i - 1] + 1 // insertion
      )
    }
    ;[previous, current] = [current, previous]
  }

  return previous[a.length]
}

/** Character-level similarity from edit distance, 0 to 1. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - levenshtein(a, b) / longest
}

/**
 * Fraction of the expected words that appear in the attempt.
 *
 * Character similarity alone punishes a correct-but-reordered attempt too
 * harshly, and rewards a wrong attempt that happens to share letters. Taking
 * the better of the two measures is more forgiving in the right direction.
 */
export function wordOverlap(spoken: string, expected: string): number {
  const expectedWords = expected.split(' ').filter(Boolean)
  if (expectedWords.length === 0) return spoken.length === 0 ? 1 : 0

  const spokenWords = spoken.split(' ').filter(Boolean)
  const remaining = [...spokenWords]

  let hits = 0
  for (const word of expectedWords) {
    const index = remaining.indexOf(word)
    if (index !== -1) {
      hits++
      // Consume the match so repeated words are not double counted.
      remaining.splice(index, 1)
    }
  }

  return hits / expectedWords.length
}

/**
 * Decide whether a spoken attempt counts.
 *
 * `recognitionConfidence` is what the speech API reported. When it is low, or
 * the transcript is empty, the verdict is `unclear` rather than a guess.
 */
export function judgeRecall(
  spoken: string,
  expected: string,
  recognitionConfidence = 1
): RecallJudgement {
  const normalizedSpoken = normalizePhrase(spoken)
  const normalizedExpected = normalizePhrase(expected)

  const base: Omit<RecallJudgement, 'verdict' | 'similarity'> = {
    normalizedSpoken,
    normalizedExpected,
  }

  if (!normalizedSpoken) {
    return { ...base, verdict: 'unclear', similarity: 0 }
  }

  const score = Math.max(
    similarity(normalizedSpoken, normalizedExpected),
    wordOverlap(normalizedSpoken, normalizedExpected)
  )

  // A confident-looking score is still worth trusting even if the recogniser
  // was unsure, but a poor score from an unsure recogniser is not evidence of
  // anything, so we decline to judge rather than mark the user wrong.
  if (recognitionConfidence < MIN_RECOGNITION_CONFIDENCE && score < MATCH_THRESHOLD) {
    return { ...base, verdict: 'unclear', similarity: score }
  }

  if (score >= MATCH_THRESHOLD) {
    return { ...base, verdict: 'match', similarity: score }
  }
  if (score >= CLOSE_THRESHOLD) {
    return { ...base, verdict: 'close', similarity: score }
  }
  return { ...base, verdict: 'different', similarity: score }
}
