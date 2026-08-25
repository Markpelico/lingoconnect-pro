import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes, resolving conflicts so the last one wins.
 *
 * This file previously carried twelve more helpers left over from the original
 * scaffold, including an email validator, a file-size formatter and a reading
 * time estimator, none of which this app imports.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Delay a call until `wait` milliseconds have passed without another call.
 *
 * Used to keep rapid start/stop taps from thrashing the speech recogniser,
 * which throws if you start it while it is already running.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
