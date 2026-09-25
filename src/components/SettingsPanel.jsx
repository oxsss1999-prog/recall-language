import { useEffect, useState } from 'react';
import { ACTIONS, DEFAULT_KEYS, PRESETS, keyLabel, normKey, setPrefs, usePrefs } from '../lib/prefs';
import * as sfx from '../lib/sfx';
import { speak } from '../lib/speech';

const RESERVED = ['Escape', 'Tab', 'Backspace', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

/** Modal with keyboard shortcuts and volume sliders. */
export default function SettingsPanel({ onClose, sample }) {
  const prefs = usePrefs();
  const [listening, setListening] = useState(null); // action id waiting for a key
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = e => {
      if (!listening) {
        if (e.key === 'Escape') onClose();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setListening(null); return; }
      if (RESERVED.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) {
        setNote(`${e.key} can’t be used. Pick a letter, number, Space, Enter or an arrow key.`);
        return;
      }
      const k = normKey(e.key);
      const keys = { ...prefs.keys };
      // If another action already uses this key, swap them so nothing is lost.
      const clash = Object.keys(keys).find(a => a !== listening && keys[a] === k);
      if (clash) keys[clash] = keys[listening];
      keys[listening] = k;
      setPrefs({ keys });
      setNote(clash ? `Swapped with “${ACTIONS.find(a => a.id === clash).label}”.` : '');
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true); // capture: beat the Learn shortcuts
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, prefs.keys, onClose]);

  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <div className="row between">
          <h2 id="settingsTitle">Study settings</h2>
          <button className="btn ghost small" type="button" onClick={onClose}>Done</button>
        </div>

        <section className="stack">
          <span className="lab">Volume</span>
          <label className="slider">
            <span>Sound effects</span>
            <input type="range" min="0" max="1" step="0.05" value={prefs.sfxVolume}
              onChange={e => setPrefs({ sfxVolume: +e.target.value })}
              onPointerUp={() => sfx.correct(3)} onKeyUp={() => sfx.correct(3)} />
            <b>{Math.round(prefs.sfxVolume * 100)}%</b>
          </label>
          <label className="slider">
            <span>Pronunciation voice</span>
            <input type="range" min="0" max="1" step="0.05" value={prefs.voiceVolume}
              onChange={e => setPrefs({ voiceVolume: +e.target.value })}
              onPointerUp={() => sample && speak(sample)} onKeyUp={() => sample && speak(sample)} />
            <b>{Math.round(prefs.voiceVolume * 100)}%</b>
          </label>
          <p className="hint" style={{ margin: 0 }}>Release a slider to hear a preview. These are on top of your device volume.</p>
        </section>

        <section className="stack">
          <div className="row between">
            <span className="lab" style={{ margin: 0 }}>Keyboard shortcuts</span>
            <div className="chips">
              {Object.entries(PRESETS).map(([name, keys]) => (
                <button key={name} type="button" className="chip" onClick={() => { setPrefs({ keys }); setNote(`Using ${name}.`); }}>{name}</button>
              ))}
            </div>
          </div>
          <div className="keys">
            {ACTIONS.map(a => (
              <div className="keyrow" key={a.id}>
                <span>{a.label}</span>
                <button type="button" className={`keycap ${listening === a.id ? 'listening' : ''}`}
                  onClick={() => { setListening(a.id); setNote(''); }}>
                  {listening === a.id ? 'Press a key…' : keyLabel(prefs.keys[a.id])}
                </button>
              </div>
            ))}
          </div>
          <p className="hint" style={{ margin: 0 }}>
            {note || 'Click a key, then press the key you want. Esc cancels. Shortcuts pause while you’re typing an answer.'}
          </p>
          <div><button type="button" className="btn ghost small" onClick={() => { setPrefs({ keys: DEFAULT_KEYS }); setNote('Reset to defaults.'); }}>Reset shortcuts</button></div>
        </section>
      </div>
    </div>
  );
}
