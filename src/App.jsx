import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, configured, googleProvider } from './firebase';
import { useSets } from './lib/store';
import { MISSING_ZH_HELP, onMissingVoice } from './lib/speech';
import Library from './components/Library.jsx';
import SetView from './components/SetView.jsx';
import Import from './components/Import.jsx';
import Learn from './components/Learn.jsx';
import Account from './components/Account.jsx';
import Privacy from './components/Privacy.jsx';
import { signOutEverywhere } from './lib/account';

/* Tiny hash router: #/  #/set/:id  #/import  #/import/:id  #/learn/:id */
function useRoute() {
  const read = () => {
    const [, name = '', id = null] = window.location.hash.replace(/^#/, '').split('/');
    return { name: name || 'library', id };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((name, id) => {
    window.location.hash = name === 'library' ? '/' : `/${name}${id ? '/' + id : ''}`;
  }, []);
  return [route, go];
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [route, go] = useRoute();
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef();

  const toast = useCallback((msg, ms = 3200) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

  useEffect(() => onMissingVoice(() => toast(MISSING_ZH_HELP, 12000)), [toast]);
  useEffect(() => (auth ? onAuthStateChanged(auth, u => setUser(u)) : setUser(null)), []);

  if (!configured) return <Shell><SetupNeeded /></Shell>;
  if (user === undefined) return <Shell><p className="lede">Loading…</p></Shell>;
  if (route.name === 'privacy') return <Shell user={user} go={go}><Privacy go={go} /></Shell>;
  if (!user) return <Shell go={go}><SignIn toast={toast} />{toastMsg && <div className="toast">{toastMsg}</div>}</Shell>;

  return (
    <Shell user={user} go={go}>
      <Signed user={user} route={route} go={go} toast={toast} />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Shell>
  );
}

function Signed({ user, route, go, toast }) {
  const uid = user.uid;
  const { sets, loading, error } = useSets(uid);
  if (error) return <p className="lede">Couldn’t load your sets: {error.message}</p>;
  if (loading) return <p className="lede">Loading your sets…</p>;

  const set = route.id ? sets[route.id] : null;
  const props = { uid, go, toast };

  switch (route.name) {
    case 'set':
      return set ? <SetView key={set.id} set={set} {...props} /> : <Library sets={sets} {...props} />;
    case 'import':
      return <Import key={route.id || 'new'} target={set} {...props} />;
    case 'account':
      return <Account user={user} sets={sets} go={go} toast={toast} />;
    case 'learn':
      return set ? <Learn key={set.id} set={set} {...props} /> : <Library sets={sets} {...props} />;
    default:
      return <Library sets={sets} {...props} />;
  }
}

function Shell({ user, go, children }) {
  return (
    <div className="wrap">
      <header className="top">
        <button className="brand" type="button" onClick={() => go?.('library')}>
          <i aria-hidden="true" />Recall
        </button>
        {user && (
          <div className="row">
            <button className="store linkish" type="button" onClick={() => go('account')}>{user.displayName || user.email}</button>
            <button className="btn ghost small" type="button" onClick={signOutEverywhere}>Sign out</button>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="foot">
        <button type="button" className="linkish" onClick={() => go?.('privacy')}>개인정보처리방침 · Privacy</button>
        {user && <button type="button" className="linkish" onClick={() => go?.('account')}>Account</button>}
      </footer>
    </div>
  );
}

function SignIn({ toast }) {
  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        toast(e.code === 'auth/unauthorized-domain'
          ? 'This domain isn’t allowed yet. Add it under Firebase → Authentication → Settings → Authorized domains.'
          : `Sign-in failed: ${e.message}`);
      }
    }
  };
  return (
    <div className="hero">
      <h1>Paste your terms. Learn them until they stick.</h1>
      <p className="lede">Build study sets from Excel or Sheets in seconds, then drill them in rounds — multiple choice first, then written recall — until every card is mastered. Your sets sync across all your devices.</p>
      <div><button className="btn primary big" type="button" onClick={signIn}>Sign in with Google</button></div>
      <p className="hint" style={{ margin: 0 }}>By signing in you agree to our <button type="button" className="linkish inline" onClick={() => window.location.hash = '/privacy'}>privacy policy</button>. We only store your name, email and the sets you create.</p>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="panel stack">
      <h2>Firebase isn’t configured yet</h2>
      <p className="lede" style={{ margin: 0 }}>
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Firebase web-app config, and restart <code>npm run dev</code>.
        On Vercel, add the same values under Project → Settings → Environment Variables and redeploy.
      </p>
    </div>
  );
}
