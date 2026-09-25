import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/*
 * Per-user game stats, one document: users/{uid}/meta/stats
 *   xp          total XP ever
 *   today       local date (YYYY-MM-DD) that todayXp belongs to
 *   todayXp     XP earned on `today`
 *   goal        daily XP goal
 *   streak      consecutive days the daily goal was reached
 *   lastGoalDay last date the goal was reached
 *   bestCombo   longest run of correct answers ever
 * Written once per round (not per answer) to stay well inside free-tier limits.
 */

export const GOALS = [20, 50, 100, 200];
export const DEFAULT_GOAL = 50;

const statsRef = uid => doc(db, 'users', uid, 'meta', 'stats');

export function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD in the user's own timezone
}

/** What to show right now (a streak lapses if yesterday's goal was missed). */
export function view(d = {}) {
  const today = dayKey(0), yest = dayKey(-1);
  return {
    xp: d.xp || 0,
    goal: d.goal || DEFAULT_GOAL,
    todayXp: d.today === today ? d.todayXp || 0 : 0,
    streak: d.lastGoalDay === today || d.lastGoalDay === yest ? d.streak || 0 : 0,
    doneToday: d.lastGoalDay === today,
    bestCombo: d.bestCombo || 0,
  };
}

export function useStats(uid) {
  const [stats, setStats] = useState(view());
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(statsRef(uid), s => setStats(view(s.data() || {})), () => {});
  }, [uid]);
  return stats;
}

/** Add XP for a finished (or abandoned) round. Returns the new view plus reachedGoal. */
export async function addXp(uid, xp, combo = 0) {
  if (!uid || (!xp && !combo)) return null;
  let d;
  try {
    const snap = await getDoc(statsRef(uid));
    d = snap.exists() ? snap.data() : {};
  } catch {
    return null; // never overwrite stats we couldn't read
  }
  const today = dayKey(0), yest = dayKey(-1);
  const goal = d.goal || DEFAULT_GOAL;
  const todayXp = (d.today === today ? d.todayXp || 0 : 0) + xp;
  let streak = d.streak || 0;
  let lastGoalDay = d.lastGoalDay || '';
  let reachedGoal = false;
  if (lastGoalDay !== today && todayXp >= goal) {
    streak = lastGoalDay === yest ? streak + 1 : 1;
    lastGoalDay = today;
    reachedGoal = true;
  }
  const next = {
    xp: (d.xp || 0) + xp, today, todayXp, goal, streak, lastGoalDay,
    bestCombo: Math.max(d.bestCombo || 0, combo), updated: Date.now(),
  };
  await setDoc(statsRef(uid), next);
  return { ...view(next), reachedGoal };
}

export async function setGoal(uid, goal) {
  const snap = await getDoc(statsRef(uid));
  const d = snap.exists() ? snap.data() : {};
  await setDoc(statsRef(uid), {
    xp: d.xp || 0, today: d.today || dayKey(0), todayXp: d.todayXp || 0, goal,
    streak: d.streak || 0, lastGoalDay: d.lastGoalDay || '', bestCombo: d.bestCombo || 0, updated: Date.now(),
  });
}
