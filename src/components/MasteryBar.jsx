import { counts } from '../lib/store';

export function MasteryBar({ set }) {
  const c = counts(set);
  const n = set.cards.length || 1;
  return (
    <div className="bar" role="img" aria-label={`${c[2]} mastered, ${c[1]} learning, ${c[0]} not studied`}>
      {c[2] > 0 && <span className="b2" style={{ width: `${(c[2] / n) * 100}%` }} />}
      {c[1] > 0 && <span className="b1" style={{ width: `${(c[1] / n) * 100}%` }} />}
      {c[0] > 0 && <span className="b0" style={{ flex: 1 }} />}
    </div>
  );
}

export function Legend({ set }) {
  const c = counts(set);
  return (
    <div className="legend">
      <span><i className="dot" style={{ background: 'var(--accent)' }} /><b>{c[2]}</b> mastered</span>
      <span><i className="dot" style={{ background: 'var(--mark)' }} /><b>{c[1]}</b> learning</span>
      <span><i className="dot" style={{ background: 'var(--new)' }} /><b>{c[0]}</b> not studied</span>
    </div>
  );
}
