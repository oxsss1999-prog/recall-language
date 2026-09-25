import { useState } from 'react';
import { deleteAccountAndData, signOutEverywhere } from '../lib/account';
import { GOALS, setGoal, useStats } from '../lib/stats';

export default function Account({ user, sets, go, toast }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = useStats(user.uid);
  const setCount = Object.keys(sets).length;
  const cardCount = Object.values(sets).reduce((n, s) => n + s.cards.length, 0);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccountAndData();
    } catch (e) {
      setBusy(false);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      toast(`Couldn’t delete your account: ${e.message}`, 6000);
    }
  };

  return (
    <>
      <button className="crumb" type="button" onClick={() => go('library')}>← All sets</button>
      <h1>Account</h1>
      <div className="stack" style={{ marginTop: 22 }}>
        <div className="panel stack">
          <div>
            <span className="lab">Signed in as</span>
            <div>{user.displayName}</div>
            <div className="lede" style={{ margin: 0 }}>{user.email}</div>
          </div>
          <div><span className="lab">Your data</span>{setCount} sets · {cardCount} cards</div>
          <div><button className="btn" type="button" onClick={signOutEverywhere}>Sign out</button></div>
          <p className="hint" style={{ margin: 0 }}>Signing out also removes the offline copy of your sets from this browser.</p>
        </div>

        <div className="panel stack">
          <h2>Daily goal</h2>
          <p className="lede" style={{ margin: 0 }}>Each correct answer is worth 10 XP (15 once you’re on a 5+ combo). Reach your goal each day to grow your streak.</p>
          <div className="chips">
            {GOALS.map(g => (
              <button key={g} type="button" className="chip" aria-pressed={stats.goal === g}
                onClick={() => setGoal(user.uid, g).then(() => toast(`Daily goal set to ${g} XP.`)).catch(e => toast(e.message))}>
                {g} XP · {g <= 20 ? 'Casual' : g <= 50 ? 'Regular' : g <= 100 ? 'Serious' : 'Intense'}
              </button>
            ))}
          </div>
          <p className="hint" style={{ margin: 0 }}>Total XP {stats.xp.toLocaleString()} · best combo {stats.bestCombo}</p>
        </div>

        <div className="panel stack">
          <h2>Delete account</h2>
          <p className="lede" style={{ margin: 0 }}>
            Permanently deletes all {setCount} of your sets, your study progress and your Recall account. This can’t be undone.
            You’ll be asked to confirm with Google once more.
          </p>
          {!confirming ? (
            <div><button className="btn danger" type="button" onClick={() => setConfirming(true)}>Delete my account…</button></div>
          ) : (
            <div className="confirm" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <label htmlFor="delConfirm">Type <b>DELETE</b> to confirm</label>
              <input id="delConfirm" className="field" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
              <div className="row">
                <button className="btn danger" type="button" disabled={typed !== 'DELETE' || busy} onClick={remove}>
                  {busy ? 'Deleting…' : 'Delete everything'}
                </button>
                <button className="btn ghost" type="button" onClick={() => { setConfirming(false); setTyped(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
