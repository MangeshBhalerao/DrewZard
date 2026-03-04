'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { FloatingDoodles } from '@/components/FloatingDoodles';
import { SketchyButton } from '@/components/SketchyButton';
import { SketchyInput } from '@/components/SketchyInput';
import { Pencil, Users, Trophy, Clock } from 'lucide-react';

export default function Landing() {
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  const handleCreateRoom = () => {
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/lobby/${newRoomCode}`);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      router.push(`/lobby/${roomCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <NotebookBackground />
      <FloatingDoodles />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Logo / Title */}
        <div className="text-center mb-16 mt-8">
          <h1 
            className="text-7xl md:text-9xl mb-4 select-none"
            style={{
              fontFamily: "'Bubblegum Sans', cursive",
              color: '#2a2a2a',
              textShadow: '4px 4px 0px rgba(94, 179, 246, 0.4), 8px 8px 0px rgba(255, 217, 102, 0.3)',
              transform: 'rotate(-2deg)',
            }}
          >
            DrewZard
          </h1>
          <p className="text-2xl" style={{ transform: 'rotate(0.5deg)', color: '#6a6a6a' }}>
            Draw, Guess, Win! ✏️
          </p>
        </div>

        {/* Main Actions */}
        <div className="max-w-md mx-auto space-y-6 mb-16">
          <SketchyButton 
            variant="primary" 
            size="lg" 
            className="w-full"
            onClick={handleCreateRoom}
          >
            🎨 Create Room
          </SketchyButton>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-1" style={{ backgroundColor: 'rgba(42, 42, 42, 0.2)', transform: 'rotate(-1deg)' }} />
            <span className="text-xl" style={{ color: '#6a6a6a' }}>OR</span>
            <div className="flex-1 h-1" style={{ backgroundColor: 'rgba(42, 42, 42, 0.2)', transform: 'rotate(1deg)' }} />
          </div>

          <div className="space-y-3">
            <SketchyInput
              placeholder="Enter room code..."
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <SketchyButton 
              variant="secondary" 
              size="lg" 
              className="w-full"
              onClick={handleJoinRoom}
              disabled={!roomCode.trim()}
            >
              🚪 Join Room
            </SketchyButton>
          </div>
        </div>

        {/* How to Play Section */}
        <div className="max-w-4xl mx-auto">
          <div 
            className="p-8 mb-8"
            style={{
              backgroundColor: '#ffffff',
              border: '4px solid #2a2a2a',
              borderRadius: '16px',
              transform: 'rotate(-0.5deg)',
              boxShadow: '5px 5px 0px 0px rgba(42, 42, 42, 0.3)',
            }}
          >
            <h2 
              className="text-4xl mb-8 text-center"
              style={{
                fontFamily: "'Bubblegum Sans', cursive",
                transform: 'rotate(1deg)',
              }}
            >
              How to Play 📖
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <HowToPlayCard
                icon={<Pencil className="w-12 h-12" />}
                title="Draw"
                description="When it's your turn, draw the word you're given!"
                color="#5eb3f6"
              />
              <HowToPlayCard
                icon={<Users className="w-12 h-12" />}
                title="Guess"
                description="Watch others draw and type your guesses in chat!"
                color="#ffd966"
              />
              <HowToPlayCard
                icon={<Clock className="w-12 h-12" />}
                title="Race"
                description="You have limited time - draw fast and guess faster!"
                color="#ffb3ba"
              />
              <HowToPlayCard
                icon={<Trophy className="w-12 h-12" />}
                title="Win"
                description="Earn points for correct guesses and good drawings!"
                color="#bae1ba"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HowToPlayCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function HowToPlayCard({ icon, title, description, color }: HowToPlayCardProps) {
  return (
    <div 
      className="p-6 transition-transform hover:scale-105"
      style={{
        backgroundColor: color,
        border: '3px solid #2a2a2a',
        borderRadius: '12px',
        transform: 'rotate(-0.5deg)',
        boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)',
      }}
    >
      <div className="flex items-start gap-4">
        <div style={{ color: '#2a2a2a' }}>{icon}</div>
        <div>
          <h3 className="text-2xl mb-2" style={{ color: '#2a2a2a' }}>{title}</h3>
          <p className="text-lg" style={{ color: 'rgba(42, 42, 42, 0.8)' }}>{description}</p>
        </div>
      </div>
    </div>
  );
}
