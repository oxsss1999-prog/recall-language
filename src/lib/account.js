import { deleteUser, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, collection, deleteDoc, doc, getDocs, terminate } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

/*
 * The app keeps an offline copy of your sets in the browser (IndexedDB) so it
 * works without a connection. On a shared computer that copy must not outlive
 * the session, so sign-out wipes it.
 */
async function clearLocalCache() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch { /* another tab may still hold it; the reload below resets anyway */ }
  try {
    localStorage.removeItem('recall.learn');
    localStorage.removeItem('recall.seps');
    localStorage.removeItem('recall.zhVoice');
  } catch { /* ignore */ }
}

export async function signOutEverywhere() {
  await signOut(auth);
  await clearLocalCache();
  window.location.replace('/');
}

/** Permanently delete all of the user's sets and their account. */
export async function deleteAccountAndData() {
  const user = auth.currentUser;
  if (!user) return;
  // Firebase requires a recent sign-in to delete an account; confirm identity first.
  await reauthenticateWithPopup(user, googleProvider);
  const snap = await getDocs(collection(db, 'users', user.uid, 'sets'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'users', user.uid, 'meta', 'stats'));
  await deleteUser(user);
  await clearLocalCache();
  window.location.replace('/');
}
