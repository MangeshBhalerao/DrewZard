import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DrewZard - Draw, Guess, Win!',
  description: 'A fun drawing and guessing game',
}

import { ThemeToggle } from '@/components/ThemeToggle'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  )
}
