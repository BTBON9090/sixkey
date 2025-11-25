import React, { useRef, useEffect } from 'react';
import { KeyGroup } from '../types';

interface KeyButtonProps {
  data: KeyGroup;
  // Called on a quick tap (ambiguous input)
  onTap: (data: KeyGroup) => void;
  // Called when long press starts (to show popup)
  onLongPressStart: (data: KeyGroup, rect: DOMRect) => void;
  // Called during slide to update highlight index
  onSlideMove: (index: number) => void;
  // Called when slide ends to commit a specific character
  onSlideCommit: (char: string) => void;
  // Called if slide ends without selection (cancel)
  onSlideCancel: () => void;
  className?: string;
}

export const KeyButton: React.FC<KeyButtonProps> = ({ 
  data, 
  onTap, 
  onLongPressStart, 
  onSlideMove,
  onSlideCommit,
  onSlideCancel,
  className = '' 
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const isLongPressActive = useRef(false);
  const startX = useRef(0);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    isLongPressActive.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Allow long press for character groups OR backspace (for clear all)
    const isBackspace = data.action === 'backspace';
    const isCharGroup = data.chars && data.chars.length > 1;

    if (isCharGroup || isBackspace) {
      timerRef.current = window.setTimeout(() => {
        if (buttonRef.current) {
          isLongPressActive.current = true;
          const rect = buttonRef.current.getBoundingClientRect();
          onLongPressStart(data, rect);
          
          // Vibrate if available
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }, isBackspace ? 500 : 250); // Longer delay for delete to prevent accidental clears
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const diffX = touch.clientX - startX.current;

    // If we moved significantly BEFORE timer fired, cancel timer (it's a scroll or cancel)
    if (!isLongPressActive.current) {
      if (Math.abs(diffX) > 10) {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
      return;
    }

    // Long press IS active. If it's a char group, calculate index based on slide.
    if (data.chars) {
      const numChars = data.chars.length;
      const middleIndex = Math.floor(numChars / 2);
      
      // Sensitivity: 35px per item
      const indexShift = Math.floor(diffX / 35); 
      let newIndex = middleIndex + indexShift;

      // Clamp
      newIndex = Math.max(0, Math.min(numChars - 1, newIndex));
      
      onSlideMove(newIndex);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isLongPressActive.current) {
        // A Long Press was detected and handled
        if (data.chars) {
            // It was a slide gesture on a char key
            const touch = e.changedTouches[0];
            const diffX = touch.clientX - startX.current;
            const numChars = data.chars.length;
            const middleIndex = Math.floor(numChars / 2);
            const indexShift = Math.floor(diffX / 35);
            let finalIndex = middleIndex + indexShift;
            finalIndex = Math.max(0, Math.min(numChars - 1, finalIndex));
            
            onSlideCommit(data.chars[finalIndex]);
        } else {
            // It was an action key long press (e.g. Backspace Clear All)
            // The action triggers on Start, so we just clean up here.
            // Do NOT fire onTap.
        }

        onSlideCancel(); // Clean up global state
        isLongPressActive.current = false;
    } else {
       // Short Tap
       onTap(data);
       if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  // Utility to determine width class
  const getWidthClass = () => {
    switch (data.width) {
      case 'sm': return 'w-[15%] flex-shrink-0'; // Narrow keys like Del, 123
      case 'grow': return 'flex-1'; // Main letter groups
      default: return 'flex-1';
    }
  };

  const isAction = data.type === 'action';
  
  // Visual Styles
  const baseStyles = "relative h-14 rounded-lg flex items-center justify-center text-lg font-medium transition-all active:scale-95 select-none touch-none";
  const colorStyles = isAction 
    ? "bg-zinc-800 text-zinc-300 shadow-sm border-b-2 border-zinc-900" 
    : "bg-zinc-700 text-white shadow-md border-b-2 border-zinc-900"; 

  return (
    <button
      ref={buttonRef}
      className={`${baseStyles} ${colorStyles} ${getWidthClass()} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {data.label}
    </button>
  );
};