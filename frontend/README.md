# DrewZard - Next.js Version

A fun drawing and guessing game built with Next.js, featuring a playful hand-drawn aesthetic.

## Features

- 🎨 **Real-time Drawing** - Interactive canvas with multiple colors and brush sizes
- 👥 **Multiplayer Lobby** - Create and join rooms with friends
- 💬 **Live Chat** - In-game chat for guessing and communication
- 🏆 **Scoreboard** - Track player scores in real-time
- ⏱️ **Timer** - Visual countdown timer for each round
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Single Global CSS** - All styles consolidated in one file

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
DrewZard/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Single global CSS file
│   ├── lobby/
│   │   └── [roomCode]/
│   │       └── page.tsx    # Lobby page
│   └── game/
│       └── [roomCode]/
│           └── page.tsx    # Game page
├── components/
│   ├── NotebookBackground.tsx
│   ├── FloatingDoodles.tsx
│   ├── SketchyButton.tsx
│   └── SketchyInput.tsx
├── lib/
│   └── utils.ts            # Utility functions
└── package.json
```

## Key Features

### Single Global CSS
All styles are consolidated in `app/globals.css` with:
- Tailwind CSS configuration
- Google Fonts (Patrick Hand, Bubblegum Sans)
- Custom scrollbar styling
- Utility classes for sketchy effects

### Inline Color Codes
Colors are used inline throughout the components:
- Primary: `#5eb3f6` (Blue)
- Secondary: `#ffd966` (Yellow)
- Accent: `#ffb3ba` (Pink)
- Background: `#f9f9eb` (Cream)
- Foreground: `#2a2a2a` (Dark Gray)

### Components
- **NotebookBackground** - Lined paper effect
- **FloatingDoodles** - Animated decorative elements
- **SketchyButton** - Hand-drawn style buttons
- **SketchyInput** - Styled input fields

## Building for Production

```bash
npm run build
npm start
```

## License

This is a portfolio project based on the DrewZard UI design.
