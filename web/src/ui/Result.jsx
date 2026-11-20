import { useEffect, useRef, useState } from 'react';
import { FACTS } from '../lib/facts.js';
import { STILL_NEEDED, fmt, testedRateFor } from '../lib/calc.js';
import { shareResult } from '../lib/share.js';
import { impact } from '../lib/impact.js';

const eur = (n) => `${Math.round(n).toLocaleString('ro-RO')} EUR`;
const years = (y) => (y === null ? '–' : y < 1 ? `${fmt(y * 12, 0)} luni` : `${fmt(y)} ani`);

const STATUS_LABEL = { ok: 'confirmat', check: 'de verificat', no: 'în afara domeniului', unknown: 'necunoscut' };

function Bar({ label, value, max, mark, markLabel, unit }) {
  const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="cmp">
      <div className="cmp-head">
        <span>{label}</span>
        <b>
          {fmt(value)} {unit}
        </b>
      </div>
      <div className="cmp-track">
        <span className={`cmp-fill ${value > mark ? 'is-over' : ''}`} style={{ width: pct(value) }} />
        <span className="cmp-mark" style={{ left: pct(mark) }} />
      </div>
      <p className="cmp-note">{markLabel}</p>
    </div>
  );
}

// Inline answers for the criteria the five questions did not cover.
function Followup({ id, answers, onChange }) {
  if (id === 'separators')
    return (
      <div className="chips">
        <span>Separatoare între straturi?</span>
        {[
          [true, 'Da'],
          [false, 'Nu'],
        ].map(([v, l]) => (
          <button key={l} type="button" onClick={() => onChange('separators', v)}>
            {l}
          </button>
        ))}
      </div>
    );
  if (id === 'network')
    return (
      <div className="chips">
        <span>Rețeaua de control a liniei?</span>
        {[...FACTS.robot.nativeNetworks, 'Alta'].map((n) => (
          <button key={n} type="button" onClick={() => onChange('network', n === 'Alta' ? 'alta' : n)}>
            {n}
          </button>
        ))}
      </div>
    );
  return null;
}

export default function Result({ answers, assessment, impactOptions, onChange, onRequest, onEdit, onImpact, onRestart }) {
  const { verdict, figures, criteria, bottleneck } = assessment;
  const [status, setStatus] = useState(null);
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  const tested = testedRateFor(answers.weight);
  const load = answers.weight + FACTS.assumptions.gripperKg;
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

      <p className={`bottleneck ${bottleneck.robotIsLimit ? 'is-limit' : ''}`}>{bottleneck.text}</p>

      <section className="price" aria-label="Investiție estimată">
        <p className="price-label">Investiție estimată</p>
        <p className="price-value">{eur(imp.investment)}</p>
        <p className="price-note">
          {imp.cells === 1 ? 'O celulă UR20 integrată' : `${imp.cells} celule UR20 integrate`}, cu instalare și instruire. Preț
          orientativ; oferta finală vine după evaluarea tehnică.
        </p>
        <dl>
          <div>
            <dt>{years(imp.paybackYears)}</dt>
            <dd>se recuperează din timpul de muncă economisit</dd>
          </div>
          <div>
            <dt>{eur(imp.perMonthOverHorizon)}</dt>
            <dd>pe lună, împărțit pe {imp.horizonYears} ani</dd>
          </div>
        </dl>
      </section>

      <button type="button" className="impact-link" onClick={onImpact}>
        <b>Cât timp și cât economisești față de acum</b>
        <span>Minute de muncă pe palet, ore pe zi, costuri și câte celule îți trebuie</span>
      </button>

      <div className="details">
        <details>
          <summary>
            Criterii verificate
            <span>
              {verdict.confirmed} din {verdict.total} confirmate
            </span>
          </summary>
          <ul className="criteria">
            {criteria.map((c) => (
              <li key={c.id} className={`c-${c.status}`}>
                <span className="dot" aria-label={STATUS_LABEL[c.status]} />
                <div>
                  {c.text}
                  {c.status === 'unknown' && <Followup id={c.id} answers={answers} onChange={onChange} />}
                </div>
              </li>
            ))}
          </ul>
        </details>

        <details>
          <summary>Linia ta față de celula testată</summary>
          <Bar
            label="Debitul liniei"
            value={answers.rate}
            max={Math.max(10, answers.rate * 1.1)}
            mark={tested}
            unit="găleți/min"
            markLabel={`Linia verticală: ritmul testat, ${fmt(tested)}/min la ${answers.weight <= 5 ? '5' : '13'} kg.`}
          />
          <Bar
            label="Sarcina pe robot"
            value={load}
            max={Math.max(26, load * 1.1)}
            mark={FACTS.robot.payloadKg}
            unit="kg"
            markLabel={`Găleata plus ${FACTS.assumptions.gripperKg} kg estimat pentru prindere; linia verticală: ${FACTS.robot.payloadKg} kg.`}
          />
        </details>

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
        <button type="button" className="primary" onClick={onRequest}>
          {cta}
        </button>
        <p>Gratuit. Îți răspunde un inginer Tech-Con.</p>
      </div>
    </div>
  );
}
