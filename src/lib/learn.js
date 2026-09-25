/*
 * Learn mode, Quizlet-style.
 * Each card has a level s: 0 = not studied, 1 = learning, 2 = mastered.
 *  - level 0 → multiple choice; correct moves it to 1
 *  - level 1 → written (or multiple choice if written is off); correct moves it to 2
 *  - any wrong answer drops the card back to 0
 * Rounds hold up to ROUND cards, cards already in progress first.
 */
export const ROUND = 7;

export const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const normalize = s =>
  String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,;:!?'"“”‘’()[\]{}·\-–—_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const promptOf = (card, answerWith) => (answerWith === 'def' ? card.term : card.def);
export const answerOf = (card, answerWith) => (answerWith === 'def' ? card.def : card.term);

/**
 * cfg.ids     only these cards (a partial set); null = whole set
 * cfg.shuffle pick cards in random order instead of set order
 * cfg.size    cards per round
 */
export function newRound(cards, prevRound, cfg = {}) {
  const scope = cfg.ids ? cards.filter(k => cfg.ids.includes(k.id)) : cards;
  const pool = scope.filter(k => (k.s || 0) < 2 && (k.term || k.def));
  if (!pool.length) return { phase: 'done', round: prevRound, queue: [], log: [], total: 0, q: null };
  const order = cfg.shuffle ? shuffle : x => x;
  const pick = order(pool.filter(k => k.s === 1)).concat(order(pool.filter(k => !k.s))).slice(0, cfg.size || ROUND);
  return { phase: 'q', round: prevRound + 1, queue: shuffle(pick.map(k => k.id)), log: [], total: pick.length, q: null };
}

export function makeQuestion(card, cards, opts) {
  const type = opts.written && card.s === 1 ? 'written' : 'mc';
  let options = null;
  if (type === 'mc') {
    const right = answerOf(card, opts.answerWith);
    const seen = new Set([normalize(right)]);
    const others = shuffle(cards.filter(k => k.id !== card.id))
      .map(k => answerOf(k, opts.answerWith))
      .filter(a => {
        const n = normalize(a);
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .slice(0, 3);
    options = shuffle([right, ...others]);
  }
  return { cardId: card.id, type, options, prevS: card.s || 0, correct: null, given: null };
}

/** Pull the next question off the queue, or finish the round. */
export function advance(state, cards, opts) {
  const [nextId, ...rest] = state.queue;
  const card = cards.find(k => k.id === nextId);
  if (!card) return { ...state, queue: [], phase: state.phase === 'done' ? 'done' : 'summary', q: null };
  return { ...state, queue: rest, phase: 'q', q: makeQuestion(card, cards, opts) };
}
