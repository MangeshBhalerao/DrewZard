'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { SketchyButton } from '@/components/SketchyButton';
import { DrawingCanvas, DrawingCanvasRef } from '@/components/DrawingCanvas';
import { ArrowLeft, Eraser, Trash2, Send } from 'lucide-react';

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

  // Debug: Log when word selection modal should show
  useEffect(() => {
    console.log('📊 Word selection state changed:', showWordSelection);
    console.log('   Word choices:', wordChoices);
  }, [showWordSelection, wordChoices]);

  // Timer
  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [joined]);

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

  // WebSocket connection
  useEffect(() => {
    if (!joined || hasConnectedRef.current) return;
    
    hasConnectedRef.current = true;
    console.log('🔌🔌🔌 Creating GAME PAGE WebSocket connection...');
    const socket = new WebSocket(`ws://localhost:8000/ws/${roomCode}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅✅✅ Game WebSocket connected to room:', roomCode);
      console.log('   Sending join message for:', username);
      socket.send(JSON.stringify({
        type: 'join',
        username: username,
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Game Page Message received:', data.type, data);

      switch (data.type) {
        case 'players_update':
          console.log('   Players:', data.players);
          setPlayers(data.players.map((p: any) => ({
            name: p.name,
            score: p.score || 0,
            ready: p.ready
          })));
          break;

        case 'round_start':
          console.log('🎮 ROUND START - Drawer:', data.drawer, 'My username:', username);
          console.log('   Full round_start data:', JSON.stringify(data));
          setRound(data.round);
          setDrawer(data.drawer);
          console.log('✅ Drawer state set to:', data.drawer);
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
          console.log('🎯🎯🎯 WORD_CHOICES MESSAGE RECEIVED!');
          console.log('   Words:', data.words);
          console.log('   Drawer from message:', data.drawer);
          console.log('   My username:', username);
          console.log('   Current drawer state:', drawer);
          console.log('   Am I the drawer?', username === data.drawer);
          
          if (data.words && data.words.length > 0) {
            setWordChoices(data.words);
            setShowWordSelection(true);
            console.log('✅✅✅ Word selection modal ACTIVATED');
          } else {
            console.log('⚠️  No words in word_choices message');
          }
          break;

        case 'word_chosen':
          setWordHint(data.word_hint);
          setShowWordSelection(false);
          break;

        case 'chat':
          setGuesses(prev => [...prev, {
            id: Date.now(),
            player: data.username,
            message: data.message,
            isCorrect: false
          }]);
          break;
      }
    };

    socket.onclose = () => {
      console.log('❌ Game WebSocket disconnected');
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
    <div className="min-h-screen relative overflow-hidden">
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
      
      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <div className="p-4 border-b-4 border-solid" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderColor: '#2a2a2a' }}>
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
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full grid lg:grid-cols-[1fr_300px] gap-4">
            {/* Canvas and Tools */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Drawing Tools - Only visible to drawer */}
              {username === drawer && (
              <div 
                className="p-4"
                style={{
                  backgroundColor: '#ffffff',
                  border: '4px solid #2a2a2a',
                  borderRadius: '12px',
                  transform: 'rotate(-0.3deg)',
                  boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                }}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Colors */}
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${
                          currentColor === color.value ? 'scale-110' : ''
                        }`}
                        style={{ 
                          backgroundColor: color.value,
                          border: '3px solid #2a2a2a',
                          boxShadow: currentColor === color.value 
                            ? '0 0 0 4px rgba(94, 179, 246, 0.5)' 
                            : '2px 2px 0px rgba(42, 42, 42, 0.3)',
                        }}
                        onClick={() => setCurrentColor(color.value)}
                        title={color.name}
                      />
                    ))}
                  </div>

                  <div className="h-8 w-px" style={{ backgroundColor: 'rgba(42, 42, 42, 0.2)' }} />

                  {/* Brush Sizes */}
                  <div className="flex gap-2">
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size}
                        className="w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:scale-110"
                        style={{
                          border: '2px solid #2a2a2a',
                          backgroundColor: brushSize === size ? '#5eb3f6' : '#ffffff',
                          boxShadow: brushSize === size ? '0 0 0 2px rgba(94, 179, 246, 0.5)' : 'none',
                        }}
                        onClick={() => setBrushSize(size)}
                        title={`${size}px`}
                      >
                        <div
                          className="rounded-full"
                          style={{
                            width: `${Math.min(size, 12)}px`,
                            height: `${Math.min(size, 12)}px`,
                            backgroundColor: '#2a2a2a',
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="h-8 w-px" style={{ backgroundColor: 'rgba(42, 42, 42, 0.2)' }} />

                  {/* Tools */}
                  <button
                    className="p-2 rounded-lg hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: '#ffb3ba',
                      border: '2px solid #2a2a2a',
                    }}
                    onClick={() => setCurrentColor('#ffffff')}
                    title="Eraser"
                  >
                    <Eraser className="w-6 h-6" />
                  </button>

                  <button
                    className="p-2 rounded-lg hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: '#ff6b6b',
                      color: '#ffffff',
                      border: '2px solid #2a2a2a',
                    }}
                    onClick={clearCanvas}
                    title="Clear Canvas"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
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

              {/* Canvas */}
              <div className="flex-1 min-h-0">
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
                    }}
                  />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Scoreboard */}
              <div 
                className="p-4"
                style={{
                  backgroundColor: '#ffffff',
                  border: '4px solid #2a2a2a',
                  borderRadius: '12px',
                  transform: 'rotate(-0.5deg)',
                  boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
                }}
              >
                <h3 
                  className="text-2xl mb-3 text-center"
                  style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                >
                  🏆 Scoreboard
                </h3>
                
                <div className="space-y-2">
                  {players.map((player, index) => (
                    <div
                      key={player.name}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{
                        backgroundColor: player.name === drawer ? '#ffd966' : '#f0f0e0',
                        border: '2px solid rgba(42, 42, 42, 0.2)',
                      }}
                    >
                      <span className="text-xl">
                        {player.name === drawer ? '✏️' : '🎨'}
                      </span>
                      <div className="flex-1">
                        <p 
                          className="font-semibold"
                          style={{ fontFamily: "'Bubblegum Sans', cursive" }}
                        >
                          {player.name} {player.name === username && '(You)'}
                          {player.name === drawer && (
                            <span 
                              className="ml-2 text-xs px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: '#ff6b6b',
                                color: '#ffffff',
                                border: '1px solid #2a2a2a'
                              }}
                            >
                              Drawing!
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {player.score} points
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guesses/Chat */}
              <div 
                className="flex-1 p-4 flex flex-col min-h-0"
                style={{
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
                
                <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
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

      {/* Debug Panel - Remove this after testing */}
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs max-w-xs z-50 font-mono">
        <div className="font-bold mb-2">🐛 DEBUG INFO</div>
        <div>showWordSelection: <span className="text-yellow-300">{showWordSelection ? 'TRUE' : 'FALSE'}</span></div>
        <div>wordChoices: <span className="text-blue-300">{JSON.stringify(wordChoices)}</span></div>
        <div>drawer: <span className="text-green-300">{drawer || '(not set)'}</span></div>
        <div>username: <span className="text-purple-300">{username}</span></div>
        <div>isDrawer: <span className={username === drawer ? 'text-red-400 font-bold' : 'text-gray-400'}>{username === drawer ? 'YES ✏️' : 'NO'}</span></div>
        <div>round: <span className="text-orange-300">{round}</span></div>
        <div className="mt-2 text-xs text-gray-400">Check browser console for more logs</div>
      </div>
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
