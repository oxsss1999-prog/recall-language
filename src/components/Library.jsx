import { counts } from '../lib/store';
import { MasteryBar } from './MasteryBar.jsx';
import { useStats } from '../lib/stats';
import { Flame } from './Flame.jsx';

export default function Library({ sets, go, uid }) {
  const stats = useStats(uid);
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

      <StatsStrip stats={stats} go={go} />

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

function StatsStrip({ stats, go }) {
  const pct = Math.min(100, Math.round((stats.todayXp / stats.goal) * 100));
  return (
    <div className="stats">
      <div className={`stat streak ${stats.streak ? 'on' : ''}`}>
        <Flame size={26} />
        <div><b>{stats.streak}</b><span>day streak</span></div>
      </div>
      <div className="stat goal">
        <div className="goal-top">
          <span>Today</span>
          <span><b>{stats.todayXp}</b> / {stats.goal} XP{stats.doneToday ? ' · goal done' : ''}</span>
        </div>
        <div className="goal-bar"><span style={{ width: `${pct}%` }} /></div>
        <button type="button" className="linkish hint" onClick={() => go('account')}>Change daily goal</button>
      </div>
      <div className="stat total">
        <div><b>{stats.xp.toLocaleString()}</b><span>total XP</span></div>
      </div>
    </div>
  );
}
