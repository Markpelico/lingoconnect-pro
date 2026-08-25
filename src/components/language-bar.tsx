'use client'

import { ArrowLeftRight } from 'lucide-react'
import { LANGUAGES, useSession } from '@/store/session'

function LanguageSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (code: string) => void
}) {
  return (
    <div className="flex-1">
      {/* Label above input, never placeholder-as-label. */}
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-ink-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-[10px] border border-line bg-surface px-3 text-sm text-ink transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function LanguageBar() {
  const {
    sourceLanguage,
    targetLanguage,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages,
  } = useSession()

  const byCode = (code: string) =>
    LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]

  return (
    <div className="flex items-end gap-3">
      <LanguageSelect
        id="source-language"
        label="You speak"
        value={sourceLanguage.code}
        onChange={(code) => setSourceLanguage(byCode(code))}
      />

      <button
        onClick={swapLanguages}
        aria-label="Swap languages"
        title="Swap languages"
        className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-all hover:bg-surface-sunk hover:text-ink active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <ArrowLeftRight className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      <LanguageSelect
        id="target-language"
        label="Translate to"
        value={targetLanguage.code}
        onChange={(code) => setTargetLanguage(byCode(code))}
      />
    </div>
  )
}
