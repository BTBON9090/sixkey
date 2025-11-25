import React, { useState } from 'react';
import { KeyboardLayout } from './components/KeyboardLayout';
import { HandMode } from './types';

export default function App() {
  const [input, setInput] = useState('');
  const [handMode, setHandMode] = useState<HandMode>('full');

  const handleKeyPress = (char: string) => {
    setInput(prev => prev + char);
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden relative font-sans">
      
      {/* Screen / Display Area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center bg-zinc-950 text-zinc-100" onClick={() => {
        // Optional: Clicking background could dismiss keyboard functionality if implemented
      }}>
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">六脉神键</h1>
            <p className="text-zinc-500 text-sm">
              Use the "单手" (One Hand) button to toggle modes. 
              Click a key group (e.g., QWERT) to select a letter.
            </p>
          </div>

          {/* Input Simulation */}
          <div className="w-full min-h-[120px] bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-xl relative shadow-inner">
            <span className="whitespace-pre-wrap break-words">
              {input}
            </span>
            {/* Blinking Cursor */}
            <span className="inline-block w-0.5 h-6 ml-0.5 bg-blue-500 animate-pulse align-middle"></span>
            
            {input.length === 0 && (
              <span className="absolute left-4 top-4 text-zinc-600 pointer-events-none">
                Start typing...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Area - Fixed to bottom */}
      <div className="w-full bg-zinc-950 border-t border-zinc-900 pb-2 safe-pb z-10">
        <KeyboardLayout 
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          handMode={handMode}
          setHandMode={setHandMode}
        />
      </div>

    </div>
  );
}