import { useState } from 'react';
import { local } from '../lib/store';
import { shuffle } from '../lib/learn';

const SIZES = [5, 7, 10, 15, 20];

/**
 * Chooses what to study before Learn mode starts:
 *   which cards (all / a range / a random sample / only unmastered),
 *   order (set order or shuffled) and round size.
 * The choice is remembered per set on this device.
 */
export default function StudyOptions({ set, onStart, onCancel, mode = 'learn' }) {
  const listen = mode === 'listen';
  const n = set.cards.length;
  const saved = local.get(`recall.studyopts.${set.id}`, {});
  const [scope, setScope] = useState(saved.scope || 'all');
  const [from, setFrom] = useState(Math.min(saved.from || 1, n));
  const [to, setTo] = useState(Math.min(saved.to || Math.min(n, 20), n));
  const [count, setCount] = useState(Math.min(saved.count || Math.min(n, 20), n));
  const [shuffled, setShuffled] = useState(saved.shuffled ?? false);
  const [size, setSize] = useState(saved.size || 7);

  const clamp = v => Math.max(1, Math.min(n, Math.round(+v || 1)));
  const lo = Math.min(clamp(from), clamp(to));
  const hi = Math.max(clamp(from), clamp(to));

  const chosen = () => {
    if (scope === 'range') return set.cards.slice(lo - 1, hi);
    if (scope === 'random') return shuffle(set.cards).slice(0, clamp(count));
    if (scope === 'unmastered') return set.cards.filter(k => (k.s || 0) < 2);
    return set.cards;
  };
  const preview =
    scope === 'range' ? hi - lo + 1
    : scope === 'random' ? clamp(count)
    : scope === 'unmastered' ? set.cards.filter(k => (k.s || 0) < 2).length
    : n;

  const start = () => {
    local.set(`recall.studyopts.${set.id}`, { scope, from: lo, to: hi, count: clamp(count), shuffled, size });
    const cards = chosen();
    onStart({
      ids: scope === 'all' ? null : cards.map(k => k.id),
      shuffle: shuffled,
      size,
    });
  };

  const opt = (value, label) => (
    <button type="button" className="chip" aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>
  );

  return (
    <div className="panel study-opts" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') start(); if (e.key === 'Escape') onCancel(); }}>
      <div>
        <span className="lab">Cards</span>
        <div className="chips">
          {opt('all', `All ${n}`)}
          {opt('range', 'Range')}
          {opt('random', 'Random sample')}
          {opt('unmastered', 'Not yet mastered')}

        </div>
        {scope === 'range' && (
          <div className="row inline-inputs">
            <label htmlFor="rngFrom">Cards</label>
            <input id="rngFrom" className="field num" type="number" min="1" max={n} value={from} onChange={e => setFrom(e.target.value)} />
            <span>to</span>
            <input id="rngTo" className="field num" type="number" min="1" max={n} value={to} onChange={e => setTo(e.target.value)} aria-label="To card" />
            <span className="hint">of {n}</span>
          </div>
        )}
        {scope === 'random' && (
          <div className="row inline-inputs">
            <input id="rndCount" className="field num" type="number" min="1" max={n} value={count} onChange={e => setCount(e.target.value)} aria-label="How many cards" />
            <span>random cards out of {n}</span>
            <div className="chips">{[10, 20, 30].filter(x => x < n).map(x => (
              <button key={x} type="button" className="chip" onClick={() => setCount(x)}>{x}</button>
            ))}</div>
          </div>
        )}
      </div>

      <div className="study-row">
        <div>
          <span className="lab">Order</span>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={!shuffled} onClick={() => setShuffled(false)}>In order</button>
            <button type="button" className="chip" aria-pressed={shuffled} onClick={() => setShuffled(true)}>Shuffled</button>
          </div>
        </div>
        {!listen && <div>
          <span className="lab">Cards per round</span>
          <div className="chips">
            {SIZES.map(x => <button key={x} type="button" className="chip" aria-pressed={size === x} onClick={() => setSize(x)}>{x}</button>)}
          </div>
        </div>}
      </div>

      <div className="row">
        <button className="btn primary big" type="button" disabled={!preview} onClick={start}>
          {listen ? 'Start listening' : 'Start'} · {preview} card{preview === 1 ? '' : 's'}
        </button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
