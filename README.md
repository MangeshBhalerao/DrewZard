# DrewZard 🎨

Welcome to **DrewZard**, a real-time, multiplayer drawing and guessing game inspired by the classic game of Pictionary!

This project provides an interactive and seamless environment where friends can join virtual rooms, take turns drawing words on a shared canvas, and race against the clock to guess what is being drawn to earn points.

## 🚀 Features (At a Glance)
- **Real-Time Multiplayer:** Instantaneous drawing updates and live chat using WebSockets.
- **Room Management:** Create private rooms, join via a unique room code, and easily manage players.
- **Game Engine:** Automated turn-taking, word selection timers, dynamic turn lengths, and real-time score calculation.
- **Interactive Canvas:** Drawing tools, undo/redo actions, and color fills.
- **Smart Guessing:** A chat system that evaluates messages to detect correct or close guesses (using Levenshtein distance) without revealing the word to others.

## 🛠️ Technologies Used

DrewZard is built using a modern full-stack architecture divided into a frontend client and a robust backend server.

### Frontend
- **Framework:** [Next.js 14](https://nextjs.org/) & [React 18](https://react.dev/)
- **Language:** TypeScript 
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a fully responsive and clean UI.
- **Icons & Utilities:** Lucide React, clsx, and Tailwind Merge.

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Real-Time Communication:** WebSockets for handling live game state, broadcasting drawing strokes, and chat.
- **Server:** Uvicorn (ASGI server)
- **Game Logic:** Custom state managers that control player readiness, turn phases, scoring formulas (based on guess speed), and room cleanup for inactive users.

## 🎮 How It Works

1. **Host & Join:** A player creates a room and shares the code with friends. The creator becomes the "Admin."
2. **Start the Game:** Once enough players are ready, the admin starts the game.
3. **Draw:** The assigned drawer chooses a word from a random list and starts drawing it on the interactive canvas.
4. **Guess:** Other players watch the drawing appear in real time and type their guesses into the chat. The faster a player types the correct word, the more points they earn!
5. **Win:** Rounds continue until the game finishes. The player with the highest score at the end is crowned the ultimate DrewZard champion!

---
*Note: This is an introductory overview of the DrewZard project. Specific installation instructions and detailed game mechanic breakdowns can be found in the respective directory documentation.*
