/**
 * Interpreting a speech recognition result.
 *
 * Extracted from the recogniser wrapper so it can actually be tested. The bug
 * this replaces lived in that wrapper precisely because it was the one module
 * excluded from coverage: a final result below the confidence threshold was
 * dropped without calling the result handler at all, so you could speak, be
 * heard correctly, and see nothing happen. No transcript, no error, no clue.
 *
 * That failure landed hardest on accented and non-native speech in noisy
 * rooms, which is the entire audience for a language app.
 *
 * The rule now: never discard what was heard. Mark it uncertain and let the
 * caller decide, the same way spoken recall reports "didn't catch that"
 * instead of guessing.
 */

/** Below this, a transcript is shown but flagged as uncertain. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6

/**
 * Chrome reports `confidence: 0` on plenty of perfectly good results,
 * particularly interim ones and continuous sessions, so a falsy value means
 * "not reported" rather than "certainly wrong".
 */
export const ASSUMED_CONFIDENCE = 0.8

export interface SpeechAlternative {
  transcript: string
  confidence: number
}

export function normalizeConfidence(raw: number | undefined | null): number {
  if (raw === undefined || raw === null || Number.isNaN(raw) || raw <= 0) {
    return ASSUMED_CONFIDENCE
  }
  return Math.min(raw, 1)
}

export function isLowConfidence(
  confidence: number,
  threshold: number = LOW_CONFIDENCE_THRESHOLD
): boolean {
  return confidence < threshold
}

/**
 * Rank the recogniser's alternatives, best first.
 *
 * These are deliberately not filtered by confidence. Alternatives are most
 * useful exactly when the top result is shaky, so discarding the low-scoring
 * ones threw away the "did you mean" options at the only moment they mattered.
 */
export function rankAlternatives(
  raw: ReadonlyArray<{ transcript?: string; confidence?: number }>,
  limit = 5
): SpeechAlternative[] {
  return raw
    .map((alt, index) => ({
      transcript: (alt.transcript ?? '').trim(),
      // Later entries are progressively less likely when the API gives us
      // nothing to go on.
      confidence: alt.confidence
        ? Math.min(alt.confidence, 1)
        : Math.max(0.1, ASSUMED_CONFIDENCE - index * 0.1),
    }))
    .filter((alt) => alt.transcript.length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
}
