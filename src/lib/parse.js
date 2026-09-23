const unescape = s => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

/**
 * Split pasted text into cards.
 * termSep: 'tab' | 'comma' | 'custom'   cardSep: 'nl' | 'semi' | 'custom'
 * Custom separators accept \n and \t escapes.
 */
export function parseCards(text, { termSep, termCustom, cardSep, cardCustom }) {
  const tsep = termSep === 'tab' ? '\t' : termSep === 'comma' ? ',' : unescape(termCustom || '');
  const csep = cardSep === 'nl' ? '\n' : cardSep === 'semi' ? ';' : unescape(cardCustom || '');
  if (!tsep || !csep) return [];
  return text
    .replace(/\r\n?/g, '\n')
    .split(csep)
    .map(chunk => {
      if (!chunk.trim()) return null;
      const i = chunk.indexOf(tsep);
      return i < 0
        ? { term: chunk.trim(), def: '', bad: true }
        : { term: chunk.slice(0, i).trim(), def: chunk.slice(i + tsep.length).trim() };
    })
    .filter(Boolean);
}
