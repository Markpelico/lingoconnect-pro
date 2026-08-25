import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider, themeInitScript } from '@/components/theme'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'LingoConnect - Learn the words you actually needed',
  description:
    'Real-time speech translation that keeps every phrase you reached for, then helps you learn it before the next conversation.',
  authors: [{ name: 'Mark Pelico' }],
  creator: 'Mark Pelico',
  openGraph: {
    title: 'LingoConnect',
    description:
      'Real-time speech translation that keeps every phrase you reached for, then helps you learn it.',
    siteName: 'LingoConnect',
    type: 'website',
  },
}

// Next 15 wants viewport as its own export; keeping it inside `metadata`
// silently drops the tag.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#12100e' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
