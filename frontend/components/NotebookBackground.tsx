export function NotebookBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Notebook lines */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            transparent,
            transparent 31px,
            var(--ring) 31px,
            var(--ring) 32px
          )`,
          backgroundSize: '100% 32px',
        }}
      />
      {/* Red margin line */}
      <div 
        className="absolute left-16 top-0 bottom-0 w-0.5"
        style={{
          backgroundColor: 'var(--destructive)',
          opacity: 0.3,
        }}
      />
    </div>
  );
}
