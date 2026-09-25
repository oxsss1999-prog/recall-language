import { useEffect, useState } from 'react';

/*
 * Per-device preferences: keyboard shortcuts and volumes.
 * Stored in localStorage (they depend on the device's keyboard and speakers).
 */

export const ACTIONS = [
  { id: 'opt1', label: 'Choose answer 1' },
  { id: 'opt2', label: 'Choose answer 2' },
  { id: 'opt3', label: 'Choose answer 3' },
  { id: 'opt4', label: 'Choose answer 4' },
  { id: 'listen', label: 'Play pronunciation' },
  { id: 'next', label: 'Continue / next' },
  { id: 'dontKnow', label: 'I don’t know (multiple choice)' },
];

export const DEFAULT_KEYS = { opt1: '1', opt2: '2', opt3: '3', opt4: '4', listen: 's', next: 'Enter', dontKnow: '0' };
export const PRESETS = {
  Numbers: DEFAULT_KEYS,
  'Left hand (A S D F)': { opt1: 'a', opt2: 's', opt3: 'd', opt4: 'f', listen: 'e', next: ' ', dontKnow: 'q' },
  'Right hand (J K L ;)': { opt1: 'j', opt2: 'k', opt3: 'l', opt4: ';', listen: 'i', next: 'Enter', dontKnow: 'p' },
};

const DEFAULTS = { keys: DEFAULT_KEYS, sfxVolume: 0.7, voiceVolume: 1 };
const KEY = 'recall.prefs';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...v, keys: { ...DEFAULT_KEYS, ...(v.keys || {}) } };
  } catch { return DEFAULTS; }
}

let current = read();
const listeners = new Set();

export const getPrefs = () => current;

export function setPrefs(patch) {
  current = { ...current, ...patch, keys: { ...current.keys, ...(patch.keys || {}) } };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach(fn => fn(current));
}

export function usePrefs() {
  const [p, setP] = useState(current);
  useEffect(() => { listeners.add(setP); return () => listeners.delete(setP); }, []);
  return p;
}

/** Normalize a KeyboardEvent key for matching and storage. */
export const normKey = k => (k.length === 1 ? k.toLowerCase() : k);

/** Pretty label for a key. */
export function keyLabel(k) {
  if (k === ' ') return 'Space';
  if (k === 'Enter') return 'Enter';
  if (k.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[k];
  return k.length === 1 ? k.toUpperCase() : k;
}

/** Which action (if any) a key press maps to. */
export function actionFor(key) {
  const k = normKey(key);
  return Object.keys(current.keys).find(a => current.keys[a] === k) || null;
}
