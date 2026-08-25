import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cn, debounce } from './utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c')
  })

  it('lets the later Tailwind class win a conflict', () => {
    // The whole reason for twMerge: conditional overrides must actually apply.
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-ink', 'text-accent')).toBe('text-accent')
  })

  it('keeps non-conflicting utilities', () => {
    expect(cn('px-4 py-2', 'rounded-full')).toBe('px-4 py-2 rounded-full')
  })

  it('handles conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for the delay before calling', () => {
    const fn = vi.fn()
    debounce(fn, 200)()

    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('collapses a burst into a single call', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 200)

    debounced()
    vi.advanceTimersByTime(50)
    debounced()
    vi.advanceTimersByTime(50)
    debounced()
    vi.advanceTimersByTime(200)

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes the most recent arguments through', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('first')
    debounced('second')
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith('second')
  })

  it('allows a second call after the window has elapsed', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(100)
    debounced()
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
