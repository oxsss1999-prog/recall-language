import { useEffect, useRef, useState } from 'react';
import { local } from '../lib/store';
import { shuffle } from '../lib/learn';
import { speak, speakable, stop } from '../lib/speech';

/*
 * Listen mode: a hands-free player that reads the set aloud, card by card.
 * Term (repeated N times) → optional meaning → pause → next card.
 */

const DEFAULTS = { repeat: 2, gap: 2, readDef: false, show: 'all', loop: true, rate: 0.9 };

/** The first readable part of a definition: "I like shopping. | [Frame 2 …]" → "I like shopping." */
const meaningOf = def => String(def || '').split(/\s\|\s|\[/)[0].trim();

/** Speak and resolve when finished (with a safety timeout if the browser never reports the end). */
function say(text, rate) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
    const what = speakable(text);
    const est = what ? 1500 + (what.text.length * 260) / rate : 0;
    const t = setTimeout(finish, est + 4000);
    speak(text, { rate, onEnd: finish }).then(ok => { if (!ok) finish(); });
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

export default function Listen({ set, go }) {
  const [cfg] = useState(() => local.get(`recall.listen.${set.id}`, {}));
  const [o, setO] = useState(() => ({ ...DEFAULTS, ...local.get('recall.listenopts', {}) }));
  const setOpt = patch => setO(prev => { const n = { ...prev, ...patch }; local.set('recall.listenopts', n); return n; });

  const [list] = useState(() => {
    const scope = cfg.ids ? set.cards.filter(k => cfg.ids.includes(k.id)) : set.cards;
    const usable = scope.filter(k => speakable(k.term) || speakable(k.def));
    return cfg.shuffle ? shuffle(usable) : usable;
  });
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('term'); // which side is being read
  const [rep, setRep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const run = useRef(0);
  const opts = useRef(o);
  opts.current = o;
  const wake = useRef(null);

  const card = list[idx];

  async function play(from = idx) {
    const id = ++run.current;
    const alive = () => id === run.current;
    setPlaying(true);
    try { wake.current = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
    let i = from;
    while (alive()) {
      if (i >= list.length) {
        if (!opts.current.loop) break;
        i = 0;
      }
      const k = list[i];
      setIdx(i); setRevealed(false);
      const { repeat, rate, readDef, gap } = opts.current;
      for (let r = 1; r <= repeat && alive(); r++) {
        setPhase('term'); setRep(r);
        await say(k.term, rate);
        if (!alive()) return;
        if (r < repeat) await wait(700);
      }
      if (readDef && alive()) {
        const m = meaningOf(k.def);
        if (m) { setPhase('def'); setRevealed(true); await wait(400); await say(m, rate); }
      }
      if (!alive()) return;
      setRevealed(true);
      await wait(gap * 1000);
      i++;
    }
    if (alive()) { setPlaying(false); setIdx(0); }
    wake.current?.release?.().catch(() => {});
  }

  function pause() {
    run.current++;
    stop();
    setPlaying(false);
    wake.current?.release?.().catch(() => {});
  }

  function jump(i) {
    const n = (i + list.length) % list.length;
    const was = playing;
    pause();
    setIdx(n); setRevealed(false); setPhase('term'); setRep(1);
    if (was) setTimeout(() => play(n), 50);
  }

  // Keep the current card visible inside the list box only; never scroll the page itself.
  const listRef = useRef(null);
  useEffect(() => {
    const box = listRef.current;
    const item = box?.querySelector('.listen-item.on');
    if (!box || !item) return;
    const top = item.offsetTop; // list is position:relative, so this is relative to the box
    const bottom = top + item.offsetHeight;
    if (top < box.scrollTop) box.scrollTo({ top, behavior: 'smooth' });
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight, behavior: 'smooth' });
  }, [idx]);

  useEffect(() => () => { run.current++; stop(); wake.current?.release?.().catch(() => {}); }, []);

  // Space play/pause · ←/→ previous/next · R reveal
  const live = useRef();
  live.current = { playing, idx, play, pause, jump };
  useEffect(() => {
    const onKey = e => {
      if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const { playing, idx, play, pause, jump } = live.current;
      if (e.key === ' ') { e.preventDefault(); playing ? pause() : play(idx); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); jump(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(idx - 1); }
      else if (e.key === 'r' || e.key === 'R') setRevealed(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!list.length) {
    return (
      <>
        <button className="crumb" type="button" onClick={() => go('set', set.id)}>← {set.title || 'Untitled set'}</button>
        <div className="panel"><p className="lede" style={{ margin: 0 }}>Nothing in this selection can be read aloud.</p></div>
      </>
    );
  }

  const showTerm = o.show !== 'hidden' || revealed;
  const showDef = o.show === 'all' || revealed;
  const chip = (key, val, label) => (
    <button type="button" className="chip" aria-pressed={o[key] === val} onClick={() => setOpt({ [key]: val })}>{label}</button>
  );

  return (
    <>
      <button className="crumb" type="button" onClick={() => { pause(); go('set', set.id); }}>← {set.title || 'Untitled set'}</button>
      <div className="lhead">
        <span className="lmeta">Listen · {idx + 1} of {list.length}{cfg.shuffle ? ' · shuffled' : ''}</span>
        <span className="lmeta">{playing ? (phase === 'def' ? 'Meaning' : `Play ${rep} of ${o.repeat}`) : 'Paused'}</span>
      </div>
      <div className="bar listen-bar"><span className="b2" style={{ width: `${((idx + 1) / list.length) * 100}%` }} /></div>

      <div className={`qcard listen-card ${playing ? 'is-playing' : ''}`}>
        <div className="qlabel"><span>Term</span>{playing && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}</div>
        <div className={`prompt listen-term ${phase === 'term' && playing ? 'reading' : ''}`}>
          {showTerm ? card.term : <button type="button" className="reveal" onClick={() => setRevealed(true)}>Tap or press R to show the text</button>}
        </div>
        {showDef && card.def && (
          <div className={`listen-def ${phase === 'def' && playing ? 'reading' : ''}`}>{card.def}</div>
        )}

        <div className="transport">
          <button type="button" className="tbtn" onClick={() => jump(idx - 1)} aria-label="Previous (←)">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" /></svg>
          </button>
          <button type="button" className="tbtn play" onClick={() => (playing ? pause() : play(idx))} aria-label={playing ? 'Pause (Space)' : 'Play (Space)'}>
            {playing
              ? <svg viewBox="0 0 24 24" width="30" height="30"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
          </button>
          <button type="button" className="tbtn" onClick={() => jump(idx + 1)} aria-label="Next (→)">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor" /></svg>
          </button>
        </div>
      </div>

      <div className="panel listen-opts">
        <div><span className="lab">Repeat each</span><div className="chips">{chip('repeat', 1, '×1')}{chip('repeat', 2, '×2')}{chip('repeat', 3, '×3')}</div></div>
        <div><span className="lab">Pause between</span><div className="chips">{chip('gap', 1, '1s')}{chip('gap', 2, '2s')}{chip('gap', 3, '3s')}{chip('gap', 5, '5s')}</div></div>
        <div><span className="lab">Text</span><div className="chips">{chip('show', 'all', 'Show all')}{chip('show', 'term', 'Term only')}{chip('show', 'hidden', 'Hide (blind)')}</div></div>
        <div><span className="lab">Speed</span><div className="chips">{[0.6, 0.75, 0.9, 1, 1.2].map(r => <span key={r}>{chip('rate', r, `${r}×`)}</span>)}</div></div>
        <div className="listen-switches">
          <label className="switch"><input type="checkbox" checked={o.readDef} onChange={e => setOpt({ readDef: e.target.checked })} /> Read the meaning too</label>
          <label className="switch"><input type="checkbox" checked={o.loop} onChange={e => setOpt({ loop: e.target.checked })} /> Loop</label>
        </div>
        <p className="hint" style={{ margin: 0 }}><kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> previous/next · <kbd>R</kbd> show text. Changes apply from the next card.</p>
      </div>

      <div className="listen-list" ref={listRef}>
        {list.map((k, i) => (
          <button key={k.id} type="button" className={`listen-item ${i === idx ? 'on' : ''}`} onClick={() => jump(i)}>
            <span className="n">{i + 1}</span><span className="t">{k.term}</span>
          </button>
        ))}
      </div>
    </>
  );
}
