'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertCircle,
  BookmarkCheck,
  CornerDownLeft,
  Mic,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageBar } from '@/components/language-bar'
import { useConversation } from '@/hooks/useConversation'
import { useSession, type Turn } from '@/store/session'
import { cn } from '@/lib/utils'

function TurnCard({
  turn,
  onReplay,
}: {
  turn: Turn
  onReplay: (text: string) => void
}) {
  const reduce = useReducedMotion()
  const targetLanguage = useSession((s) => s.targetLanguage)

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[16px] border border-line bg-surface p-4"
    >
      <p className="text-[15px] leading-snug text-ink-soft">{turn.sourceText}</p>

      <div className="mt-3 border-t border-line pt-3">
        {turn.status === 'translating' && (
          // Skeleton matches the shape of the text it replaces.
          <div className="space-y-2" aria-live="polite" aria-label="Translating">
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-sunk" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-sunk" />
          </div>
        )}

        {turn.status === 'failed' && (
          <div className="flex items-start gap-2 text-sm text-live">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            <span>{turn.error}</span>
          </div>
        )}

        {turn.status === 'done' && turn.translatedText && (
          <>
            <p
              lang={targetLanguage.code}
              dir={targetLanguage.rtl ? 'rtl' : 'ltr'}
              className="text-lg font-medium leading-snug text-ink"
            >
              {turn.translatedText}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                onClick={() => onReplay(turn.translatedText!)}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              >
                <Volume2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Play again
              </button>

              {turn.isNewCapture && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-1 text-xs font-medium text-ink">
                  <BookmarkCheck
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  Saved to phrasebook
                </span>
              )}

              {turn.quality === 'approximate' && (
                <span className="text-xs text-ink-muted">
                  Rough translation from {turn.provider}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </motion.li>
  )
}

export function ConversationPanel() {
  const {
    isListening,
    isSupported,
    interimTranscript,
    isVoiceActive,
    error,
    clearError,
    toggleListening,
    submitText,
    speak,
  } = useConversation()

  const { turns, clearTurns, targetLanguage, autoSpeak, updateSettings } =
    useSession()

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, interimTranscript])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitText(draft)
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col rounded-[16px] border border-line bg-surface-sunk">
      <div className="border-b border-line p-4">
        <LanguageBar />
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="min-h-[280px] flex-1 overflow-y-auto p-4"
        aria-live="polite"
      >
        {turns.length === 0 && !interimTranscript ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-wash">
              <Mic className="h-5 w-5 text-ink" strokeWidth={2} aria-hidden />
            </div>
            <p className="text-[15px] font-medium text-ink">
              Say something you can&apos;t say yet
            </p>
            <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
              {isSupported
                ? 'It translates out loud, then keeps the phrase so you can learn it.'
                : 'Speech input needs Chrome, Edge, or Safari. You can type below instead.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} onReplay={(t) => speak(t, targetLanguage.code)} />
            ))}

            <AnimatePresence>
              {interimTranscript && (
                <motion.li
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-[16px] border border-dashed border-line bg-surface p-4"
                >
                  <p className="text-[15px] italic leading-snug text-ink-muted">
                    {interimTranscript}
                  </p>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-[10px] bg-live-wash px-3 py-2.5 text-sm text-live">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            className="text-xs underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {isListening && !reduce && (
              <span
                className="pulse-ring absolute inset-0 rounded-full bg-live"
                aria-hidden
              />
            )}
            <Button
              onClick={toggleListening}
              disabled={!isSupported}
              variant={isListening ? 'live' : 'accent'}
              size="icon"
              className={cn(
                'relative h-12 w-12',
                isVoiceActive && 'ring-2 ring-live ring-offset-2 ring-offset-surface-sunk'
              )}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
              title={
                isSupported
                  ? isListening
                    ? 'Stop listening'
                    : 'Start listening'
                  : 'Speech input is not supported in this browser'
              }
            >
              {isListening ? (
                <Square className="h-4 w-4 fill-current" strokeWidth={2} aria-hidden />
              ) : (
                <Mic className="h-5 w-5" strokeWidth={2} aria-hidden />
              )}
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <label htmlFor="phrase-input" className="sr-only">
              Type a phrase to translate
            </label>
            <input
              id="phrase-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Or type a phrase'}
              className="h-11 flex-1 rounded-[10px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              disabled={!draft.trim()}
              aria-label="Translate typed phrase"
            >
              <CornerDownLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Button>
          </form>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => updateSettings({ autoSpeak: e.target.checked })}
              className="h-3.5 w-3.5 accent-[var(--accent-strong)]"
            />
            Speak translations aloud
          </label>

          {turns.length > 0 && (
            <button
              onClick={clearTurns}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
