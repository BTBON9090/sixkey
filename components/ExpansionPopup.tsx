import React from 'react';

interface ExpansionPopupProps {
  chars: string[];
  triggerRect: DOMRect | null;
  activeIndex: number; // New prop to track which letter is being hovered
}

export const ExpansionPopup: React.FC<ExpansionPopupProps> = ({ chars, triggerRect, activeIndex }) => {
  if (!triggerRect || !chars.length) return null;

  // Calculate position: Centered horizontally above the key
  const popupWidth = chars.length * 40 + 20; 
  const left = triggerRect.left + (triggerRect.width / 2) - (popupWidth / 2);
  const top = triggerRect.top - 80; // slightly higher to clear finger

  // Safety check to keep within viewport
  const safeLeft = Math.max(10, Math.min(window.innerWidth - popupWidth - 10, left));

  return (
    <div 
      className="fixed z-50 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl p-2 flex gap-1 items-center"
      style={{
        top: `${top}px`,
        left: `${safeLeft}px`,
        pointerEvents: 'none' // Important: Allow touch events to pass through to the slider logic
      }}
    >
      {chars.map((char, idx) => (
        <div
          key={char}
          className={`w-10 h-12 rounded-lg flex items-center justify-center text-xl font-bold transition-all duration-150 ${
            activeIndex === idx 
              ? 'bg-blue-500 text-white scale-125 shadow-lg z-10' 
              : 'bg-zinc-700 text-white'
          }`}
        >
          {char}
        </div>
      ))}
      {/* Triangle Pointer */}
      <div 
          className="absolute -bottom-2 w-4 h-4 bg-zinc-800 border-r border-b border-zinc-600 rotate-45 transform left-1/2 -translate-x-1/2"
      />
    </div>
  );
};