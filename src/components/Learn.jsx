import { useEffect, useRef, useState } from 'react';
import { counts, local, saveSet } from '../lib/store';
import { advance, answerOf, newRound, normalize, promptOf } from '../lib/learn';
import { MasteryBar } from './MasteryBar.jsx';
import Speak from './Speak.jsx';
import { chineseVoices, getVoicePref, loadVoices, setVoicePref, speak, stop, supported as ttsSupported } from '../lib/speech';
import * as sfx from '../lib/sfx';
import { confetti } from '../lib/confetti';
import { addXp } from '../lib/stats';
import { Flame } from './Flame.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { actionFor, keyLabel, usePrefs } from '../lib/prefs';

/* ---------- game tuning ---------- */
const XP_BASE = 10;
const XP_COMBO_BONUS = 5;          // extra per answer once the combo reaches 5
const isMilestone = n => n === 5 || (n >= 10 && n % 10 === 0);
const CHEERS = {
  5: ['Five in a row!', 'Nice rhythm.'],
  10: ['Ten in a row!', 'You’re on fire.'],
  20: ['Twenty straight!', 'Unstoppable.'],
  30: ['Thirty!', 'Your memory is showing off.'],
};
const cheer = n => CHEERS[n] || [`${n} in a row!`, 'Legendary run.'];

export default function Learn({ set: initial, uid, go, toast }) {
  // The session works on its own copy of the set and writes progress back after every answer.
  const [set, setSet] = useState(() => structuredClone(initial));
  const [opts, setOptsState] = useState(() => ({ answerWith: 'def', written: true, autoplay: true, rate: 0.9, sound: true, ...local.get('recall.learn', {}) }));
  // Study options chosen on the set page (partial set, shuffle, round size).
  const [cfg] = useState(() => local.get(`recall.session.${initial.id}`, {}));
  const [s, setS] = useState(() => advance(newRound(initial.cards, 0, cfg), initial.cards, opts));
  const [draft, setDraft] = useState('');
  const [zhVoices, setZhVoices] = useState([]);
  const [voicePref, setVoicePrefState] = useState(getVoicePref);
  useEffect(() => { loadVoices().then(() => setZhVoices(chineseVoices())); }, []);

  const prefs = usePrefs();
  const [showSettings, setShowSettings] = useState(false);

  // Game state
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [celebrate, setCelebrate] = useState(null); // { n, title, sub }
  const pendingXp = useRef(0);
  const bestRef = useRef(0);

  const cards = set.cards;
  const card = s.q ? cards.find(k => k.id === s.q.cardId) : null;
  const scope = cfg.ids ? cards.filter(k => cfg.ids.includes(k.id)) : cards;
  const scopeSet = { ...set, cards: scope };
  const c = counts(scopeSet);

  const persist = next => {
    setSet(next);
    saveSet(uid, next).catch(e => toast(`Couldn’t save progress: ${e.message}`));
  };
  const setLevel = (id, level) => {
    const next = { ...set, cards: set.cards.map(k => (k.id === id ? { ...k, s: level } : k)) };
    persist(next);
    return next.cards;
  };

  const next = (state = s, cs = cards) => { setDraft(''); setCelebrate(null); setS(advance(state, cs, opts)); };
  const nextRound = (cs = cards, round = s.round) => { setDraft(''); setCelebrate(null); setS(advance(newRound(cs, round, cfg), cs, opts)); };

  const reward = (newCombo) => {
    const gain = XP_BASE + (newCombo >= 5 ? XP_COMBO_BONUS : 0);
    pendingXp.current += gain;
    bestRef.current = Math.max(bestRef.current, newCombo);
    setBestCombo(bestRef.current);
    if (opts.sound) sfx.correct(newCombo);
    sfx.buzz(12);
    if (isMilestone(newCombo)) {
      const [title, sub] = cheer(newCombo);
      setTimeout(() => {
        if (opts.sound) sfx.milestone();
        confetti({ count: newCombo >= 10 ? 180 : 110 });
        setCelebrate({ n: newCombo, title, sub });
      }, 180);
    }
    return gain;
  };

  const grade = (correct, given) => {
    const level = correct ? Math.min(2, s.q.prevS + 1) : 0;
    setLevel(s.q.cardId, level);
    const comboBefore = combo;
    let gain = 0;
    if (correct) {
      const n = combo + 1;
      setCombo(n);
      gain = reward(n);
    } else {
      setCombo(0);
      if (opts.sound) sfx.wrong();
      sfx.buzz([30, 40, 30]);
    }
    setS({
      ...s, phase: 'fb',
      q: { ...s.q, correct, given, gain, comboBefore, combo: correct ? combo + 1 : 0 },
      log: [...s.log, { id: s.q.cardId, correct, gain }],
    });
  };

  const override = () => {
    const cs = setLevel(s.q.cardId, Math.min(2, s.q.prevS + 1));
    const n = (s.q.comboBefore || 0) + 1;
    setCombo(n);
    const gain = reward(n);
    const log = s.log.map((x, i) => (i === s.log.length - 1 ? { ...x, correct: true, gain } : x));
    next({ ...s, log }, cs);
  };

  const setOpts = patch => {
    const o = { ...opts, ...patch };
    setOptsState(o);
    local.set('recall.learn', o);
    // Re-ask the current question in the new format.
    if (s.phase === 'q' && ('answerWith' in patch || 'written' in patch)) setS(advance({ ...s, queue: [s.q.cardId, ...s.queue] }, cards, o));
  };

  /* Save XP once per round (and when leaving mid-round). */
  const flush = async (celebrateGoal = true) => {
    const xp = pendingXp.current;
    pendingXp.current = 0;
    if (!xp && !bestRef.current) return;
    try {
      const r = await addXp(uid, xp, bestRef.current);
      if (r?.reachedGoal && celebrateGoal) {
        if (opts.sound) sfx.fanfare();
        confetti({ count: 220, spread: 1.4 });
        setCelebrate({ n: r.streak, title: 'Daily goal reached!', sub: r.streak > 1 ? `${r.streak}-day streak — keep it alive tomorrow.` : 'Day 1 of your streak. Come back tomorrow.', streak: true });
      }
    } catch { /* stats are a bonus; never block studying */ }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { stop(); flushRef.current(false); }, []);

  useEffect(() => {
    if (s.phase !== 'summary' && s.phase !== 'done') return;
    const perfect = s.log.length > 0 && s.log.every(x => x.correct);
    if (s.phase === 'summary') {
      if (opts.sound) sfx.fanfare();
      if (perfect) confetti({ count: 160 });
    }
    flush();
  }, [s.phase, s.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Celebrations outside a question (e.g. daily goal on the summary) fade on their own.
  useEffect(() => {
    if (!celebrate || s.phase === 'fb') return;
    const t = setTimeout(() => setCelebrate(null), 3500);
    return () => clearTimeout(t);
  }, [celebrate, s.phase]);

  // Read the prompt aloud when a new question appears.
  useEffect(() => {
    if (s.phase === 'q' && card && opts.autoplay) speak(promptOf(card, opts.answerWith), { rate: opts.rate });
  }, [s.q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance after a correct answer (a little longer when celebrating).
  useEffect(() => {
    if (s.phase !== 'fb' || !s.q.correct) return;
    const t = setTimeout(() => next(), celebrate ? 2000 : 900);
    return () => clearTimeout(t);
  }, [s, celebrate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts (customizable in Study settings).
  const live = useRef();
  live.current = { s, card, grade, next, opts, nextRound, showSettings };
  useEffect(() => {
    const onKey = e => {
      const { s, card, grade, next, opts, nextRound, showSettings } = live.current;
      if (showSettings) return;
      if (e.target.matches('input, textarea, select')) return;
      // Leave browser/OS shortcuts alone (Cmd+1 tab switching, Ctrl+S, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = actionFor(e.key);
      if (!action) return;
      const inQuestion = s.phase === 'q' || s.phase === 'fb';

      if (action === 'listen' && card && inQuestion) {
        e.preventDefault(); speak(promptOf(card, opts.answerWith), { rate: opts.rate }); return;
      }
      if (s.phase === 'q' && s.q.type === 'mc') {
        const idx = ['opt1', 'opt2', 'opt3', 'opt4'].indexOf(action);
        if (idx >= 0 && s.q.options[idx] !== undefined) {
          e.preventDefault();
          const o = s.q.options[idx];
          grade(normalize(o) === normalize(answerOf(card, opts.answerWith)), o);
          return;
        }
        if (action === 'dontKnow') { e.preventDefault(); grade(false, ''); return; }
      }
      if (action === 'next') {
        if (s.phase === 'fb') { e.preventDefault(); next(); }
        else if (s.phase === 'summary') { e.preventDefault(); nextRound(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const status = s.phase === 'done'
    ? 'Complete'
    : `Round ${s.round}${s.phase === 'summary' ? ' · done' : ` · ${Math.min(s.log.length + (s.phase === 'fb' ? 0 : 1), s.total)} of ${s.total}`}`;

  const settings = (
    <div className="opts-panel">
      <button type="button" className="btn small" onClick={() => setShowSettings(true)}>⚙ Keys & volume</button>
      <label>Answer with{' '}
        <select value={opts.answerWith} onChange={e => setOpts({ answerWith: e.target.value })}>
          <option value="def">Definition</option>
          <option value="term">Term</option>
        </select>
      </label>
      <label className="switch">
        <input type="checkbox" checked={opts.written} onChange={e => setOpts({ written: e.target.checked })} /> Written questions
      </label>
      <label className="switch">
        <input type="checkbox" checked={opts.sound} onChange={e => setOpts({ sound: e.target.checked })} /> Sound effects
      </label>
      {ttsSupported && (
        <>
          <label className="switch">
            <input type="checkbox" checked={opts.autoplay} onChange={e => setOpts({ autoplay: e.target.checked })} /> Auto-play audio
          </label>
          {zhVoices.length > 1 && (
            <label>Voice{' '}
              <select value={voicePref || zhVoices[0].name} onChange={e => {
                setVoicePref(e.target.value); setVoicePrefState(e.target.value);
                if (card) speak(promptOf(card, opts.answerWith), { rate: opts.rate, voice: e.target.value });
              }}>
                {zhVoices.map(v => <option key={v.voiceURI} value={v.name}>{v.name}</option>)}
              </select>
            </label>
          )}
          <label>Speed{' '}
            <select value={opts.rate} onChange={e => setOpts({ rate: +e.target.value })}>
              <option value={0.6}>0.6×</option>
              <option value={0.75}>0.75×</option>
              <option value={0.9}>0.9×</option>
              <option value={1}>1×</option>
              <option value={1.2}>1.2×</option>
            </select>
          </label>
        </>
      )}
    </div>
  );

  const roundXp = s.log.reduce((n, x) => n + (x.gain || 0), 0);
  const roundRight = s.log.filter(x => x.correct).length;

  return (
    <>
      <button className="crumb" type="button" onClick={() => go('set', set.id)}>← {set.title || 'Untitled set'}</button>
      <div className="lhead">
        <span className="lmeta">{status}</span>
        <span className="lhead-right">
          {combo >= 2 && (
            <span className={`combo ${combo >= 10 ? 'hot' : combo >= 5 ? 'warm' : ''}`} key={combo}>
              <Flame size={14} /> {combo} in a row
            </span>
          )}
          <span className="lmeta">{c[2]}/{scope.length} mastered{cfg.ids ? ` · ${scope.length} of ${cards.length} cards` : ''}{cfg.shuffle ? ' · shuffled' : ''}</span>
        </span>
      </div>
      <MasteryBar set={scopeSet} />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} sample={card ? promptOf(card, opts.answerWith) : '你好'} />}

      {celebrate && (
        <button type="button" className="celebrate" onClick={() => setCelebrate(null)} aria-live="polite">
          <span className="celebrate-card">
            {celebrate.streak ? <span className="celebrate-flame"><Flame size={56} /></span> : <span className="celebrate-n">{celebrate.n}</span>}
            <span className="celebrate-title">{celebrate.title}</span>
            <span className="celebrate-sub">{celebrate.sub}</span>
          </span>
        </button>
      )}

      {s.phase === 'done' && (
        <div className="qcard stack">
          <div className="big-num">{scope.length}/{scope.length}</div>
          <h2>{cfg.ids ? 'Every card in this selection is mastered.' : 'Every card in this set is mastered.'}</h2>
          <p className="lede" style={{ margin: 0 }}>Come back tomorrow and run it again — recall that survives a night’s sleep is the kind that sticks.</p>
          <div className="row">
            <button className="btn primary" type="button" onClick={() => {
              const inScope = new Set(scope.map(k => k.id));
              const reset = { ...set, cards: set.cards.map(k => (inScope.has(k.id) ? { ...k, s: 0 } : k)) };
              persist(reset);
              nextRound(reset.cards, 0);
            }}>Start over</button>
            <button className="btn" type="button" onClick={() => go('set', set.id)}>Back to set</button>
          </div>
        </div>
      )}

      {s.phase === 'summary' && (
        <>
          <div className="qcard summary-card">
            <div className="row between">
              <div>
                <h2>{roundRight === s.log.length ? 'Perfect round!' : `Round ${s.round} done`}</h2>
                <p className="lede">{c[2]} of {scope.length} cards mastered</p>
              </div>
              <button className="btn primary big" type="button" autoFocus onClick={() => nextRound()}>Continue</button>
            </div>
            <div className="tiles">
              <div className="tile xp"><span className="tile-n"><CountUp to={roundXp} /></span><span className="tile-l">XP earned</span></div>
              <div className="tile"><span className="tile-n">{s.log.length ? Math.round((roundRight / s.log.length) * 100) : 0}%</span><span className="tile-l">Accuracy</span></div>
              <div className="tile"><span className="tile-n"><Flame size={18} /> {bestCombo}</span><span className="tile-l">Best combo</span></div>
            </div>
            <div className="sum">
              {s.log.map((x, i) => {
                const k = cards.find(k => k.id === x.id);
                return k && (
                  <div key={i}>
                    <i style={{ color: x.correct ? 'var(--good)' : 'var(--bad)' }}>{x.correct ? '✓' : '✗'}</i>
                    <b className="with-speak">{k.term}<Speak text={k.term} rate={opts.rate} size="sm" /></b><span>{k.def}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="lfoot">{settings}<span className="hint">Press <kbd>{keyLabel(prefs.keys.next)}</kbd> to continue</span></div>
        </>
      )}

      {(s.phase === 'q' || s.phase === 'fb') && card && (
        <Question
          key={`${s.round}-${s.log.length}-${card.id}-${s.q.type}`}
          q={s.q} card={card} opts={opts} fb={s.phase === 'fb'}
          draft={draft} setDraft={setDraft}
          grade={grade} next={() => next()} override={override}
          settings={settings} keys={prefs.keys}
        />
      )}
    </>
  );
}

function CountUp({ to, ms = 700 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    const start = performance.now();
    let raf;
    const tick = t => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>+{n}</>;
}

const PRAISE = ['Correct!', 'Nice!', 'Great!', 'Nailed it!', 'Exactly!'];

function Question({ q, card, opts, fb, draft, setDraft, grade, next, override, settings, keys }) {
  const right = answerOf(card, opts.answerWith);
  const [praise] = useState(() => PRAISE[(Math.random() * PRAISE.length) | 0]);
  const submit = e => {
    e.preventDefault();
    const v = draft.trim();
    if (v) grade(normalize(v) === normalize(right), v);
  };

  return (
    <>
      <div className={`qcard ${fb ? (q.correct ? 'hit' : 'miss') : ''}`}>
        {fb && q.correct && q.gain > 0 && <span className="xp-float">+{q.gain} XP</span>}
        <div className="qlabel">
          <span>{opts.answerWith === 'def' ? 'Term' : 'Definition'}</span>
          <span className="qtag">{q.type === 'mc' ? 'Multiple choice' : 'Written'}</span>
        </div>
        <div className="prompt-row">
          <div className="prompt">{promptOf(card, opts.answerWith) || <em>(blank)</em>}</div>
          <Speak text={promptOf(card, opts.answerWith)} rate={opts.rate} size="lg" />
        </div>

        {q.type === 'mc' && (
          <div className="opts">
            {q.options.map((o, i) => {
              const cls = !fb ? '' : o === right ? 'right' : o === q.given ? 'wrong' : 'dim';
              return (
                <button key={i} type="button" className={`opt ${cls}`} disabled={fb}
                  onClick={() => grade(normalize(o) === normalize(right), o)}>
                  <span className="k">{keyLabel(keys[`opt${i + 1}`] || String(i + 1))}</span><span>{o || <em>(blank)</em>}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'written' && !fb && (
          <form className="wform" onSubmit={submit} autoComplete="off">
            <input className="field" autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={`Type the ${opts.answerWith === 'def' ? 'definition' : 'term'}`} aria-label="Your answer" />
            <div className="row between">
              <button className="btn ghost" type="button" onClick={() => grade(false, '')}>Don’t know</button>
              <button className="btn primary" type="submit">Answer</button>
            </div>
          </form>
        )}

        {fb && q.correct && (
          <div className="fb good">
            <span className="h">{q.type === 'written' ? `${praise} Mastered.` : praise}</span>
          </div>
        )}
        {fb && !q.correct && (
          <>
            <div className="fb bad">
              <span className="h">{q.given ? 'Not quite.' : 'Here’s the answer.'}{q.comboBefore >= 3 ? ` Combo of ${q.comboBefore} ended.` : ''}</span>
              {q.type === 'written' && q.given && <><small>You wrote</small><span className="ans">{q.given}</span></>}
              <small>Correct answer</small>
              <span className="ans ans-row">{right}<Speak text={right} rate={opts.rate} size="sm" /></span>
            </div>
            <div className="row between" style={{ marginTop: 14 }}>
              {q.type === 'written' && q.given ? <button className="btn ghost" type="button" onClick={override}>I was right</button> : <span />}
              <button className="btn primary" type="button" autoFocus onClick={next}>Continue</button>
            </div>
          </>
        )}
      </div>
      <div className="lfoot">
        {settings}
        <span className="hint">
          {q.type === 'mc' && !fb
            ? <><kbd>{keyLabel(keys.opt1)}</kbd><kbd>{keyLabel(keys.opt2)}</kbd><kbd>{keyLabel(keys.opt3)}</kbd><kbd>{keyLabel(keys.opt4)}</kbd> answer · <kbd>{keyLabel(keys.listen)}</kbd> listen · <kbd>{keyLabel(keys.dontKnow)}</kbd> don’t know</>
            : fb ? <><kbd>{keyLabel(keys.next)}</kbd> continue</> : null}
        </span>
      </div>
    </>
  );
}
