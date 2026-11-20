import { useEffect, useRef, useState } from 'react';
import { shareResult } from '../lib/share.js';
import { FAQ } from '../lib/faq.js';
import { followups } from '../lib/leads.js';

function useFocusRef() {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}

// What the visitor sees about the follow-up: the same schedule the sales team works from.
function visitorSteps(lead) {
  const when = { confirm: 'Acum', call: 'În cel mult o oră', casestudy: 'În 2 zile', next: 'În 5 zile', checkin: 'După 2 săptămâni' };
  const what = {
    confirm: `Am trimis confirmarea cu fișa de pre-evaluare pe ${lead.email}.`,
    call: lead.phone
      ? `Un inginer de la centrul ${lead.hub} te sună 15 minute ca să confirme datele liniei.`
      : `Un inginer de la centrul ${lead.hub} îți propune pe e-mail trei intervale pentru un apel scurt.`,
    casestudy: 'Studiul de caz și video-ul unei celule care paletizează găleți.',
  };
  return followups(lead, Date.now())
    .filter((s) => s.id !== 'checkin')
    .map((s) => ({ id: s.id, when: when[s.id], text: what[s.id] || `${s.title}.` }));
}

export function Sent({ lead, duplicate, answers, title, onRestart }) {
  const heading = useFocusRef();
  const [status, setStatus] = useState(null);
  return (
    <div className="screen sent">
      <p className="badge badge-ok">Cerere înregistrată</p>
      <h1 ref={heading} tabIndex={-1}>
        Mulțumim. Un inginer de la centrul Tech-Con {lead.hub} preia cererea.
      </h1>
      {duplicate && (
        <p className="toast" role="status">
          Firma cu acest CUI avea deja o cerere. Am actualizat-o: o firmă se numără o singură dată.
        </p>
      )}
      <h2>Ce urmează</h2>
      <ol className="timeline">
        {visitorSteps(lead).map((s) => (
          <li key={s.id}>
            <b>{s.when}</b>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="primary" onClick={() => window.print()}>
        Descarcă fișa (PDF)
      </button>
      <button type="button" className="secondary-btn" onClick={async () => setStatus(await shareResult(answers, title))}>
        Trimite fișa celui care aprobă investiția
      </button>
      {status && (
        <p className="toast" role="status">
          {status}
        </p>
      )}
      <button type="button" className="link" onClick={onRestart}>
        Verifică altă linie
      </button>
    </div>
  );
}

export function Faq() {
  return (
    <section className="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Întrebări frecvente</h2>
      {FAQ.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </section>
  );
}
