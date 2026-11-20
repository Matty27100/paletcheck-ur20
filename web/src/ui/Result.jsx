import { AssistantButton } from './Assistant.jsx';
import { useEffect, useRef, useState } from 'react';
import { STILL_NEEDED, fmt } from '../lib/calc.js';
import { shareResult } from '../lib/share.js';
import { impact } from '../lib/impact.js';

const eur = (n) => `${Math.round(n).toLocaleString('ro-RO')} EUR`;

export default function Result({ answers, assessment, impactOptions, onRequest, onEdit, onImpact, onRestart }) {
  const { verdict, figures } = assessment;
  const [status, setStatus] = useState(null);
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  const imp = impact(answers, { ...impactOptions, cells: answers.cells ?? undefined });
  const cta = verdict.level === 'no' ? 'Discută varianta cu un inginer' : 'Solicită evaluare tehnică';

  return (
    <div className="screen result">
      <p className={`badge badge-${verdict.level}`}>
        {verdict.level === 'ok' ? 'Compatibil' : verdict.level === 'check' ? 'Posibil' : 'În afara domeniului'}
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {verdict.title}
      </h1>
      <p className="reason">{verdict.note}</p>

      <dl className="figures">
        <div>
          <dt>{fmt(figures.minutesPerPallet)}</dt>
          <dd>minute pe palet</dd>
        </div>
        <div>
          <dt>{fmt(figures.palletsPerShift, 0)}</dt>
          <dd>paleți pe schimb</dd>
        </div>
        <div>
          <dt>{fmt(figures.tonnesPerShift, 0)}</dt>
          <dd>tone ridicate manual pe schimb</dd>
        </div>
      </dl>

      <section className="price" aria-label="Investiție estimată">
        <p className="price-label">Investiție estimată</p>
        <p className="price-value">{eur(imp.investment)}</p>
        <p className="price-note">
          {imp.cells === 1 ? 'O celulă UR20 integrată' : `${imp.cells} celule UR20 integrate`}, cu instalare și instruire. Preț
          orientativ; oferta finală vine după evaluarea tehnică.
        </p>
        <dl>
          <div>
            <dt>{eur(imp.perMonthOverHorizon)}</dt>
            <dd>pe lună, împărțit pe {imp.horizonYears} ani</dd>
          </div>
        </dl>
      </section>

      <button type="button" className="impact-link" onClick={onImpact}>
        <b>În cât timp se recuperează?</b>
        <span>Spune-ne câți oameni paletizează și cât costă; îți arătăm timpul și banii economisiți.</span>
      </button>

      <div className="details">
        <details>
          <summary>Ce verificăm la evaluarea tehnică</summary>
          <ul className="plain">
            {STILL_NEEDED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="secondary">
        <button type="button" onClick={onEdit}>
          Modifică datele
        </button>
        <button type="button" onClick={async () => setStatus(await shareResult(answers, verdict.title))}>
          Trimite rezultatul
        </button>
        <button type="button" onClick={onRestart}>
          Reia
        </button>
      </div>
      {status && (
        <p className="toast" role="status">
          {status}
        </p>
      )}
      <p className="fine">
        Calcul orientativ pe baza rezultatelor de test ale aplicației de referință. Nu este o garanție de funcționare.
      </p>

      <div className="cta-bar">
        <div className="cta-row">
        <button type="button" className="primary" onClick={onRequest}>
          {cta}
        </button>
        <AssistantButton />
        </div>
        <p>Gratuit. Îți răspunde un inginer Tech-Con.</p>
      </div>
    </div>
  );
}
