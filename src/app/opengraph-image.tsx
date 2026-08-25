import { ImageResponse } from 'next/og'

/**
 * Link preview card, generated at build time.
 *
 * Without this the app previewed as a bare URL anywhere it was shared,
 * including from the portfolio that features it. Generating rather than
 * checking in a PNG means it cannot drift from the copy it quotes.
 */
export const alt =
  'LingoConnect - real-time speech translation that keeps the phrases you reached for'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Matches the app's palette: warm near-black with a single amber accent.
const INK = '#12100e'
const SURFACE = '#1c1a17'
const TEXT = '#f5f3f0'
const MUTED = '#a8a29e'
const ACCENT = '#fbbf24'
const ACCENT_INK = '#1c1917'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: ACCENT_INK,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ color: TEXT, fontSize: 30, fontWeight: 600 }}>
            LingoConnect
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              color: TEXT,
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Learn the words you</span>
            <span>actually needed.</span>
          </div>
          <div style={{ color: MUTED, fontSize: 30, lineHeight: 1.4 }}>
            Speak, hear the translation out loud, and keep every phrase you
            reached for.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {['Real-time translation', 'Spaced repetition', 'No account'].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  background: SURFACE,
                  color: MUTED,
                  fontSize: 22,
                  padding: '10px 20px',
                  borderRadius: 999,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    size
  )
}
