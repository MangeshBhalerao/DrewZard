import React from 'react';

interface SketchyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function SketchyInput({ label, className = '', ...props }: SketchyInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-lg" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 transition-all ${className}`}
        style={{
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          border: '3px solid var(--foreground)',
          borderRadius: '8px',
          transform: 'rotate(0.5deg)',
          boxShadow: '2px 2px 0px 0px var(--border)',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = '0 0 0 4px var(--ring)';
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = '2px 2px 0px 0px var(--border)';
        }}
        {...props}
      />
    </div>
  );
}
