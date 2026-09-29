const unescape = s => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

/**
 * Split pasted text into cards.
 * termSep: 'tab' | 'comma' | 'custom'   cardSep: 'nl' | 'semi' | 'custom'
 * Custom separators accept \n and \t escapes.
 */
export const COLUMN_LAYOUTS = [
  ['td', 'Term · Meaning'],
  ['thd', 'Term · Pinyin · Meaning'],
  ['tdh', 'Term · Meaning · Pinyin'],
];

export function parseCards(text, { termSep, termCustom, cardSep, cardCustom, columns = 'td' }) {
  const tsep = termSep === 'tab' ? '\t' : termSep === 'comma' ? ',' : unescape(termCustom || '');
  const csep = cardSep === 'nl' ? '\n' : cardSep === 'semi' ? ';' : unescape(cardCustom || '');
  if (!tsep || !csep) return [];
  return text
    .replace(/\r\n?/g, '\n')
    .split(csep)
    .map(chunk => {
      if (!chunk.trim()) return null;
      if (columns === 'td') {
        const i = chunk.indexOf(tsep);
        return i < 0
          ? { term: chunk.trim(), def: '', hint: '', bad: true }
          : { term: chunk.slice(0, i).trim(), def: chunk.slice(i + tsep.length).trim(), hint: '' };
      }
      // Three columns. Extra separators stay inside the meaning.
      const p = chunk.split(tsep).map(x => x.trim());
      if (p.length < 3) return { term: p[0] || '', hint: '', def: p[1] || '', bad: true };
      return columns === 'thd'
        ? { term: p[0], hint: p[1], def: p.slice(2).join(tsep === '\t' ? ' ' : tsep).trim() }
        : { term: p[0], def: p.slice(1, -1).join(tsep === '\t' ? ' ' : tsep).trim(), hint: p[p.length - 1] };
    })
    .filter(Boolean);
}
