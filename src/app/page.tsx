'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Github, Languages } from 'lucide-react'
import { ConversationPanel } from '@/components/conversation-panel'
import { PhrasebookPanel } from '@/components/phrasebook-panel'
import { ThemeToggle } from '@/components/theme'
import { Button } from '@/components/ui/button'

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent">
            <Languages
              className="h-4 w-4 text-accent-ink"
              strokeWidth={2.2}
              aria-hidden
            />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            LingoConnect
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/Markpelico/lingoconnect-pro"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <Github className="h-4 w-4" strokeWidth={2} aria-hidden />
          </a>
        </div>
      </div>
    </header>
  )
}

/** Layout family A: asymmetric split, pitch beside the working tool. */
function Hero() {
  const reduce = useReducedMotion()

  const scrollToApp = () => {
    const el = document.getElementById('talk')
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    el?.querySelector<HTMLButtonElement>('button[aria-label="Start listening"]')?.focus()
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 lg:pt-20">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-ink md:text-5xl">
            Learn the words you
            <br />
            actually needed.
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Speak, hear the translation out loud, and keep every phrase you
            reached for.
          </p>

          <Button size="lg" onClick={scrollToApp} className="mt-7">
            Start talking
          </Button>
        </motion.div>

        <motion.div
          id="talk"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="scroll-mt-24"
        >
          <ConversationPanel />
        </motion.div>
      </div>
    </section>
  )
}

/** Layout family A again, mirrored. Two splits maximum before breaking. */
function PhrasebookSection() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14">
          <Reveal>
            <PhrasebookPanel />
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
              A phrasebook you didn&apos;t have to write
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Every translation is saved automatically. You already proved you
              needed it, in a real conversation, with a real person. That makes
              it worth more than the next word on a list.
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Phrases come back on a spaced schedule, moving further apart each
              time you get one right.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Layout family B: horizontal stepped flow, no cards. */
function HowItWorks() {
  const steps = [
    {
      title: 'You get stuck',
      body: 'Mid-conversation, you reach for a phrase you do not have yet.',
    },
    {
      title: 'It speaks for you',
      body: 'The translation plays out loud so the conversation keeps moving.',
    },
    {
      title: 'You learn it',
      body: 'The phrase is saved and comes back until you know it cold.',
    },
  ]

  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <Reveal>
          <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight text-ink">
            Most apps teach you a language. This one follows you into it.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <div className="relative md:pr-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-accent-strong">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {/* Connector, drawn between steps rather than around them. */}
                  <span
                    className="hidden h-px flex-1 bg-line md:block"
                    aria-hidden
                  />
                </div>
                <h3 className="text-lg font-medium text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Layout family C: narrow editorial column. */
function BuildNotes() {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-2xl px-5 py-16 lg:py-20">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            How the translation actually works
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              Translation runs through free, key-less providers: MyMemory first,
              then Apertium for the pairs it covers. No API keys, no accounts,
              no cost.
            </p>
            <p>
              When both fail, the app says so. It never invents a translation to
              fill the gap, which matters when you are about to say the result
              out loud to another person.
            </p>
            <p>
              Saved phrases stay in your browser. There is no server, no
              database, and no account, so nothing you say leaves the device
              except the text being translated.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Built by{' '}
          <a
            href="https://github.com/Markpelico"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline underline-offset-4 hover:text-accent-strong"
          >
            Mark Pelico
          </a>
        </p>
        <p className="text-sm text-ink-muted">
          Next.js, TypeScript, Web Speech API
        </p>
      </div>
    </footer>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <Header />
      <main>
        <Hero />
        <PhrasebookSection />
        <HowItWorks />
        <BuildNotes />
      </main>
      <Footer />
    </div>
  )
}
