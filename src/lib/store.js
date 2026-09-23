import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const setsCol = uid => collection(db, 'users', uid, 'sets');

/** Live list of the user's sets: { sets: {id: set}, loading, error } */
export function useSets(uid) {
  const [state, setState] = useState({ sets: {}, loading: true, error: null });
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      setsCol(uid),
      snap => {
        const sets = {};
        snap.docs.forEach(d => { sets[d.id] = { ...d.data(), id: d.id }; });
        setState({ sets, loading: false, error: null });
      },
      error => setState(s => ({ ...s, loading: false, error })),
    );
    return unsub;
  }, [uid]);
  return state;
}

/** Firestore writes are applied locally first, so the UI updates instantly. */
export function saveSet(uid, set) {
  const { id, ...body } = set;
  return setDoc(doc(setsCol(uid), id), { ...body, updated: Date.now() });
}

export function deleteSet(uid, id) {
  return deleteDoc(doc(setsCol(uid), id));
}

export const newId = () => doc(collection(db, '_')).id;
export const newCardId = () => Math.random().toString(36).slice(2, 10);

export const counts = set => {
  const c = [0, 0, 0];
  set.cards.forEach(k => c[k.s || 0]++);
  return c;
};

export const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
