
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { KeyGroup, HandMode } from '../types';
import { ROW_1, ROW_2, ROW_3, ROW_4, TOP_UTILITY, VALID_PINYINS, PINYIN_TO_HANZI, COMMON_PHRASES } from '../constants';
import { KeyButton } from './KeyButton';
import { ExpansionPopup } from './ExpansionPopup';
import { X, Repeat2, ChevronRight } from 'lucide-react';

interface KeyboardLayoutProps {
  onKeyPress: (char: string) => void;
  onDelete: () => void;
  handMode: HandMode;
  setHandMode: (mode: HandMode) => void;
}

interface Segment {
  str: string;
  len: number; // number of key groups consumed
}

interface Candidate {
  display: string;
  value: string;
  score: number;
  consumedLen: number; // How many key groups this candidate consumes
  type: 'phrase' | 'char' | 'raw';
}

interface HistoryItem {
  text: string;
  keys: KeyGroup[];
}

// ---------------------------
// Pinyin Segmentation Logic
// ---------------------------

function matchesGroups(target: string, groups: KeyGroup[]): boolean {
    if (target.length !== groups.length) return false;
    for (let i = 0; i < target.length; i++) {
        const char = target[i].toLowerCase(); 
        const allowed = groups[i].chars;
        if (!allowed || !allowed.includes(char)) {
            return false;
        }
    }
    return true;
}

export const KeyboardLayout: React.FC<KeyboardLayoutProps> = ({ 
  onKeyPress, 
  onDelete, 
  handMode, 
  setHandMode 
}) => {
  // State for sliding "magnifier"
  const [activeGroup, setActiveGroup] = useState<{ chars: string[]; rect: DOMRect } | null>(null);
  const [slideIndex, setSlideIndex] = useState<number>(0);

  // State for Pinyin Input
  const [pinyinKeys, setPinyinKeys] = useState<KeyGroup[]>([]);
  const [stagedText, setStagedText] = useState<string>(''); // Holds "你好" while waiting for "ma"
  const [selectionHistory, setSelectionHistory] = useState<HistoryItem[]>([]);
  
  // State for Expandable Panel
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [candidateMode, setCandidateMode] = useState<'word' | 'char'>('word');
  
  // New State for Pinyin Interaction
  // pinyinFocusSegment: If set, we are filtering by this specific pinyin string (e.g., "pu")
  // which consumes a specific number of keys.
  const [focusedPinyinCandidate, setFocusedPinyinCandidate] = useState<Segment | null>(null);

  // State for Frequency Analysis
  const [usageHistory, setUsageHistory] = useState<Record<string, number>>({});
  
  // Touch refs for swipe detection
  const touchStartY = useRef<number | null>(null);

  // Reset page when input changes
  useEffect(() => {
    setPage(0);
    // If input changes (e.g. backspace), we might need to reset focus unless the keys still support it.
    // For simplicity, reset focus on key change to avoid stale states.
    setFocusedPinyinCandidate(null);
  }, [pinyinKeys]);

  // Helper to fully reset composition state
  const clearComposition = () => {
      setPinyinKeys([]);
      setStagedText('');
      setSelectionHistory([]);
      setIsExpanded(false);
      setFocusedPinyinCandidate(null);
      setPage(0);
  };

  // -------------------------
  // 1. Calculate Valid Pinyin Candidates for the Row
  // -------------------------
  const availablePinyinSegments = useMemo(() => {
      if (pinyinKeys.length === 0) return [];
      
      const results: Segment[] = [];
      const validPinyinsArray = Array.from(VALID_PINYINS);
      // We only look at the start of the current buffer
      const maxLen = Math.min(6, pinyinKeys.length);

      for (let len = 1; len <= maxLen; len++) {
          const chunkSlice = pinyinKeys.slice(0, len);
          // Find all valid pinyins that match this chunk
          const matches = validPinyinsArray.filter(p => p.length === len && matchesGroups(p, chunkSlice));
          matches.forEach(m => {
              results.push({ str: m, len: len });
          });
      }
      
      // Sort: Length ascending, then alphabetical? Or just commonality?
      // Grouping by length might be nice visually.
      return results.sort((a, b) => a.len - b.len || a.str.localeCompare(b.str));
  }, [pinyinKeys]);


  // -------------------------
  // 2. Core Segmentation (DP) for Smart Sentence Prediction
  // -------------------------
  const segmentations = useMemo(() => {
    if (pinyinKeys.length === 0) return [];
    
    const memo = new Map<number, Segment[][]>();
    const validPinyinsArray = Array.from(VALID_PINYINS); 

    function solve(index: number): Segment[][] {
        if (index === pinyinKeys.length) return [[]];
        if (memo.has(index)) return memo.get(index)!;

        const results: Segment[][] = [];
        const remainingLen = pinyinKeys.length - index;
        const maxChunkLen = Math.min(6, remainingLen);

        for (let len = 1; len <= maxChunkLen; len++) {
            const chunkSlice = pinyinKeys.slice(index, index + len);
            const matches = validPinyinsArray.filter(p => p.length === len && matchesGroups(p, chunkSlice));

            for (const m of matches) {
                 const suffixes = solve(index + len);
                 for (const suffix of suffixes) {
                     results.push([{ str: m, len: len }, ...suffix]);
                 }
            }
        }
        
        memo.set(index, results);
        return results;
    }

    return solve(0);
  }, [pinyinKeys]);

  // -------------------------
  // 3. Generate Candidates for Grid
  // -------------------------
  const candidates = useMemo(() => {
    if (pinyinKeys.length === 0) return [];
    
    const processed = new Set<string>();
    const resultList: Candidate[] = [];

    const addResult = (display: string, value: string, baseScore: number, consumedLen: number, type: 'phrase' | 'char' | 'raw', indexPenalty: number = 0) => {
        const key = `${value}-${consumedLen}`;
        if (!processed.has(key)) {
            let score = baseScore;
            
            // Mode Adjustments
            if (candidateMode === 'char' && type === 'char') {
                score += 200; // Massive boost for single chars in Char Mode
            } else if (candidateMode === 'word' && type === 'phrase') {
                score += 50; // Moderate boost for phrases in Word Mode
            }

            // General Bonuses
            score += value.length * 5; // Preference for longer matches
            const freq = usageHistory[value] || 0;
            score += freq * 10; // Frequency learning
            score -= indexPenalty; // Stable sort preserving dict order

            resultList.push({ display, value, score, consumedLen, type });
            processed.add(key);
        }
    };

    // --- LOGIC A: Focused Pinyin Segment (User selected "pu") ---
    if (focusedPinyinCandidate) {
        // Show Hanzi for this specific pinyin string
        const hanzis = PINYIN_TO_HANZI[focusedPinyinCandidate.str];
        if (hanzis) {
            hanzis.forEach((h, idx) => {
                addResult(h, h, 100, focusedPinyinCandidate.len, 'char', idx * 0.1);
            });
        }
        // Also allow phrases starting with this pinyin?
        // For strict "Select Pinyin -> Select Char" flow, just showing chars is cleaner.
        // But design "step 03" says "pu related words and chars".
        // Let's check common phrases starting with this pinyin.
        Object.entries(COMMON_PHRASES).forEach(([pinyinKey, phrases]) => {
            if (pinyinKey.startsWith(focusedPinyinCandidate.str)) {
                // Calculate length
                // This is complex because pinyinKey has apostrophes. 
                // Simplified: Just match chars.
                // For this prototype, strict char matching is safer for the "Focus" UX.
            }
        });

        return resultList.sort((a, b) => b.score - a.score);
    }

    // --- LOGIC B: Smart Prediction (Default) ---
    if (segmentations.length > 0) {
        segmentations.forEach(segPath => {
            if (segPath.length === 0) return;

            // 1. Phrase Matching (Combine first N segments)
            let accumulatedPinyin = "";
            let accumulatedLen = 0;
            
            for (let i = 0; i < Math.min(segPath.length, 4); i++) {
                const s = segPath[i];
                accumulatedPinyin += (i > 0 ? "'" : "") + s.str;
                accumulatedLen += s.len;

                // Check Phrase Dictionary
                if (COMMON_PHRASES[accumulatedPinyin]) {
                    COMMON_PHRASES[accumulatedPinyin].forEach((phrase, idx) => {
                        addResult(phrase, phrase, 150, accumulatedLen, 'phrase', idx * 0.1);
                    });
                }
            }

            // 2. Constructed Hanzi from First Segment
            const firstSeg = segPath[0];
            const pinyinStr = firstSeg.str;
            const hanzis = PINYIN_TO_HANZI[pinyinStr];
            
            if (hanzis) {
                hanzis.forEach((h, idx) => {
                    addResult(h, h, 50, firstSeg.len, 'char', idx * 0.5);
                });
            }
        });
    } else {
        // Fallback
        if (resultList.length === 0) {
            const raw = pinyinKeys.map(k => k.chars?.[0] || '?').join("");
             addResult(raw, raw, 0, pinyinKeys.length, 'raw');
        }
    }

    // Sort Descending by Score
    return resultList.sort((a, b) => b.score - a.score);

  }, [pinyinKeys, segmentations, usageHistory, candidateMode, focusedPinyinCandidate]);

  // Display Logic: Render segments for top bar
  const activeSegmentsDisplay = useMemo(() => {
      // If focused, show the focus + remaining? 
      // Actually, standard behavior is usually best path.
      const segs = segmentations.length > 0 ? segmentations[0] : [];
      if (segs.length === 0 && pinyinKeys.length > 0) {
          return [{ str: pinyinKeys.map(k => k.chars?.[0]).join(''), len: pinyinKeys.length }];
      }
      return segs;
  }, [pinyinKeys, segmentations]);

  // Handle Candidate Selection
  const handleCandidateSelect = (candidate: Candidate) => {
    // 1. Update frequency history
    setUsageHistory(prev => ({
      ...prev,
      [candidate.value]: (prev[candidate.value] || 0) + 1
    }));
    
    // 2. Stage the text
    const newStagedText = stagedText + candidate.value;
    
    // 3. Remove consumed keys from buffer
    const consumedKeys = pinyinKeys.slice(0, candidate.consumedLen);
    const remainingKeys = pinyinKeys.slice(candidate.consumedLen);

    if (remainingKeys.length === 0) {
        // If no keys left, COMMIT everything
        onKeyPress(newStagedText);
        clearComposition();
    } else {
        // If keys remain, wait for next word
        setSelectionHistory(prev => [...prev, { text: candidate.value, keys: consumedKeys }]);
        setStagedText(newStagedText);
        setPinyinKeys(remainingKeys);
        setPage(0);
        setIsExpanded(true); 
        // Reset focus
        setFocusedPinyinCandidate(null);
    }
  };

  const handleTap = (data: KeyGroup) => {
    // 1. Handle Actions
    if (data.type === 'action') {
      if (data.action === 'backspace') {
        handlePanelDelete(); // Unified delete logic
      } else if (data.action === 'space') {
        if (pinyinKeys.length > 0 && candidates.length > 0) {
          handleCandidateSelect(candidates[0]);
        } else if (stagedText.length > 0) {
            onKeyPress(stagedText + ' ');
            setStagedText('');
        } else {
          onKeyPress(' ');
        }
      } else if (data.action === 'enter') {
         if (pinyinKeys.length > 0 || stagedText.length > 0) {
            const raw = pinyinKeys.map(k => k.chars?.[0]).join('').toLowerCase();
            onKeyPress(stagedText + raw);
            clearComposition();
         } else {
            onKeyPress('\n');
         }
      } else if (data.action === 'onehand') setHandMode('right');
      return;
    }

    // 2. Handle Character Groups
    if (data.chars) {
      if (data.chars.length === 1) {
        // Punctuation or single key
        onKeyPress(data.chars[0]);
      } else {
        setPinyinKeys(prev => [...prev, data]);
      }
    }
  };

  const handlePanelDelete = () => {
      if (focusedPinyinCandidate) {
          // Cancel focus
          setFocusedPinyinCandidate(null);
          return;
      }
      
      if (selectionHistory.length > 0) {
          // Withdraw Selection (Undo)
          const last = selectionHistory[selectionHistory.length - 1];
          const newHistory = selectionHistory.slice(0, -1);
          setSelectionHistory(newHistory);
          
          setStagedText(prev => prev.slice(0, -last.text.length));
          setPinyinKeys(prev => [...last.keys, ...prev]);
          setPage(0);
      } else {
          // Edit Mode
          if (pinyinKeys.length > 0) setPinyinKeys(prev => prev.slice(0, -1));
          else if (stagedText.length > 0) setStagedText(prev => prev.slice(0, -1));
          else onDelete();
      }
  };

  const handleLongPressStart = (data: KeyGroup, rect: DOMRect) => {
    if (data.action === 'backspace') {
        clearComposition();
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        return;
    }
    setActiveGroup({ chars: data.chars || [], rect });
    setSlideIndex(Math.floor((data.chars?.length || 0) / 2)); 
  };

  const handleSlideMove = (index: number) => {
    setSlideIndex(index);
  };

  const handleSlideCommit = (char: string) => {
    // Explicit insert overrides composition
    if (pinyinKeys.length > 0 || stagedText.length > 0) {
       if (stagedText.length > 0) {
           onKeyPress(stagedText);
       }
       clearComposition();
    }
    onKeyPress(char.toLowerCase());
    setActiveGroup(null);
  };

  const handleSlideCancel = () => setActiveGroup(null);

  // -----------------------
  // Render Helpers
  // -----------------------

  const renderRow = (row: KeyGroup[], rowIdx: number) => (
    <div key={rowIdx} className="flex w-full gap-1.5 mb-2">
      {row.map((keyData, idx) => (
        <KeyButton 
          key={`${rowIdx}-${idx}`} 
          data={keyData} 
          onTap={handleTap}
          onLongPressStart={handleLongPressStart}
          onSlideMove={handleSlideMove}
          onSlideCommit={handleSlideCommit}
          onSlideCancel={handleSlideCancel}
        />
      ))}
    </div>
  );

  const renderSidePanel = () => {
    if (handMode === 'full') return null;
    return (
      <div className="flex flex-col gap-3 p-2 bg-zinc-900 rounded-xl justify-center items-center w-24 border border-zinc-800">
         <button 
          onClick={() => setHandMode('full')}
          className="flex-1 w-full bg-zinc-800 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-400 active:bg-zinc-700 active:text-white transition-colors"
        >
          <div className="p-2 bg-zinc-900 rounded-full"><X size={24} /></div>
          <span className="text-xs text-center font-medium leading-tight">关闭<br/>单手操作</span>
        </button>
        <button 
          onClick={() => setHandMode(handMode === 'left' ? 'right' : 'left')}
          className="flex-1 w-full bg-zinc-800 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-400 active:bg-zinc-700 active:text-white transition-colors"
        >
           <div className="p-2 bg-zinc-900 rounded-full"><Repeat2 size={24} /></div>
          <span className="text-xs text-center font-medium leading-tight">切换<br/>为{handMode === 'left' ? '右手' : '左手'}</span>
        </button>
      </div>
    );
  };

  // Grid Logic & Swipe
  const GRID_COLS = 4;
  const GRID_ROWS = 4;
  const ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
  const totalPages = Math.ceil(candidates.length / ITEMS_PER_PAGE);
  const currentCandidates = candidates.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handleGridTouchStart = (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
  };

  const handleGridTouchEnd = (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const diffY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartY.current = null;

      if (Math.abs(diffY) > 50) {
          if (diffY < 0) {
              setPage(p => Math.min(totalPages - 1, p + 1));
          } else {
              setPage(p => Math.max(0, p - 1));
          }
      }
  };

  const renderExpandedPanel = () => (
    <div className="flex flex-col w-full px-1 gap-1 pb-1">
      {/* 1. Pinyin Candidate Row (The "tightly adjacent" row) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 min-h-[3rem]">
          {availablePinyinSegments.map((seg, i) => {
              const isActive = focusedPinyinCandidate?.str === seg.str && focusedPinyinCandidate.len === seg.len;
              return (
                <button
                    key={`${seg.str}-${i}`}
                    onClick={() => {
                        if (isActive) setFocusedPinyinCandidate(null);
                        else setFocusedPinyinCandidate(seg);
                        setPage(0);
                    }}
                    className={`px-3 py-1.5 rounded text-lg font-medium transition-colors ${
                        isActive 
                            ? 'bg-zinc-700 text-white shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    {seg.str}
                </button>
              );
          })}
          {availablePinyinSegments.length === 0 && (
              <span className="text-zinc-700 text-sm italic pl-2">输入拼音以显示...</span>
          )}
      </div>

      <div className="flex w-full gap-2 h-56"> {/* Fixed Height for 4x4 Grid + Sidebar */}
        {/* 2. Grid Area */}
        <div 
            className="w-[75%] grid grid-cols-4 grid-rows-4 gap-1 p-1 bg-zinc-900/30 rounded-lg touch-pan-y relative"
            onTouchStart={handleGridTouchStart}
            onTouchEnd={handleGridTouchEnd}
        >
            {/* Pad with empty divs if less than 16 items to maintain grid shape? No, CSS Grid handles it. */}
            {currentCandidates.length > 0 ? currentCandidates.map((cand, i) => (
            <button
                key={i}
                className={`flex items-center justify-center rounded-md text-lg font-medium active:bg-blue-600 transition-colors shadow-sm border border-zinc-700/50 relative overflow-hidden h-full w-full ${
                    // Highlight first item if we are on page 0 and have focused a pinyin
                    (i === 0 && page === 0 && focusedPinyinCandidate) ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300'
                }`}
                onClick={() => handleCandidateSelect(cand)}
            >
                {cand.display}
            </button>
            )) : (
                <div className="col-span-4 row-span-4 flex items-center justify-center text-zinc-500 italic">
                    无候选词
                </div>
            )}
        </div>

        {/* 3. Control Strip (Right Side 25%) */}
        <div className="flex-1 flex flex-col gap-1 h-full">
            {/* Toggle Word/Char */}
            <button 
            className="flex-1 bg-zinc-800 rounded flex flex-col items-center justify-center text-xs font-bold gap-0.5 active:bg-zinc-700"
            onClick={() => setCandidateMode(prev => prev === 'word' ? 'char' : 'word')}
            >
            <span className={`${candidateMode === 'word' ? 'text-blue-400' : 'text-zinc-500'}`}>词</span>
            <div className="w-4 h-[1px] bg-zinc-600"></div>
            <span className={`${candidateMode === 'char' ? 'text-blue-400' : 'text-zinc-500'}`}>字</span>
            </button>

            {/* Delete */}
            <button 
            className="flex-1 bg-zinc-800 rounded flex items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white"
            onClick={handlePanelDelete}
            >
            <span className="text-sm">Del</span>
            </button>

            {/* Page Up */}
            <button 
                className={`flex-1 flex items-center justify-center bg-zinc-800 rounded ${page > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
            >
                <span className="text-xs">上翻</span>
            </button>

            {/* Page Down */}
            <button 
                className={`flex-1 flex items-center justify-center bg-zinc-800 rounded ${page < totalPages - 1 ? 'text-zinc-300' : 'text-zinc-600'}`}
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
                <span className="text-xs">下翻</span>
            </button>

            {/* Close / Return */}
            <button 
            className="flex-1 bg-zinc-800 rounded flex items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white"
            onClick={() => setIsExpanded(false)}
            >
            <span className="text-xs">返回</span>
            </button>
        </div>
      </div>
    </div>
  );

  const isOneHanded = handMode !== 'full';
  const hasComposition = pinyinKeys.length > 0 || stagedText.length > 0;

  // Render the interactive Pinyin segments
  const renderPinyinBar = () => {
    if (!hasComposition) return <span className="text-zinc-700 text-3xl font-light">...</span>;

    // Use activeSegmentsDisplay, but if we have a Focused Candidate, show that one highlighted + raw rest
    // Visual logic: "stagedText" + "pinyinSegments".
    // If focusedPinyinCandidate is set, we highlight the matching segment differently.

    return (
        <div className="flex items-baseline gap-1 text-3xl overflow-x-auto no-scrollbar py-2">
            {stagedText && (
                <span className="text-white font-normal border-b-2 border-transparent mr-2">
                    {stagedText}
                </span>
            )}
            
            {activeSegmentsDisplay.map((seg, idx) => {
                // Determine if this segment matches the currently focused one
                const isFocused = focusedPinyinCandidate && idx === 0 && focusedPinyinCandidate.str === seg.str;
                
                return (
                    <span
                        key={idx}
                        className={`font-light tracking-wide transition-all px-1 rounded ${
                            isFocused 
                                ? 'text-white border-b-2 border-white' 
                                : 'text-zinc-400'
                        }`}
                    >
                        {seg.str}{idx < activeSegmentsDisplay.length - 1 ? "'" : ""}
                    </span>
                );
            })}
        </div>
    );
  };

  return (
    <div className="w-full bg-zinc-950 pb-safe select-none">
      
      {/* --- Pinyin Display Layer (Top Bar) --- */}
      <div className="bg-zinc-950 px-4 pt-4 pb-2 border-b border-zinc-900 min-h-[4rem] flex items-end">
        {renderPinyinBar()}
      </div>

      {/* --- Main Body --- */}
      
      {isExpanded ? (
          renderExpandedPanel()
      ) : (
        <>
             {/* Quick Candidate Bar */}
            <div className="h-14 flex items-center pl-2 pr-1 gap-2 border-b border-zinc-900 mb-2">
                 {!hasComposition ? (
                    <div className="flex-1 text-zinc-600 text-sm ml-2 italic">HexKey Input Ready</div>
                 ) : (
                    <div className="flex-1 flex gap-3 overflow-x-auto no-scrollbar items-center mask-linear-fade">
                        {candidates.slice(0, 5).map((cand, i) => (
                        <button 
                            key={i} 
                            className={`px-4 h-11 rounded-lg text-xl flex-shrink-0 flex items-center justify-center transition-all ${
                                i === 0 && !focusedPinyinCandidate
                                ? 'text-zinc-100 font-medium bg-zinc-800 border border-zinc-700 min-w-[3rem]' 
                                : 'text-zinc-500 active:text-white'
                            }`}
                            onClick={() => handleCandidateSelect(cand)}
                        >
                            {cand.display}
                        </button>
                        ))}
                    </div>
                 )}
                {hasComposition && (
                    <button 
                        className="w-12 h-12 rounded-lg flex items-center justify-center bg-zinc-900 text-green-500 font-bold border border-zinc-800"
                        onClick={() => setIsExpanded(true)}
                    >
                        <ChevronRight size={24} />
                    </button>
                )}
            </div>

            <div className="flex justify-between px-2 py-2 gap-2 mb-2 bg-zinc-900/20">
                {TOP_UTILITY.map((u, i) => (
                <button 
                    key={i} 
                    onClick={() => {
                        if(u.action === 'onehand') setHandMode('right');
                        if(u.action === 'close') clearComposition();
                    }}
                    className="flex-1 py-3 rounded bg-zinc-800/40 text-xs text-zinc-500 font-medium active:bg-zinc-700 active:text-zinc-300 transition-colors"
                >
                    {u.label}
                </button>
                ))}
            </div>

            <div className={`flex w-full px-1 ${isOneHanded ? 'h-64' : ''}`}>
                {handMode === 'right' && <div className="mr-2 flex-shrink-0">{renderSidePanel()}</div>}

                <div className={`flex-1 flex flex-col justify-end transition-all duration-300 ${isOneHanded ? 'scale-y-100' : ''}`}>
                {renderRow(ROW_1, 1)}
                {renderRow(ROW_2, 2)}
                {renderRow(ROW_3, 3)}
                {renderRow(ROW_4, 4)}
                </div>

                {handMode === 'left' && <div className="ml-2 flex-shrink-0">{renderSidePanel()}</div>}
            </div>
        </>
      )}

      {activeGroup && (
        <ExpansionPopup 
          chars={activeGroup.chars}
          triggerRect={activeGroup.rect}
          activeIndex={slideIndex}
        />
      )}
    </div>
  );
};
