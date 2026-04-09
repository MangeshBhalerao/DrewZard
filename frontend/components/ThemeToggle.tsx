'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { SketchyButton } from './SketchyButton';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    if (document.documentElement.classList.contains('dark') || 
        window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
      window.dispatchEvent(new Event('themeChanged'));
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
      window.dispatchEvent(new Event('themeChanged'));
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <SketchyButton 
        variant="secondary" 
        onClick={toggleTheme}
        className="px-2 py-2"
        title="Toggle Theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </SketchyButton>
    </div>
  );
}
