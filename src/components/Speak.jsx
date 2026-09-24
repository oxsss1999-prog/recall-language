import { useState } from 'react';
import { speak, speakable, supported } from '../lib/speech';

/** Small speaker button. Renders nothing if the text has nothing speakable. */
export default function Speak({ text, rate = 1, size = 'md', label = 'Play pronunciation' }) {
  const [playing, setPlaying] = useState(false);
  if (!supported || !speakable(text)) return null;
  return (
    <button
      type="button"
      className={`speak ${size} ${playing ? 'on' : ''}`}
      aria-label={label}
      title={`${label} (S)`}
      onClick={e => {
        e.stopPropagation();
        if (speak(text, { rate, onEnd: () => setPlaying(false) })) setPlaying(true);
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        <path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
