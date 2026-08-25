# LingoConnect

Real-time speech translation that keeps what you reached for.

You speak, it translates out loud so the conversation keeps moving, and it
quietly saves the phrase. Later it asks you for that phrase again, and again,
until you own it.

**Live:** https://lingoconnect-pro.vercel.app · **Author:** [Mark Pelico](https://github.com/Markpelico)

---

## The idea

Language apps teach you a curriculum. This one learns yours.

The moment you reach for a translation mid-conversation is the highest-signal
learning event there is: you needed a specific phrase, with a real person, in
a context you cared about, and you did not have it. That moment is already
memorable. The app just makes sure it comes back.

So the translator is not really the product. It is the capture mechanism. The
phrasebook is what you are left with.

Other apps capture vocabulary from things you *read* (a photographed sign, a
subtitle, an article). This one captures from a live spoken conversation,
which is the part nobody else is standing in.

## How it works

```
speak  ->  Web Speech API  ->  /api/translate  ->  speech synthesis
                                     |
                                     v
                             phrasebook (localStorage)
                                     |
                                     v
                         Leitner review: 0, 1, 3, 7, 16 days
```

Everything runs in the browser or in a single serverless route. There is no
database, no account system, and no user data on any server.

## Translation providers

Free and key-less, tried in order. I benchmarked the usual suspects before
picking; most of them are dead:

| Provider | Status | Used |
|---|---|---|
| MyMemory | Working, broad coverage, ~5k chars/day per IP | Primary |
| Apertium | Working, rule-based, narrow pair list | Fallback |
| `translate.googleapis.com/translate_a` | Bot-blocked from cloud IPs | No |
| Lingva (all public mirrors) | HTTP 500; they proxy the endpoint above | No |
| libretranslate.de | Gone (301) | No |
| libretranslate.com | Now requires an API key | No |

Apertium only covers a narrow set of mostly Romance pairs (`eng-spa`,
`eng-cat`, `eng-glg` and the Romance cross-pairs), verified against its own
`/listPairs` endpoint. When it is used, the UI labels the result as a rough
translation rather than presenting it as equivalent.

**When every provider fails, the app says so.** It does not fall back to
invented output. An earlier version of this project shipped a 40-entry
hardcoded phrasebook and, past that, returned the literal string
`[Spanish Translation] <your text>` labelled with 70% confidence. That is a
bad failure mode anywhere, and a genuinely harmful one in an app you are
about to read out loud to another person.

## Running it

```bash
npm install
npm run dev
```

That is the whole setup. **No environment variables and no API keys are
required.**

Optional: MyMemory raises its daily quota from ~5k to ~50k characters if you
send a contact email with each request. The app deliberately does not, so no
personal data leaves the browser. Adding it is a one-line change in
`src/lib/translation/providers.ts` if you want the headroom.

## Browser support

Speech recognition uses the Web Speech API, which exists in Chrome, Edge, and
Safari but **not Firefox**. Everything else works everywhere, and there is a
text input so the full translate-and-capture loop stays usable without a
microphone.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Zustand · Motion ·
Web Speech API

Type checking and linting both run in the production build. They are not
disabled.

## What is not built

Being explicit, since the previous README was not:

- No accounts, no sync. Phrases live in one browser and do not follow you.
- No automated tests.
- No multi-user or peer-to-peer conversation. An earlier version had a
  Socket.IO scaffold that was never wired up and could not have run on
  serverless; it has been removed rather than left as decoration.
- No pronunciation scoring. Review is self-graded.
- Translation quality is bounded by what free providers give you. It is good
  for common phrases and travel language, weaker on idiom and long sentences.

## Possible next steps

- Export the phrasebook (Anki, CSV) so the data is not trapped.
- Record your attempt on review and play it back against the reference.
- Group phrases by the conversation they came from.
- A mobile app, which is where this concept actually belongs. The whole
  premise is being physically present in a conversation, and that is not a
  desktop situation.
