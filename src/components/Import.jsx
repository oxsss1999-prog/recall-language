import { useMemo, useState } from 'react';
import { local, newCardId, newId, saveSet } from '../lib/store';
import { parseCards } from '../lib/parse';

const PLACEHOLDER = 'Duration\tSensitivity of a bond’s price to changes in interest rates\nYield curve\tPlot of yields across maturities\n베타\t시장 대비 개별 자산의 체계적 위험';

function Chips({ value, onChange, options, custom, onCustom, label }) {
  return (
    <div className="chips">
      {options.map(([v, text]) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
      {value === 'custom' && (
        <input className="chip-input" aria-label={label} value={custom} onChange={e => onCustom(e.target.value)} />
      )}
    </div>
  );
}

export default function Import({ target, uid, go, toast }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [seps, setSepsState] = useState(() => ({
    termSep: 'tab', termCustom: ' - ', cardSep: 'nl', cardCustom: '\\n\\n', ...local.get('recall.seps', {}),
  }));
  const setSeps = patch => setSepsState(s => { const n = { ...s, ...patch }; local.set('recall.seps', n); return n; });

  const rows = useMemo(() => parseCards(text, seps), [text, seps]);
  const bad = rows.filter(r => r.bad).length;
  const back = () => (target ? go('set', target.id) : go('library'));

  const create = async () => {
    const cards = rows.map(r => ({ id: newCardId(), term: r.term, def: r.def, s: 0 }));
    if (!cards.length) return;
    try {
      if (target) {
        saveSet(uid, { ...target, cards: [...target.cards, ...cards] });
        go('set', target.id);
        toast(`Added ${cards.length} cards.`);
      } else {
        const id = newId();
        saveSet(uid, { id, title: title.trim() || 'Untitled set', cards, created: Date.now() });
        go('set', id);
        toast(`Created a set with ${cards.length} cards.`);
      }
    } catch (e) {
      toast(`Couldn’t save: ${e.message}`);
    }
  };

  const onKeyDown = e => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const t = e.target;
      t.setRangeText('\t', t.selectionStart, t.selectionEnd, 'end');
      setText(t.value);
    }
  };

  return (
    <>
      <button className="crumb" type="button" onClick={back}>← {target ? target.title || 'Untitled set' : 'All sets'}</button>
      <h1>{target ? 'Import more cards' : 'New set'}</h1>
      <p className="lede">
        Paste one card per line with the term and definition separated by a tab — that’s what you get when you copy two columns from Excel or Google Sheets.
      </p>

      <div className="stack" style={{ marginTop: 22 }}>
        {!target && (
          <div>
            <label className="lab" htmlFor="impTitle">Set title</label>
            <input id="impTitle" className="field" placeholder="e.g. 회귀분석 용어, TOEIC Day 12"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        )}
        <div>
          <label className="lab" htmlFor="impText">Your terms</label>
          <textarea id="impText" className="field" spellCheck={false} placeholder={PLACEHOLDER}
            value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} />
          <p className="hint">Tip: <kbd>Tab</kbd> inserts a tab in this box.</p>
        </div>

        <div className="seps">
          <div>
            <span className="lab">Between term and definition</span>
            <Chips value={seps.termSep} onChange={v => setSeps({ termSep: v })}
              options={[['tab', 'Tab'], ['comma', 'Comma'], ['custom', 'Custom']]}
              custom={seps.termCustom} onCustom={v => setSeps({ termCustom: v })} label="Custom term separator" />
          </div>
          <div>
            <span className="lab">Between cards</span>
            <Chips value={seps.cardSep} onChange={v => setSeps({ cardSep: v })}
              options={[['nl', 'New line'], ['semi', 'Semicolon'], ['custom', 'Custom']]}
              custom={seps.cardCustom} onCustom={v => setSeps({ cardCustom: v })} label="Custom card separator" />
            <p className="hint">In custom separators, type <code>\n</code> for a line break.</p>
          </div>
        </div>

        <div className="preview">
          <div className="ph">
            <span>Preview</span>
            <span>
              {rows.length ? <><b>{rows.length}</b> card{rows.length > 1 ? 's' : ''}</> : 'Nothing yet'}
              {bad > 0 && <span style={{ color: 'var(--bad)' }}> · {bad} missing a definition</span>}
            </span>
          </div>
          <div className="pv">
            {rows.length ? (
              <table>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className={r.bad ? 'warn' : ''}>
                      <td className="n">{i + 1}</td>
                      <td>{r.term}</td>
                      <td>{r.bad ? 'No separator found on this line' : r.def}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint" style={{ padding: 14 }}>Cards will appear here as you paste.</p>
            )}
            {rows.length > 200 && <p className="hint" style={{ padding: '8px 14px' }}>…and {rows.length - 200} more</p>}
          </div>
        </div>

        <div className="row">
          <button className="btn primary big" type="button" disabled={!rows.length} onClick={create}>
            {target ? 'Add cards' : 'Create set'}
          </button>
          <button className="btn ghost" type="button" onClick={back}>Cancel</button>
        </div>
      </div>
    </>
  );
}
