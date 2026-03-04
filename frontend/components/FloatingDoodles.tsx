import { Sparkles, Star, Zap, Cloud, Heart, Smile } from 'lucide-react';

export function FloatingDoodles() {
  return (
    <>
      {/* Floating doodles positioned around the page */}
      <div className="fixed top-10 right-20 animate-bounce" style={{ animationDuration: '3s' }}>
        <Star className="w-8 h-8" style={{ color: '#ffd966' }} fill="currentColor" />
      </div>
      <div className="fixed top-32 left-32 animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}>
        <Sparkles className="w-10 h-10" style={{ color: '#5eb3f6' }} />
      </div>
      <div className="fixed bottom-20 right-40 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }}>
        <Zap className="w-9 h-9" style={{ color: '#ffd966' }} fill="currentColor" />
      </div>
      <div className="fixed top-1/4 right-10 animate-bounce" style={{ animationDuration: '5s' }}>
        <Cloud className="w-12 h-12" style={{ color: 'rgba(94, 179, 246, 0.4)' }} />
      </div>
      <div className="fixed bottom-32 left-20 animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.7s' }}>
        <Heart className="w-7 h-7" style={{ color: '#ffb3ba' }} fill="currentColor" />
      </div>
      <div className="fixed top-1/3 left-10 animate-bounce" style={{ animationDuration: '3.8s', animationDelay: '1.2s' }}>
        <Smile className="w-8 h-8" style={{ color: '#ffd966' }} />
      </div>
    </>
  );
}
