import React from 'react';

interface SketchyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function SketchyButton({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}: SketchyButtonProps) {
  const baseClasses = `
    relative overflow-hidden transition-all
    hover:scale-105 active:scale-95
    disabled:opacity-50 disabled:cursor-not-allowed
    cursor-pointer
  `;

  const variantStyles = {
    primary: { 
      backgroundColor: '#5eb3f6', 
      color: '#2a2a2a',
      boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)'
    },
    secondary: { 
      backgroundColor: '#ffd966', 
      color: '#2a2a2a',
      boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)'
    },
    accent: { 
      backgroundColor: '#ffb3ba', 
      color: '#2a2a2a',
      boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)'
    },
    success: { 
      backgroundColor: '#bae1ba', 
      color: '#2a2a2a',
      boxShadow: '3px 3px 0px 0px rgba(42, 42, 42, 0.3)'
    },
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-lg',
    lg: 'px-8 py-4 text-2xl',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${className}`}
      style={{
        ...variantStyles[variant],
        borderRadius: '12px',
        border: '3px solid #2a2a2a',
        transform: 'rotate(-0.5deg)',
      }}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
