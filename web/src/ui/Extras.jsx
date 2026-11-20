import { useEffect, useRef, useState } from 'react';
import { clearLeads, downloadCsv, loadLeads } from '../lib/store.js';
import { shareResult } from '../lib/share.js';
import { FAQ } from '../lib/faq.js';

function useFocusRef() {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}

export function Sent({ lead, duplicate, answers, title, onLeads, onRestart }) {
  const heading = useFocusRef();
  const [status, setStatus] = useState(null);
  return (
    <div className="screen sent">
      <p className="badge badge-ok">Cerere înregistrată</p>
      <h1 ref={heading} tabIndex={-1}>
        Mulțumim. Un inginer de la centrul Tech-Con {lead.hub} preia cererea.
      </h1>
      <p className="reason">
        Răspuns în cel mult o zi lucrătoare, cu propunerea de evaluare tehnică sau demonstrație. În versiunea finală fișa
        pleacă automat pe {lead.email}; în prototip o descarci mai jos.
      </p>
      {duplicate && (
        <p className="toast" role="status">
          Firma cu acest CUI avea deja o cerere. Am actualizat-o: o firmă se numără o singură dată.
        </p>
      )}
      <dl className="summary">
        <div>
          <dt>Prioritate</dt>
          <dd>{lead.priority}</dd>
        </div>
        <div>
          <dt>Centru</dt>
          <dd>{lead.hub}</dd>
        </div>
        <div>
          <dt>Sursa</dt>
          <dd>{lead.source}</dd>
        </div>
      </dl>
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
      <button type="button" className="link" onClick={onLeads}>
        Vezi cererile salvate (demo CRM)
      </button>
      <button type="button" className="link" onClick={onRestart}>
        Verifică altă linie
      </button>
    </div>
  );
}

export function Leads({ onBack }) {
  const heading = useFocusRef();
  const [leads, setLeads] = useState(loadLeads);
  return (
    <div className="screen leads">
      <div className="progress">
        <button type="button" className="back" onClick={onBack}>
          Înapoi
        </button>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        Cereri salvate
      </h1>
      <p className="reason">
        Ce primește echipa de vânzări. Fișierul CSV se importă în CRM-ul existent. În prototip, datele rămân doar în acest
        browser.
      </p>
      {leads.length === 0 ? (
        <p className="empty">Nicio cerere încă. Completează o verificare și trimite cererea ca să apară aici.</p>
      ) : (
        <ul className="lead-list">
          {leads.map((l) => (
            <li key={l.cui}>
              <span className={`prio prio-${l.priority}`}>{l.priority}</span>
              <div>
                <b>{l.company}</b>
                <span>
                  {l.role}, {l.county} · {l.verdict}
                </span>
                <span>
                  {l.weight} kg, {String(l.rate).replace('.', ',')} găleți/min, {l.shifts} schimburi · sursa {l.source}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="primary" disabled={!leads.length} onClick={() => downloadCsv(leads)}>
        Exportă CSV pentru CRM
      </button>
      <button
        type="button"
        className="link"
        disabled={!leads.length}
        onClick={() => {
          if (window.confirm('Ștergi cererile de test din acest browser?')) {
            clearLeads();
            setLeads([]);
          }
        }}
      >
        Șterge cererile de test
      </button>
    </div>
  );
}

export const EXAMPLES = {
  normal: { weight: 13, rate: 6.5, perPallet: 44, shifts: 2, handle: 'da', separators: true, network: 'PROFINET' },
  wrong: { weight: '1O', rate: '0', perPallet: '', shifts: '2', shiftHours: '8', handle: 'da' },
  outside: { weight: 22, rate: 9.5, perPallet: 36, shifts: 3, handle: 'nu' },
};

export function Examples({ onPick, onLeads, onBack }) {
  const heading = useFocusRef();
  return (
    <div className="screen examples">
      <div className="progress">
        <button type="button" className="back" onClick={onBack}>
          Înapoi
        </button>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        Date de test
      </h1>
      <p className="reason">Trei cazuri pregătite, cu date fictive.</p>
      <div className="options">
        <button type="button" onClick={() => onPick('normal')}>
          Caz normal
          <small>13 kg, 6,5 găleți/min, 44 pe palet, 2 schimburi</small>
        </button>
        <button type="button" onClick={() => onPick('wrong')}>
          Date lipsă sau greșite
          <small>Greutate „1O”, debit 0, palet necompletat</small>
        </button>
        <button type="button" onClick={() => onPick('outside')}>
          În afara domeniului testat
          <small>22 kg, 9,5 găleți/min, fără mâner</small>
        </button>
      </div>
      <p className="fine">
        Pentru formularul de cerere: CUI fictiv valid 12345674, invalid 12345675. E-mail de test: test@fabrica-demo.ro.
      </p>
      <button type="button" className="link" onClick={onLeads}>
        Cereri salvate (demo CRM)
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
