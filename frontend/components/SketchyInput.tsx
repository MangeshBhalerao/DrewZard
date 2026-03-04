import React from 'react';

interface SketchyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function SketchyInput({ label, className = '', ...props }: SketchyInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-lg" style={{ color: '#2a2a2a' }}>
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 transition-all ${className}`}
        style={{
          backgroundColor: '#ffffff',
          border: '3px solid #2a2a2a',
          borderRadius: '8px',
          transform: 'rotate(0.5deg)',
          boxShadow: '2px 2px 0px 0px rgba(42, 42, 42, 0.3)',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = '0 0 0 4px rgba(94, 179, 246, 0.5)';
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = '2px 2px 0px 0px rgba(42, 42, 42, 0.3)';
        }}
        {...props}
      />
    </div>
  );
}
