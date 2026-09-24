import { useEffect, useRef, useState } from 'react';
import { counts, local, saveSet } from '../lib/store';
import { advance, answerOf, newRound, normalize, promptOf } from '../lib/learn';
import { MasteryBar } from './MasteryBar.jsx';
import Speak from './Speak.jsx';
import { chineseVoices, getVoicePref, loadVoices, setVoicePref, speak, stop, supported as ttsSupported } from '../lib/speech';

export default function Learn({ set: initial, uid, go, toast }) {
  // The session works on its own copy of the set and writes progress back after every answer.
  const [set, setSet] = useState(() => structuredClone(initial));
  const [opts, setOptsState] = useState(() => ({ answerWith: 'def', written: true, autoplay: true, rate: 0.9, ...local.get('recall.learn', {}) }));
  const [s, setS] = useState(() => advance(newRound(initial.cards, 0), initial.cards, opts));
  const [draft, setDraft] = useState('');
  const [zhVoices, setZhVoices] = useState([]);
  const [voicePref, setVoicePrefState] = useState(getVoicePref);
  useEffect(() => { loadVoices().then(() => setZhVoices(chineseVoices())); }, []);

  const cards = set.cards;
  const card = s.q ? cards.find(k => k.id === s.q.cardId) : null;
  const c = counts(set);

  const persist = next => {
    setSet(next);
    saveSet(uid, next).catch(e => toast(`Couldn’t save progress: ${e.message}`));
  };
  const setLevel = (id, level) => {
    const next = { ...set, cards: set.cards.map(k => (k.id === id ? { ...k, s: level } : k)) };
    persist(next);
    return next.cards;
  };

  const next = (state = s, cs = cards) => { setDraft(''); setS(advance(state, cs, opts)); };
  const nextRound = (cs = cards, round = s.round) => { setDraft(''); setS(advance(newRound(cs, round), cs, opts)); };

  const grade = (correct, given) => {
    const level = correct ? Math.min(2, s.q.prevS + 1) : 0;
    setLevel(s.q.cardId, level);
    setS({ ...s, phase: 'fb', q: { ...s.q, correct, given }, log: [...s.log, { id: s.q.cardId, correct }] });
  };

  const override = () => {
    const cs = setLevel(s.q.cardId, Math.min(2, s.q.prevS + 1));
    const log = s.log.map((x, i) => (i === s.log.length - 1 ? { ...x, correct: true } : x));
    next({ ...s, log }, cs);
  };

  const setOpts = patch => {
    const o = { ...opts, ...patch };
    setOptsState(o);
    local.set('recall.learn', o);
    // Re-ask the current question in the new format.
    if (s.phase === 'q' && ('answerWith' in patch || 'written' in patch)) setS(advance({ ...s, queue: [s.q.cardId, ...s.queue] }, cards, o));
  };

  // Read the prompt aloud when a new question appears.
  useEffect(() => {
    if (s.phase === 'q' && card && opts.autoplay) speak(promptOf(card, opts.answerWith), { rate: opts.rate });
  }, [s.q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => stop, []);

  // Auto-advance after a correct answer.
  useEffect(() => {
    if (s.phase !== 'fb' || !s.q.correct) return;
    const t = setTimeout(() => next(), 900);
    return () => clearTimeout(t);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: 1–4 picks an option, Enter/Space skips the correct-answer pause.
  const live = useRef();
  live.current = { s, card, grade, next, opts };
  useEffect(() => {
    const onKey = e => {
      const { s, card, grade, next } = live.current;
      if (e.target.matches('input, textarea, select')) return;
      if ((e.key === 's' || e.key === 'S') && card && (s.phase === 'q' || s.phase === 'fb')) {
        e.preventDefault(); speak(promptOf(card, live.current.opts.answerWith), { rate: live.current.opts.rate }); return;
      }
      if (s.phase === 'q' && s.q.type === 'mc' && /^[1-4]$/.test(e.key)) {
        const o = s.q.options[+e.key - 1];
        if (o !== undefined) { e.preventDefault(); grade(normalize(o) === normalize(answerOf(card, opts.answerWith)), o); }
      } else if (s.phase === 'fb' && s.q.correct && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts.answerWith]);

  const status = s.phase === 'done'
    ? 'Complete'
    : `Round ${s.round}${s.phase === 'summary' ? ' · done' : ` · ${Math.min(s.log.length + (s.phase === 'fb' ? 0 : 1), s.total)} of ${s.total}`}`;

  const settings = (
    <div className="opts-panel">
      <label>Answer with{' '}
        <select value={opts.answerWith} onChange={e => setOpts({ answerWith: e.target.value })}>
          <option value="def">Definition</option>
          <option value="term">Term</option>
        </select>
      </label>
      <label className="switch">
        <input type="checkbox" checked={opts.written} onChange={e => setOpts({ written: e.target.checked })} /> Written questions
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

  return (
    <>
      <button className="crumb" type="button" onClick={() => go('set', set.id)}>← {set.title || 'Untitled set'}</button>
      <div className="lhead">
        <span className="lmeta">{status}</span>
        <span className="lmeta">{c[2]}/{cards.length} mastered</span>
      </div>
      <MasteryBar set={set} />

      {s.phase === 'done' && (
        <div className="qcard stack">
          <div className="big-num">{cards.length}/{cards.length}</div>
          <h2>Every card in this set is mastered.</h2>
          <p className="lede" style={{ margin: 0 }}>Come back tomorrow and run it again — recall that survives a night’s sleep is the kind that sticks.</p>
          <div className="row">
            <button className="btn primary" type="button" onClick={() => {
              const reset = { ...set, cards: set.cards.map(k => ({ ...k, s: 0 })) };
              persist(reset);
              nextRound(reset.cards, 0);
            }}>Start over</button>
            <button className="btn" type="button" onClick={() => go('set', set.id)}>Back to set</button>
          </div>
        </div>
      )}

      {s.phase === 'summary' && (
        <>
          <div className="qcard">
            <div className="row between">
              <div>
                <h2>Round {s.round} done</h2>
                <p className="lede">
                  {s.log.filter(x => x.correct).length} of {s.log.length} answered correctly · {c[2]} of {cards.length} cards mastered
                </p>
              </div>
              <button className="btn primary big" type="button" autoFocus onClick={() => nextRound()}>Continue</button>
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
          <div className="lfoot">{settings}<span className="hint">Press <kbd>Enter</kbd> to continue</span></div>
        </>
      )}

      {(s.phase === 'q' || s.phase === 'fb') && card && (
        <Question
          key={`${s.round}-${s.log.length}-${card.id}-${s.q.type}`}
          q={s.q} card={card} opts={opts} fb={s.phase === 'fb'}
          draft={draft} setDraft={setDraft}
          grade={grade} next={() => next()} override={override}
          settings={settings}
        />
      )}
    </>
  );
}

function Question({ q, card, opts, fb, draft, setDraft, grade, next, override, settings }) {
  const right = answerOf(card, opts.answerWith);
  const submit = e => {
    e.preventDefault();
    const v = draft.trim();
    if (v) grade(normalize(v) === normalize(right), v);
  };

  return (
    <>
      <div className="qcard">
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
                  <span className="k">{i + 1}</span><span>{o || <em>(blank)</em>}</span>
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
          <div className="fb good"><span className="h">{q.type === 'written' ? 'Correct — mastered.' : 'Correct.'}</span></div>
        )}
        {fb && !q.correct && (
          <>
            <div className="fb bad">
              <span className="h">{q.given ? 'Not quite.' : 'Here’s the answer.'}</span>
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
          {q.type === 'mc' && !fb ? <>Keys <kbd>1</kbd>–<kbd>4</kbd> to answer · <kbd>S</kbd> to listen</> : fb && !q.correct ? <><kbd>Enter</kbd> to continue</> : null}
        </span>
      </div>
    </>
  );
}
