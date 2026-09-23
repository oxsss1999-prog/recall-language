import { counts } from '../lib/store';
import { MasteryBar } from './MasteryBar.jsx';

export default function Library({ sets, go }) {
  const list = Object.values(sets).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return (
    <>
      <div className="row between">
        <div>
          <h1>Your sets</h1>
          <p className="lede">
            {list.length
              ? `${list.length} set${list.length > 1 ? 's' : ''} · pick one to study`
              : 'Paste a list of terms to make your first set.'}
          </p>
        </div>
        <button className="btn primary" type="button" onClick={() => go('import')}>New set</button>
      </div>

      {list.length ? (
        <div className="sets">
          {list.map(s => (
            <button key={s.id} className="setrow" type="button" onClick={() => go('set', s.id)}>
              <span className="t">{s.title || 'Untitled set'}</span>
              <span className="meta">{counts(s)[2]}/{s.cards.length} mastered</span>
              <MasteryBar set={s} />
            </button>
          ))}
        </div>
      ) : (
        <div className="panel empty stack">
          <h2>No sets yet</h2>
          <p className="lede" style={{ margin: 0 }}>
            Copy two columns from Excel, Google Sheets or Word and paste them in. Each line becomes a card.
          </p>
          <div><button className="btn primary" type="button" onClick={() => go('import')}>Import terms</button></div>
        </div>
      )}
    </>
  );
}
