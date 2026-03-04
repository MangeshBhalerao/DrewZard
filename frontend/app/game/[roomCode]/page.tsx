'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { SketchyButton } from '@/components/SketchyButton';
import { DrawingCanvas, DrawingCanvasRef } from '@/components/DrawingCanvas';
import { ArrowLeft, Eraser, Trash2, Send, Undo, Redo } from 'lucide-react';

const COLORS = [
  { name: 'Black', value: '#2a2a2a' },
  { name: 'Red', value: '#ff6b6b' },
  { name: 'Blue', value: '#5eb3f6' },
  { name: 'Yellow', value: '#ffd966' },
  { name: 'Green', value: '#bae1ba' },
  { name: 'Purple', value: '#dab3ff' },
  { name: 'Orange', value: '#ffb366' },
  { name: 'Pink', value: '#ffb3ba' },
];

const BRUSH_SIZES = [2, 5, 10, 15, 20];

interface Player {
  name: string;
  score: number;
  ready: boolean;
}

export default function Game() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(5);
  const [timeLeft, setTimeLeft] = useState(80);
  const [currentWord, setCurrentWord] = useState('');
  const [wordHint, setWordHint] = useState('_ _ _ _ _');
  const [chatMessage, setChatMessage] = useState('');
  const [guesses, setGuesses] = useState<Array<{id: number, player: string, message: string, isCorrect: boolean}>>([]);
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawer, setDrawer] = useState('');
  const [round, setRound] = useState(0);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [showDrawerAnnouncement, setShowDrawerAnnouncement] = useState(false);
  const [showGameComplete, setShowGameComplete] = useState(false);
  const [finalScores, setFinalScores] = useState<Player[]>([]);
  const [winner, setWinner] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Timer
  useEffect(() => {
    if (!joined || !round) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === 1) {
          // Timer reached 0, send round_end message
          if (socketRef.current) {
            socketRef.current.send(JSON.stringify({
              type: 'round_end',
              reason: 'time_up'
            }));
          }
          return 0;
        }
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [joined, round]);

  // Get username from session storage or prompt
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      setJoined(true);
    }
  }, []);

  const handleJoin = () => {
    if (username.trim()) {
      sessionStorage.setItem('username', username);
      setJoined(true);
    }
  };

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;
    const close = () => setShowColorPicker(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showColorPicker]);

  // WebSocket connection
  useEffect(() => {
    if (!joined || hasConnectedRef.current) return;
    
    hasConnectedRef.current = true;
    console.log('🔌🔌🔌 Creating GAME PAGE WebSocket connection...');
    const wsBase = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000';
    const socket = new WebSocket(`${wsBase}/ws/${roomCode}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅✅✅ Game WebSocket connected to room:', roomCode);
      console.log('   Sending join message for:', username);
      socket.send(JSON.stringify({
        type: 'join',
        username: username,
      }));
      
      // Notify backend that this player is ready on game page
      console.log('📤 Sending game_ready message');
      socket.send(JSON.stringify({
        type: 'game_ready',
        username: username,
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'players_update':
          setPlayers(data.players.map((p: any) => ({
            name: p.name,
            score: p.score || 0,
            ready: p.ready
          })));
          break;

        case 'round_start':
          setRound(data.round);
          setDrawer(data.drawer);
          setPlayers(data.players.map((p: any) => ({
            name: p.name,
            score: p.score || 0,
            ready: p.ready
          })));
          setTimeLeft(80);
          setGuesses([]);
          
          // Show drawer announcement
          setShowDrawerAnnouncement(true);
          setTimeout(() => setShowDrawerAnnouncement(false), 3000);
          break;

        case 'word_choices':
          if (data.words && data.words.length > 0) {
            setWordChoices(data.words);
            setShowWordSelection(true);
          }
          break;

        case 'word_chosen':
          setWordHint(data.word_hint);
          setShowWordSelection(false);
          break;

        case 'correct_guess':
          setGuesses(prev => [...prev, {
            id: Date.now(),
            player: data.username,
            message: data.message,
            isCorrect: true
          }]);
          break;
        
        case 'turn_end':
          // Stop the timer and show the correct word
          setTimeLeft(0);
          setGuesses(prev => [...prev, {
            id: Date.now(),
            player: 'System',
            message: `Turn ended! The word was: ${data.correct_word}`,
            isCorrect: false
          }]);
          // Clear canvas
          if (canvasRef.current) {
            canvasRef.current.clearCanvas();
          }
          break;

        case 'chat':
          setGuesses(prev => [...prev, {
            id: Date.now(),
            player: data.username,
            message: data.message,
            isCorrect: false
          }]);
          break;

        case 'game_complete':
          setFinalScores(data.final_scores.map((p: any) => ({
            name: p.name,
            score: p.score,
            ready: false
          })));
          setWinner(data.winner);
          setShowGameComplete(true);
          break;
      }
    };

    socket.onclose = () => {
      // Connection closed
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [joined, roomCode, username]);

  const handleWordSelect = (word: string) => {
    console.log('🎯 Word selected:', word);
    if (socketRef.current) {
      console.log('📤 Sending word_selected to backend');
      socketRef.current.send(JSON.stringify({
        type: 'word_selected',
        word: word
      }));
      setCurrentWord(word);
      setShowWordSelection(false);
      console.log('✅ Modal closed, word set:', word);
    } else {
      console.log('⚠️  No WebSocket connection to send word selection');
    }
  };

  const clearCanvas = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleSendGuess = () => {
    if (chatMessage.trim() && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        message: chatMessage,
        username: username
      }));
      setChatMessage('');
    }
  };

  return (
    <div className="min-h-screen relative">
      <NotebookBackground />

      {/* Name popup */}
      {!joined && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div 
            className="bg-white p-8 flex flex-col gap-4"
            style={{
              border: '4px solid #2a2a2a',
              borderRadius: '16px',
              transform: 'rotate(-1deg)',
              boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)',
            }}
          >
            <h2 
              className="text-3xl"
              style={{ fontFamily: "'Bubblegum Sans', cursive" }}
            >
              Enter your name
            </h2>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="px-4 py-3 text-lg"
              placeholder="Your name"
              autoFocus
              style={{
                border: '3px solid #2a2a2a',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
            <SketchyButton 
              variant="primary"
              size="lg"
              onClick={handleJoin}
              disabled={!username.trim()}
            >
              Join Game
            </SketchyButton>
          </div>
        </div>
      )}
      
      {/* Outer wrapper - natural scroll on all screen sizes */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="p-3 border-b-4 border-solid sticky top-0 z-30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderColor: '#2a2a2a' }}>
          <div className="container mx-auto flex items-center justify-between gap-2">
            <button
              onClick={() => router.push(`/lobby/${roomCode}`)}
              className="flex items-center gap-2 transition-colors"
              style={{ color: '#2a2a2a' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#5eb3f6'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#2a2a2a'}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Leave</span>
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <div 
                className="px-2 sm:px-4 py-1 sm:py-2"
                style={{
                  backgroundColor: '#ffd966',
                  border: '3px solid #2a2a2a',
                  borderRadius: '8px',
                }}
              >
                <span className="text-xs sm:text-sm">Room: </span>
                <span 
                  className="text-lg sm:text-xl"
                  style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                >
                  {roomCode}
                </span>
              </div>

              {round > 0 && (
                <div 
                  className="px-2 sm:px-4 py-1 sm:py-2"
                  style={{
                    backgroundColor: '#bae1ba',
                    border: '3px solid #2a2a2a',
                    borderRadius: '8px',
                  }}
                >
                  <span className="text-xs sm:text-sm">Round: </span>
                  <span 
                    className="text-lg sm:text-xl"
                    style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                  >
                    {round}
                  </span>
                </div>
              )}
              
              <Timer seconds={timeLeft} />
            </div>

            <div className="text-right hidden md:block">
              <p className="text-sm" style={{ color: '#6a6a6a' }}>
                {username === drawer ? "You're drawing:" : "Guess the word:"}
              </p>
              <p 
                className="text-2xl"
                style={{ fontFamily: "'Bubblegum Sans', cursive" }}
              >
                {username === drawer ? currentWord : wordHint}
              </p>
            </div>
            <div className="md:hidden">
              <p 
                className="text-lg"
                style={{ fontFamily: "'Bubblegum Sans', cursive" }}
              >
                {username === drawer ? currentWord : wordHint}
              </p>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 p-3">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_300px]">
            {/* Canvas and Tools */}
            <div className="flex flex-col gap-3">
              {/* Drawing Tools - Only visible to drawer */}
              {username === drawer && (
              <div 
                className="p-2 sm:p-3"
                style={{
                  backgroundColor: '#ffffff',
                  border: '4px solid #2a2a2a',
                  borderRadius: '12px',
                  transform: 'rotate(-0.3deg)',
                  boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                }}
              >
                {/* ── Desktop toolbar (hidden on mobile) ── */}
                <div className="hidden sm:flex flex-wrap items-center gap-3">
                  {/* Colors */}
                  <div className="flex gap-1.5 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${currentColor === c.value ? 'scale-110' : ''}`}
                        style={{ 
                          backgroundColor: c.value,
                          border: '3px solid #2a2a2a',
                          boxShadow: currentColor === c.value ? '0 0 0 3px rgba(94,179,246,0.6)' : '2px 2px 0 rgba(42,42,42,0.3)',
                        }}
                        onClick={() => setCurrentColor(c.value)}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <div className="h-8 w-px" style={{ backgroundColor: 'rgba(42,42,42,0.2)' }} />
                  {/* Brush Sizes */}
                  <div className="flex gap-1.5">
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{
                          border: '2px solid #2a2a2a',
                          backgroundColor: brushSize === size ? '#5eb3f6' : '#ffffff',
                        }}
                        onClick={() => setBrushSize(size)}
                        title={`${size}px`}
                      >
                        <div className="rounded-full" style={{ width: `${Math.min(size, 12)}px`, height: `${Math.min(size, 12)}px`, backgroundColor: '#2a2a2a' }} />
                      </button>
                    ))}
                  </div>
                  <div className="h-8 w-px" style={{ backgroundColor: 'rgba(42,42,42,0.2)' }} />
                  {/* Action buttons */}
                  <button className="p-1.5 rounded-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#ffb3ba', border: '2px solid #2a2a2a' }} onClick={() => setCurrentColor('#ffffff')} title="Eraser"><Eraser className="w-5 h-5" /></button>
                  <button className="p-1.5 rounded-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#ff6b6b', color: '#fff', border: '2px solid #2a2a2a' }} onClick={clearCanvas} title="Clear"><Trash2 className="w-5 h-5" /></button>
                  <button className="p-1.5 rounded-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#bae1ba', border: '2px solid #2a2a2a' }} onClick={() => canvasRef.current?.undo()} title="Undo"><Undo className="w-5 h-5" /></button>
                  <button className="p-1.5 rounded-lg hover:scale-110 transition-transform" style={{ backgroundColor: '#bae1ba', border: '2px solid #2a2a2a' }} onClick={() => canvasRef.current?.redo()} title="Redo"><Redo className="w-5 h-5" /></button>
                </div>

                {/* ── Mobile toolbar (one compact row) ── */}
                <div className="flex sm:hidden items-center gap-2 relative">
                  {/* Color picker trigger */}
                  <button
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
                    style={{ border: '2px solid #2a2a2a', backgroundColor: '#ffffff' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setShowColorPicker(p => !p)}
                  >
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentColor, border: '2px solid #2a2a2a' }} />
                    <span className="text-xs font-bold">Color</span>
                    <span className="text-xs">{showColorPicker ? '▲' : '▼'}</span>
                  </button>

                  {/* Color popup */}
                  {showColorPicker && (
                    <div
                      className="absolute top-full left-0 mt-2 p-2 z-50 grid grid-cols-4 gap-1.5"
                      style={{ backgroundColor: '#fff', border: '3px solid #2a2a2a', borderRadius: '10px', boxShadow: '4px 4px 0 rgba(42,42,42,0.3)' }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: c.value, border: currentColor === c.value ? '3px solid #5eb3f6' : '2px solid #2a2a2a' }}
                          onClick={() => { setCurrentColor(c.value); setShowColorPicker(false); }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  )}

                  <div className="w-px h-6" style={{ backgroundColor: 'rgba(42,42,42,0.2)' }} />

                  {/* Compact brush sizes */}
                  {BRUSH_SIZES.map((size) => (
                    <button
                      key={size}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ border: '2px solid #2a2a2a', backgroundColor: brushSize === size ? '#5eb3f6' : '#ffffff' }}
                      onClick={() => setBrushSize(size)}
                    >
                      <div className="rounded-full" style={{ width: `${Math.min(size, 10)}px`, height: `${Math.min(size, 10)}px`, backgroundColor: '#2a2a2a' }} />
                    </button>
                  ))}

                  <div className="w-px h-6" style={{ backgroundColor: 'rgba(42,42,42,0.2)' }} />

                  {/* Action icons */}
                  <button className="p-1.5 rounded-md" style={{ backgroundColor: '#ffb3ba', border: '2px solid #2a2a2a' }} onClick={() => setCurrentColor('#ffffff')} title="Eraser"><Eraser className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded-md" style={{ backgroundColor: '#ff6b6b', color: '#fff', border: '2px solid #2a2a2a' }} onClick={clearCanvas} title="Clear"><Trash2 className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded-md" style={{ backgroundColor: '#bae1ba', border: '2px solid #2a2a2a' }} onClick={() => canvasRef.current?.undo()} title="Undo"><Undo className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded-md" style={{ backgroundColor: '#bae1ba', border: '2px solid #2a2a2a' }} onClick={() => canvasRef.current?.redo()} title="Redo"><Redo className="w-4 h-4" /></button>
                </div>
              </div>
              )}

              {/* Non-drawer message */}
              {username !== drawer && drawer && (
                <div 
                  className="p-4 text-center"
                  style={{
                    backgroundColor: '#ffd966',
                    border: '4px solid #2a2a2a',
                    borderRadius: '12px',
                    transform: 'rotate(-0.5deg)',
                    boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                  }}
                >
                  <p 
                    className="text-2xl"
                    style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                  >
                    ✏️ {drawer} is drawing!
                  </p>
                  <p className="text-sm mt-2">Guess the word in the chat!</p>
                </div>
              )}

              {/* Canvas - fixed 4:3 aspect ratio so drawings look the same on all screens */}
              <div className="w-full lg:flex-1 lg:min-h-0" style={{ aspectRatio: '4 / 3' }}>
                {joined && (
                  <DrawingCanvas
                    ref={canvasRef}
                    roomCode={roomCode}
                    username={username}
                    color={currentColor}
                    brushSize={brushSize}
                    isDrawing={isDrawing}
                    onDrawingChange={setIsDrawing}
                    isDrawer={username === drawer}
                    socket={socketRef.current}
                    className="w-full h-full"
                    style={{ 
                      border: '4px solid #2a2a2a',
                      borderRadius: '12px',
                      backgroundColor: '#ffffff',
                      transform: 'rotate(0.2deg)',
                      boxShadow: '4px 4px 0px 0px rgba(42, 42, 42, 0.3)',
                      display: 'block',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-3">
              {/* Scoreboard */}
              <div 
                className="p-3"
                style={{
                  backgroundColor: '#ffffff',
                  border: '4px solid #2a2a2a',
                  borderRadius: '12px',
                  transform: 'rotate(-0.5deg)',
                  boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                }}
              >
                <h3 
                  className="text-xl mb-2 text-center"
                  style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                >
                  🏆 Scoreboard
                </h3>
                
                {/* Mobile: horizontal chips. Desktop: vertical list */}
                <div className="flex flex-wrap gap-2 lg:flex-col lg:space-y-2 lg:flex-nowrap">
                  {players.map((player, index) => (
                    <div
                      key={player.name}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg"
                      style={{
                        backgroundColor: player.name === drawer ? '#ffd966' : '#f0f0e0',
                        border: '2px solid rgba(42, 42, 42, 0.2)',
                        minWidth: 0,
                      }}
                    >
                      <span className="text-base">{player.name === drawer ? '✏️' : '🎨'}</span>
                      <div className="min-w-0">
                        <p 
                          className="font-semibold text-sm truncate"
                          style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                        >
                          {player.name}{player.name === username && ' (You)'}
                          {player.name === drawer && (
                            <span 
                              className="ml-1 text-xs px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#ff6b6b', color: '#fff', border: '1px solid #2a2a2a' }}
                            >
                              Drawing!
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600">{player.score} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guesses/Chat */}
              <div 
                className="flex flex-col p-3"
                style={{ minHeight: '320px',
                  backgroundColor: '#ffffff',
                  border: '4px solid #2a2a2a',
                  borderRadius: '12px',
                  transform: 'rotate(0.3deg)',
                  boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                }}
              >
                <h3 
                  className="text-xl mb-3 pb-2"
                  style={{ 
                    fontFamily: "'Bubblegum Sans', cursive",
                    borderBottom: '2px dashed rgba(42, 42, 42, 0.2)',
                  }}
                >
                  Guesses 💭
                </h3>
                
                <div className="overflow-y-auto space-y-2 mb-3" style={{ maxHeight: '240px', minHeight: '120px' }}>
                  {guesses.map((guess) => (
                    <div
                      key={guess.id}
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: guess.isCorrect ? '#bae1ba' : '#f0f0e0',
                      }}
                    >
                      <span className="font-bold">{guess.player}: </span>
                      {guess.message}
                      {guess.isCorrect && ' ✓'}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg"
                    placeholder="Type your guess..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendGuess()}
                    style={{
                      border: '2px solid #2a2a2a',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.target.style.boxShadow = '0 0 0 2px rgba(94, 179, 246, 0.5)';
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    onClick={handleSendGuess}
                    className="p-2 rounded-lg hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: '#5eb3f6',
                      border: '2px solid #2a2a2a',
                    }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Announcement */}
      {showDrawerAnnouncement && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-40 pointer-events-none">
          <div 
            className="bg-white p-8 animate-bounce"
            style={{
              border: '4px solid #2a2a2a',
              borderRadius: '16px',
              boxShadow: '8px 8px 0px 0px rgba(42, 42, 42, 0.3)',
            }}
          >
            <h2 
              className="text-5xl text-center"
              style={{ fontFamily: "'Bubblegum Sans', cursive" }}
            >
              {drawer === username ? '🎨 You are drawing!' : `✏️ ${drawer} is drawing!`}
            </h2>
          </div>
        </div>
      )}

      {/* Word Selection Modal */}
      {showWordSelection && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div 
            className="bg-white p-8 flex flex-col gap-6"
            style={{
              border: '4px solid #2a2a2a',
              borderRadius: '16px',
              transform: 'rotate(-1deg)',
              boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)',
              maxWidth: '500px',
            }}
          >
            <h2 
              className="text-3xl text-center"
              style={{ fontFamily: "'Bubblegum Sans', cursive" }}
            >
              Choose a word to draw! ✏️
            </h2>
            <p className="text-center text-sm text-gray-600">
              Pick one of these words to draw for the other players
            </p>
            <div className="flex flex-col gap-3">
              {wordChoices.length > 0 ? (
                wordChoices.map((word, index) => (
                  <SketchyButton
                    key={word + index}
                    variant="primary"
                    onClick={() => handleWordSelect(word)}
                    className="text-2xl py-4"
                  >
                    {word.toUpperCase()}
                  </SketchyButton>
                ))
              ) : (
                <p className="text-center text-red-500">No words available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Complete Modal */}
      {showGameComplete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div 
            className="bg-white p-8 flex flex-col gap-6"
            style={{
              border: '4px solid #2a2a2a',
              borderRadius: '16px',
              transform: 'rotate(-1deg)',
              boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)',
              maxWidth: '600px',
              width: '90%',
            }}
          >
            <h2 
              className="text-4xl text-center"
              style={{ fontFamily: "'Bubblegum Sans', cursive" }}
            >
              🎉 Game Complete! 🎉
            </h2>
            <div 
              className="p-4"
              style={{
                backgroundColor: '#ffd966',
                border: '3px solid #2a2a2a',
                borderRadius: '12px',
              }}
            >
              <h3 
                className="text-2xl text-center mb-2"
                style={{ fontFamily: "'Bubblegum Sans', cursive" }}
              >
                👑 Winner: {winner}
              </h3>
            </div>
            <div>
              <h4 
                className="text-xl mb-3 text-center"
                style={{ fontFamily: "'Bubblegum Sans', cursive" }}
              >
                Final Scores
              </h4>
              <div className="space-y-2">
                {finalScores.map((player, index) => (
                  <div 
                    key={player.name}
                    className="flex justify-between items-center p-3"
                    style={{
                      backgroundColor: index === 0 ? '#bae1ba' : '#ffffff',
                      border: '2px solid #2a2a2a',
                      borderRadius: '8px',
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      <span 
                        className="text-lg"
                        style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                      >
                        {player.name}
                      </span>
                    </span>
                    <span 
                      className="text-xl"
                      style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                    >
                      {player.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <SketchyButton
              variant="primary"
              onClick={() => router.push('/')}
              className="text-xl py-3"
            >
              Return to Home
            </SketchyButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const percentage = (seconds / 80) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="relative w-16 h-16 sm:w-24 sm:h-24 p-2"
      style={{ 
        backgroundColor: '#ffffff',
        border: '4px solid #2a2a2a',
        borderRadius: '50%',
        transform: 'rotate(-5deg)',
      }}
    >
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#f0f0e0"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={seconds < 10 ? '#ff6b6b' : '#5eb3f6'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center text-lg sm:text-2xl"
        style={{ fontFamily: "'Bubblegum Sans', cursive" }}
      >
        {seconds}s
      </div>
    </div>
  );
}
