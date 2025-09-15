import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LingoConnect Pro - AI Language Exchange | Mark Pelico",
  description: "Enterprise AI-powered language exchange platform with real-time speech recognition and translation. Built by Mark Pelico using Next.js, TypeScript, and modern web technologies.",
  keywords: "AI translation, language exchange, speech recognition, Next.js, TypeScript, Mark Pelico, portfolio, full-stack developer",
  authors: [{ name: "Mark Pelico" }],
  creator: "Mark Pelico",
  openGraph: {
    title: "LingoConnect Pro - AI Language Exchange",
    description: "Enterprise AI-powered language exchange platform by Mark Pelico",
    url: "https://lingoconnect-pro.vercel.app",
    siteName: "LingoConnect Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LingoConnect Pro - AI Language Exchange",
    description: "Enterprise AI-powered language exchange platform by Mark Pelico",
    creator: "@markpelico",
  },
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
