import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f9f9eb',
        foreground: '#2a2a2a',
        primary: {
          DEFAULT: '#5eb3f6',
          foreground: '#2a2a2a',
        },
        secondary: {
          DEFAULT: '#ffd966',
          foreground: '#2a2a2a',
        },
        accent: {
          DEFAULT: '#ffb3ba',
          foreground: '#2a2a2a',
        },
        muted: {
          DEFAULT: '#f0f0e0',
          foreground: '#6a6a6a',
        },
        destructive: {
          DEFAULT: '#ff6b6b',
          foreground: '#ffffff',
        },
        border: 'rgba(42, 42, 42, 0.2)',
        ring: 'rgba(94, 179, 246, 0.5)',
      },
      fontFamily: {
        hand: ['Patrick Hand', 'cursive'],
        bubblegum: ['Bubblegum Sans', 'cursive'],
      },
    },
  },
  plugins: [],
}

export default config
