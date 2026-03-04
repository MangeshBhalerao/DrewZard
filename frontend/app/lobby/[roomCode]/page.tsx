'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { FloatingDoodles } from '@/components/FloatingDoodles';
import { SketchyButton } from '@/components/SketchyButton';
import { ArrowLeft, Copy, CheckCircle2, Send } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  isReady: boolean;
  avatar: string;
}

interface ChatMessage {
  id: number;
  player: string;
  message: string;
  isSystem: boolean;
}

export default function Lobby() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false); // Prevent multiple connections
  const isGameStartingRef = useRef(false); // Track if game is starting
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, player: 'System', message: 'Welcome to the lobby!', isSystem: true },
  ]);
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null); // For game starting countdown

  // Get username from session storage or prompt
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      setJoined(true);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!joined) return;
    
    // Prevent multiple connections
    if (hasConnectedRef.current) {
      console.log('Lobby WebSocket already connected, skipping...');
      return;
    }

    const wsBase = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000';
    const websocketUrl = `${wsBase}/ws/${roomCode}`;
    socketRef.current = new WebSocket(websocketUrl);
    const socket = socketRef.current;
    hasConnectedRef.current = true; // Mark as connected

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'join',
        username: username,
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle players list update
      if (data.type === 'players_update') {
        const updatedPlayers = data.players.map((player: any, index: number) => ({
          id: index + 1,
          name: player.name,
          isReady: player.ready,  // Use ready status from backend
          avatar: getRandomAvatar(),
          isAdmin: player.is_admin || false,
        }));
        setPlayers(updatedPlayers);
        
        // Update my ready state if I'm in the list
        const myPlayer = updatedPlayers.find((p: Player) => p.name === username);
        if (myPlayer) {
          setIsReady(myPlayer.isReady);
        }
      }

      // Handle chat messages (including system messages)
      if (data.type === 'chat') {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          player: data.username,
          message: data.message,
          isSystem: data.isSystem || false,
        }]);
      }

      // Handle game starting countdown
      if (data.type === 'game_starting') {
        isGameStartingRef.current = true; // Mark that game is starting
        const countdownValue = data.countdown || 3;
        setCountdown(countdownValue);
        
        // Countdown timer
        let current = countdownValue;
        const timer = setInterval(() => {
          current -= 1;
          setCountdown(current);
          if (current <= 0) {
            clearInterval(timer);
          }
        }, 1000);
        
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          player: 'System',
          message: '🎮 Admin started the game!',
          isSystem: true,
        }]);
      }

      // Handle player kicked
      if (data.type === 'player_kicked') {
        if (data.player_name === username) {
          alert('You have been kicked from the room by the admin');
          router.push('/');
        }
      }

      // Handle game start
      if (data.type === 'game_start' || data.type === 'game_in_progress') {
        setCountdown(null);
        isGameStartingRef.current = false;
        socket.close();
        hasConnectedRef.current = false;
        setTimeout(() => {
          router.push(`/game/${roomCode}`);
        }, 100);
      }
    };

    socket.onerror = (error) => {
      // WebSocket error
    };

    socket.onclose = () => {
      hasConnectedRef.current = false;
    };

    return () => {
      // Don't close socket if game is starting (waiting for game_start message)
      if (!isGameStartingRef.current) {
        socket.close();
      }
      hasConnectedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]); // Only reconnect if joined state changes

  const handleJoin = () => {
    if (username.trim()) {
      sessionStorage.setItem('username', username);
      setJoined(true);
    }
  };

  const getRandomAvatar = () => {
    const avatars = ['🎨', '🖌️', '✏️', '🖍️', '🖊️', '✒️', '🖋️', '🎭'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendMessage = () => {
    if (chatMessage.trim() && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        username: username,
        message: chatMessage,
      }));
      setChatMessage('');
    }
  };

  const handleToggleReady = () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    
    // Send ready state to backend
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'ready',
        ready: newReadyState,
      }));
    }
  };

  const handleStartGame = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'start_game',
        username: username,
      }));
    }
  };

  const handleKickPlayer = (playerName: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && playerName !== username) {
      socketRef.current.send(JSON.stringify({
        type: 'kick_player',
        admin_username: username,
        player_name: playerName,
      }));
    }
  };

  const isUserAdmin = () => {
    const myPlayer = players.find(p => p.name === username);
    return myPlayer?.isAdmin || false;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <NotebookBackground />
      <FloatingDoodles />
      
      
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
              Join Lobby
            </SketchyButton>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
          <div 
            className="bg-white p-16 flex flex-col items-center gap-6"
            style={{
              border: '6px solid #2a2a2a',
              borderRadius: '24px',
              transform: 'rotate(-2deg)',
              boxShadow: '10px 10px 0px 0px rgba(42, 42, 42, 0.5)',
            }}
          >
            <h2 
              className="text-4xl"
              style={{ 
                fontFamily: "'Bubblegum Sans', cursive",
                color: '#2a2a2a'
              }}
            >
              🎮 Game Starting!
            </h2>
            <div 
              className="text-9xl animate-pulse"
              style={{ 
                fontFamily: "'Bubblegum Sans', cursive",
                color: '#5eb3f6',
                textShadow: '4px 4px 0px rgba(42, 42, 42, 0.3)'
              }}
            >
              {countdown}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 transition-colors"
            style={{ color: '#2a2a2a' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#5eb3f6'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#2a2a2a'}
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-xl">Back</span>
          </button>
          
          <h1 
            className="text-5xl md:text-6xl"
            style={{
              fontFamily: "'Bubblegum Sans', cursive",
              transform: 'rotate(-1deg)',
            }}
          >
            DrewZard
          </h1>
          
          <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Room Code Display */}
        <div 
          className="max-w-md mx-auto mb-8 p-6"
          style={{
            backgroundColor: '#ffd966',
            border: '4px solid #2a2a2a',
            borderRadius: '16px',
            transform: 'rotate(-1deg)',
            boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)',
          }}
        >
          <div className="text-center">
            <p className="text-lg mb-2">Room Code:</p>
            <div className="flex items-center justify-center gap-3">
              <p 
                className="text-5xl tracking-wider"
                style={{ fontFamily: "'Bubblegum Sans', cursive" }}
              >
                {roomCode}
              </p>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:scale-110 transition-transform"
              >
                {copied ? (
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#16a34a' }} />
                ) : (
                  <Copy className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Players Section */}
          <div className="lg:col-span-2">
            <div 
              className="p-6"
              style={{
                backgroundColor: '#ffffff',
                border: '4px solid #2a2a2a',
                borderRadius: '16px',
                transform: 'rotate(0.5deg)',
                boxShadow: '4px 4px 0px 0px rgba(42, 42, 42, 0.3)',
              }}
            >
              <h2 
                className="text-3xl mb-6"
                style={{
                  fontFamily: "'Bubblegum Sans', cursive",
                  transform: 'rotate(-0.5deg)',
                }}
              >
                Players ({players.length}/8)
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {players.map((player) => (
                  <PlayerCard 
                    key={player.id} 
                    player={player} 
                    isAdmin={isUserAdmin()}
                    myUsername={username}
                    onKick={handleKickPlayer}
                  />
                ))}
              </div>

              <div className="flex gap-4">
                {!isUserAdmin() && (
                  <SketchyButton
                    variant={isReady ? 'success' : 'primary'}
                    size="md"
                    className="flex-1"
                    onClick={handleToggleReady}
                  >
                    {isReady ? '✓ Ready!' : 'Ready Up'}
                  </SketchyButton>
                )}
                {isUserAdmin() && (
                  <SketchyButton
                    variant="accent"
                    size="md"
                    className="flex-1"
                    onClick={handleStartGame}
                  >
                    🎮 Start Game
                  </SketchyButton>
                )}
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div>
            <div 
              className="p-4 h-[500px] flex flex-col"
              style={{
                backgroundColor: '#ffffff',
                border: '4px solid #2a2a2a',
                borderRadius: '16px',
                transform: 'rotate(-0.5deg)',
                boxShadow: '4px 4px 0px 0px rgba(42, 42, 42, 0.3)',
              }}
            >
              <h3 
                className="text-2xl mb-4 pb-3"
                style={{
                  fontFamily: "'Bubblegum Sans', cursive",
                  borderBottom: '2px dashed rgba(42, 42, 42, 0.2)',
                }}
              >
                Chat 💬
              </h3>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: msg.isSystem ? '#f0f0e0' : 'rgba(94, 179, 246, 0.1)',
                      color: msg.isSystem ? '#6a6a6a' : '#2a2a2a',
                      fontStyle: msg.isSystem ? 'italic' : 'normal',
                      textAlign: msg.isSystem ? 'center' : 'left',
                    }}
                  >
                    {!msg.isSystem && (
                      <span className="font-bold">{msg.player}: </span>
                    )}
                    {msg.message}
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-lg"
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
                  onClick={handleSendMessage}
                  className="p-2 rounded-lg hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: '#5eb3f6',
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
  );
}

interface Player {
  id: number;
  name: string;
  isReady: boolean;
  avatar: string;
  isAdmin?: boolean;
}

function PlayerCard({ player, isAdmin, myUsername, onKick }: { 
  player: Player; 
  isAdmin: boolean;
  myUsername: string;
  onKick: (playerName: string) => void;
}) {
  return (
    <div 
      className="p-4 transition-all hover:scale-105"
      style={{
        backgroundColor: player.isReady ? '#bae1ba' : '#ffb3ba',
        border: '3px solid #2a2a2a',
        borderRadius: '12px',
        transform: 'rotate(-0.5deg)',
        boxShadow: '2px 2px 0px 0px rgba(42, 42, 42, 0.3)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-4xl">{player.avatar}</div>
        <div className="flex-1">
          <p className="text-xl">
            {player.name}
            {player.isAdmin && ' 👑'}
            {player.name === myUsername && ' (You)'}
          </p>
          <p className="text-sm" style={{ color: '#6a6a6a' }}>
            {player.isReady ? '✓ Ready' : 'Not ready'}
          </p>
        </div>
        {isAdmin && player.name !== myUsername && (
          <button
            onClick={() => onKick(player.name)}
            className="px-3 py-1 text-sm hover:scale-110 transition-transform"
            style={{
              backgroundColor: '#ff6b6b',
              color: '#ffffff',
              border: '2px solid #2a2a2a',
              borderRadius: '8px',
            }}
          >
            Kick
          </button>
        )}
      </div>
    </div>
  );
}
