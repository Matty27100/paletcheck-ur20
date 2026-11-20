import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../lib/calc.js';
import { describeLine, localReply } from '../lib/assistantLocal.js';

// The AI endpoint (Cloudflare Worker in /assistant) is set at build time.
const ENDPOINT = import.meta.env.VITE_ASSISTANT_URL || '';

const SUGGESTIONS = [
  'Ce înseamnă rezultatul meu?',
  'Avem găleți de 10 kg, 400 pe oră, 3 schimburi',
  'Ce rămâne de făcut manual?',
  'Cât durează livrarea?',
];

const fromTool = (input) => {
  const v = {};
  if (input.weight_kg != null) v.weight = input.weight_kg;
  if (input.rate_per_min != null) v.rate = Math.round(input.rate_per_min * 10) / 10;
  if (input.per_pallet != null) v.perPallet = input.per_pallet;
  if (input.shifts != null) v.shifts = input.shifts;
  if (input.handle) v.handle = input.handle;
  return v;
};

// What the assistant may know about the current check: the visitor's own numbers.
function contextText(answers, assessment) {
  const f = assessment.figures;
  return `Datele din verificator: ${describeLine(answers)}. Verdict: ${assessment.verdict.title}. ${assessment.bottleneck.text} Un palet la ${fmt(f.minutesPerPallet)} min, ${fmt(f.tonnesPerShift, 0)} t ridicate manual pe schimb.`;
}

export default function Assistant({ answers, assessment, onApply }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(ENDPOINT ? 'ai' : 'offline');
  const [items, setItems] = useState([]); // what the visitor sees
  const [api, setApi] = useState([]); // the conversation sent to the AI endpoint
  const [pending, setPending] = useState([]); // tool_use ids awaiting a tool_result
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [items, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const offline = (q) => {
    const r = localReply(q, { assessment });
    setItems((x) => [...x, { role: 'bot', text: r.text, proposal: r.proposal }]);
  };

  const send = async (q) => {
    const question = q.trim();
    if (!question || busy) return;
    setText('');
    setItems((x) => [...x, { role: 'me', text: question }]);
    if (mode !== 'ai') return offline(question);

    setBusy(true);
    const results = pending.map((id) => ({ type: 'tool_result', tool_use_id: id, content: 'Valorile au fost propuse vizitatorului.' }));
    const userTurn = {
      role: 'user',
      content: [...results, { type: 'text', text: question }, { type: 'text', text: contextText(answers, assessment) }],
    };
    const next = [...api, userTurn];
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const content = data.content || [];
      const said = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      const tool = content.find((b) => b.type === 'tool_use' && b.name === 'propune_date_linie');
      const proposal = tool ? fromTool(tool.input || {}) : null;
      setApi([...next, { role: 'assistant', content }]);
      setPending(content.filter((b) => b.type === 'tool_use').map((b) => b.id));
      setItems((x) => [
        ...x,
        {
          role: 'bot',
          text:
            data.stop_reason === 'refusal'
              ? 'Nu pot răspunde la această întrebare. Pentru detalii, solicită o evaluare tehnică.'
              : said || (proposal ? `Am înțeles: ${describeLine(proposal)}.` : '…'),
          proposal: proposal && Object.keys(proposal).length ? proposal : null,
        },
      ]);
    } catch {
      setMode('offline');
      setItems((x) => [...x, { role: 'note', text: 'Asistentul AI nu răspunde acum; continui cu răspunsuri din fișa tehnică.' }]);
      offline(question);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Întreabă asistentul
      </button>
      {open &&
        createPortal(
        <div className="assistant-backdrop" onClick={() => setOpen(false)}>
          <section
            className="assistant"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="assistant-title">Asistent</h2>
                <p>{mode === 'ai' ? 'Răspunsuri generate de AI (Claude). Verifică cifrele la evaluarea tehnică.' : 'Mod offline: răspunsuri din fișa tehnică, fără AI.'}</p>
              </div>
              <button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Închide asistentul">
                ×
              </button>
            </header>

            <div className="assistant-list" ref={list} aria-live="polite">
              {items.length === 0 && (
                <div className="assistant-empty">
                  <p>Întreabă despre celula UR20 sau descrie-ți linia în cuvintele tale; completez eu verificarea.</p>
                  <div className="chips">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {items.map((m, i) => (
                <div key={i} className={`msg msg-${m.role}`}>
                  <p>{m.text}</p>
                  {m.proposal && (
                    <div className="proposal">
                      <span>{describeLine(m.proposal)}</span>
                      <button
                        type="button"
                        className="chip-btn chip-primary"
                        onClick={() => {
                          onApply(m.proposal);
                          setOpen(false);
                        }}
                      >
                        Aplică în verificare
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="msg msg-bot msg-typing">Scrie…</div>}
            </div>

            <form
              className="assistant-input"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <label className="sr-only" htmlFor="assistant-q">
                Întrebarea ta
              </label>
              <input
                id="assistant-q"
                ref={input}
                value={text}
                maxLength={600}
                autoComplete="off"
                enterKeyHint="send"
                placeholder="Scrie o întrebare"
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="chip-btn chip-primary" disabled={!text.trim() || busy}>
                Trimite
              </button>
            </form>
          </section>
        </div>,
          document.body,
        )}
    </>
  );
}
