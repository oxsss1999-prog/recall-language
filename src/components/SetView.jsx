import { useLayoutEffect, useRef, useState } from 'react';
import { counts, deleteSet, newCardId, saveSet } from '../lib/store';
import { Legend, MasteryBar } from './MasteryBar.jsx';
import Speak from './Speak.jsx';
import StudyOptions from './StudyOptions.jsx';
import { local } from '../lib/store';

const LEVEL = ['Not studied', 'Learning', 'Mastered'];
const LEVEL_COLOR = ['var(--new)', 'var(--mark)', 'var(--accent)'];

/* Uncontrolled auto-growing textarea: live Firestore updates never steal focus. */
function AutoText({ value, onCommit, className, label, autoFocus }) {
  const ref = useRef();
  const grow = () => { const t = ref.current; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  useLayoutEffect(grow, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      aria-label={label}
      defaultValue={value}
      autoFocus={autoFocus}
      onInput={grow}
      onBlur={e => { const v = e.target.value.trim(); if (v !== value) onCommit(v); }}
    />
  );
}

export default function SetView({ set, uid, go, toast }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const c = counts(set);
  const allMastered = set.cards.length > 0 && c[2] === set.cards.length;

  const save = next => saveSet(uid, next).catch(e => toast(`Couldn’t save: ${e.message}`));
  const updateCard = (id, patch) => save({ ...set, cards: set.cards.map(k => (k.id === id ? { ...k, ...patch } : k)) });

  const learn = cfg => {
    // If everything chosen is already mastered, start that selection fresh.
    const ids = cfg.ids ? new Set(cfg.ids) : null;
    const inScope = k => !ids || ids.has(k.id);
    const chosen = set.cards.filter(inScope);
    if (chosen.length && chosen.every(k => k.s === 2)) {
      save({ ...set, cards: set.cards.map(k => (inScope(k) ? { ...k, s: 0 } : k)) });
    }
    local.set(`recall.session.${set.id}`, cfg);
    go('learn', set.id);
  };

  return (
    <>
      <button className="crumb" type="button" onClick={() => go('library')}>← All sets</button>
      <div className="setHead">
        <input
          key={set.title}
          className="titleInput"
          defaultValue={set.title}
          aria-label="Set title"
          placeholder="Untitled set"
          onBlur={e => { const v = e.target.value.trim(); if (v !== set.title) save({ ...set, title: v }); }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
        />
        <div><MasteryBar set={set} /><Legend set={set} /></div>
        <div className="row">
          <button className="btn primary big" type="button" disabled={!set.cards.length} onClick={() => setChoosing(v => !v)}>
            {allMastered ? 'Learn again' : c[1] + c[2] ? 'Continue learning' : 'Learn'}
          </button>
          <button className="btn" type="button" onClick={() => go('import', set.id)}>Import more</button>
          <button className="btn ghost" type="button" disabled={!(c[1] + c[2])}
            onClick={() => { save({ ...set, cards: set.cards.map(k => ({ ...k, s: 0 })) }); toast('Progress reset.'); }}>
            Reset progress
          </button>
          <button className="btn ghost danger" type="button" onClick={() => setConfirmDelete(true)}>Delete set</button>
        </div>
        {choosing && <StudyOptions set={set} onStart={learn} onCancel={() => setChoosing(false)} />}
        {confirmDelete && (
          <div className="confirm">
            <span>Delete “{set.title || 'Untitled set'}” and its {set.cards.length} cards? This can’t be undone.</span>
            <button className="btn danger" type="button"
              onClick={() => { deleteSet(uid, set.id); go('library'); toast('Set deleted.'); }}>Delete</button>
            <button className="btn ghost" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="colhead"><span /><span>Term</span><span>Definition</span><span /></div>
      <div className="cards">
        {set.cards.map((k, i) => (
          <div className="card" key={k.id}>
            <span className="st" style={{ background: LEVEL_COLOR[k.s || 0] }} title={LEVEL[k.s || 0]} />
            <AutoText className="term" label={`Term ${i + 1}`} value={k.term}
              autoFocus={k.id === focusId} onCommit={v => updateCard(k.id, { term: v })} />
            <AutoText className="def" label={`Definition ${i + 1}`} value={k.def}
              onCommit={v => updateCard(k.id, { def: v })} />
            <div className="card-actions">
            <Speak text={k.term} size="sm" label={`Play term ${i + 1}`} />
            <button className="del" type="button" aria-label={`Delete card ${i + 1}`} title="Delete card"
              onClick={() => save({ ...set, cards: set.cards.filter(x => x.id !== k.id) })}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="btn" type="button" onClick={() => {
          const id = newCardId();
          setFocusId(id);
          save({ ...set, cards: [...set.cards, { id, term: '', def: '', s: 0 }] });
        }}>+ Add card</button>
      </div>
    </>
  );
}
