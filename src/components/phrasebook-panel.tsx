'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BookMarked, Check, Eye, Info, Trash2, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePhrasebook } from '@/store/phrasebook'
import { computeStats, selectDuePhrases, MAX_BOX } from '@/lib/phrases'
import { textToSpeech } from '@/lib/speech-synthesis'
import { LANGUAGES } from '@/store/session'

function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code
}

function isRtl(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.rtl ?? false
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-medium tabular-nums text-ink">
        {value}
      </div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  )
}

export function PhrasebookPanel() {
  const phrases = usePhrasebook((s) => s.phrases)
  const review = usePhrasebook((s) => s.review)
  const remove = usePhrasebook((s) => s.remove)
  const seedSamples = usePhrasebook((s) => s.seedSamples)
  const clearSamples = usePhrasebook((s) => s.clearSamples)

  const [revealed, setRevealed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const reduce = useReducedMotion()

  // Phrases live in localStorage, so the server renders none. Wait for
  // hydration before rendering counts to avoid a mismatch, then seed the
  // samples so a first-time visitor can see what this panel is for.
  useEffect(() => {
    setMounted(true)
    seedSamples()
  }, [seedSamples])

  const showingSamples = phrases.some((p) => p.isSample)

  const stats = useMemo(() => computeStats(phrases), [phrases])
  const due = useMemo(() => selectDuePhrases(phrases), [phrases])
  const current = due[0]

  const handleReview = (remembered: boolean) => {
    if (!current) return
    review(current.id, remembered)
    setRevealed(false)
  }

  if (!mounted) {
    return <div className="min-h-[420px] rounded-[16px] border border-line bg-surface-sunk" />
  }

  if (phrases.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[16px] border border-line bg-surface-sunk px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-wash">
          <BookMarked className="h-5 w-5 text-ink" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-[15px] font-medium text-ink">Nothing saved yet</p>
        <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
          Translate a phrase and it lands here automatically, ready to review.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[420px] flex-col rounded-[16px] border border-line bg-surface-sunk">
      <div className="flex items-center gap-8 border-b border-line p-4">
        <Stat value={stats.total} label="saved" />
        <Stat value={stats.due} label="to review" />
        <Stat value={stats.mastered} label="known" />
      </div>

      {/*
        Labelled rather than passed off as the visitor's own history. The whole
        product claim is that these are phrases you personally reached for, so
        quietly faking them would undercut the thing being demonstrated.
      */}
      {showingSamples && (
        <div className="flex items-start gap-2.5 border-b border-line bg-accent-wash px-4 py-3">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft"
            strokeWidth={2}
            aria-hidden
          />
          <p className="flex-1 text-xs leading-relaxed text-ink-soft">
            Sample phrases, so you can try the review flow right away. They make
            way for your own the moment you save one.
          </p>
          <button
            onClick={clearSamples}
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-ink underline underline-offset-2 transition-colors hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center p-4">
        {current ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[16px] border border-line bg-surface p-5"
            >
              <p className="mb-1 text-xs text-ink-muted">
                How do you say this in {languageName(current.targetLanguage)}?
              </p>
              <p className="text-xl font-medium leading-snug text-ink">
                {current.sourceText}
              </p>

              {revealed ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 border-t border-line pt-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      lang={current.targetLanguage}
                      dir={isRtl(current.targetLanguage) ? 'rtl' : 'ltr'}
                      className="text-xl font-medium leading-snug text-ink"
                    >
                      {current.translatedText}
                    </p>
                    <button
                      onClick={() =>
                        void textToSpeech.speak({
                          text: current.translatedText,
                          language: current.targetLanguage,
                        })
                      }
                      aria-label="Hear pronunciation"
                      className="shrink-0 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <Volume2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </button>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button
                      onClick={() => handleReview(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Not yet
                    </Button>
                    <Button onClick={() => handleReview(true)} className="flex-1">
                      <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Got it
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <Button
                  onClick={() => setRevealed(true)}
                  variant="outline"
                  className="mt-4 w-full"
                >
                  <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Show answer
                </Button>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="py-8 text-center">
            <p className="text-[15px] font-medium text-ink">All caught up</p>
            <p className="mt-1.5 text-sm text-ink-muted">
              Nothing due right now. New phrases appear as you save them.
            </p>
          </div>
        )}
      </div>

      {/* Saved phrases, newest first. Capped so the panel stays scannable. */}
      <div className="border-t border-line">
        <ul className="max-h-52 divide-y divide-line overflow-y-auto">
          {phrases.slice(0, 30).map((phrase) => (
            <li
              key={phrase.id}
              className="group flex items-center gap-3 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{phrase.sourceText}</p>
                <p
                  lang={phrase.targetLanguage}
                  dir={isRtl(phrase.targetLanguage) ? 'rtl' : 'ltr'}
                  className="truncate text-sm text-ink-muted"
                >
                  {phrase.translatedText}
                </p>
              </div>

              {/* Progress through the Leitner boxes. */}
              <div
                className="flex shrink-0 gap-0.5"
                title={`Box ${phrase.box} of ${MAX_BOX}`}
                aria-label={`Progress: box ${phrase.box} of ${MAX_BOX}`}
              >
                {Array.from({ length: MAX_BOX }, (_, i) => (
                  <span
                    key={i}
                    className={
                      i < phrase.box
                        ? 'h-1.5 w-1.5 rounded-full bg-accent'
                        : 'h-1.5 w-1.5 rounded-full bg-line'
                    }
                  />
                ))}
              </div>

              <button
                onClick={() => remove(phrase.id)}
                aria-label={`Remove "${phrase.sourceText}"`}
                className="shrink-0 rounded-full p-1 text-ink-muted opacity-0 transition-opacity hover:text-live focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
