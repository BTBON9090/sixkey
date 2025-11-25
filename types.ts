export type HandMode = 'full' | 'left' | 'right';

export interface KeyGroup {
  label: string;
  subLabel?: string; // e.g. "Del", "Enter"
  chars?: string[]; // The characters contained in this group (e.g., ['q','w','e','r','t'])
  action?: string; // specialized action ID
  width?: 'auto' | 'sm' | 'md' | 'lg' | 'grow';
  type: 'char-group' | 'action' | 'placeholder';
}

export interface KeyboardState {
  inputText: string;
  handMode: HandMode;
  isSymbolLayer: boolean;
  isNumberLayer: boolean;
}