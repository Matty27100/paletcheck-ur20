import { useEffect, useRef } from 'react';
import { fmt, testedRateFor } from '../lib/calc.js';
import { IMPACT_DEFAULTS, impact } from '../lib/impact.js';

const eur = (n) => `${Math.round(n).toLocaleString('ro-RO')} EUR`;
const years = (y) => (y === null ? '–' : y < 1 ? `${fmt(y * 12, 0)} luni` : `${fmt(y)} ani`);

function Stepper({ label, value, step, min, max, unit, onChange }) {
  return (
    <div className="mini-stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`${label}: mai puțin`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <output>
          {value.toLocaleString('ro-RO')} {unit}
        </output>
        <button type="button" aria-label={`${label}: mai mult`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </div>
  );
}

// After the verdict: today's palletizing next to the UR20 cell, then what it costs.
export default function Impact({ answers, options, onOptions, onCells, onBack, onRequest }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const r = impact(answers, { ...options, cells: answers.cells ?? undefined });
  const tested = testedRateFor(answers.weight);

  return (
    <div className="screen impact">
      <div className="progress">
        <button type="button" className="back" onClick={onBack}>
          Înapoi la rezultat
        </button>
      </div>
      <h1 ref={heading} tabIndex={-1}>
        Față de cum lucrați acum
      </h1>

      <fieldset className="field">
        <legend>Câți oameni paletizează acum, pe schimb?</legend>
        <div className="seg">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={options.operatorsBefore === n} onClick={() => onOptions({ operatorsBefore: n })}>
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="versus" role="table" aria-label="Acum comparat cu celula UR20">
        <div role="row" className="versus-head">
          <span role="columnheader" />
          <span role="columnheader">Acum</span>
          <span role="columnheader">Cu UR20</span>
        </div>
        <div role="row">
          <span role="rowheader">Ore de muncă pe schimb la paletizare</span>
          <b role="cell">{fmt(r.hoursBefore)}</b>
          <b role="cell" className="better">
            {fmt(r.hoursAfter)}
          </b>
        </div>
        <div role="row">
          <span role="rowheader">Găleți ridicate de un om pe schimb</span>
          <b role="cell">{fmt(r.liftsPerOperatorBefore, 0)}</b>
          <b role="cell" className="better">
            0
          </b>
        </div>
        <div role="row">
          <span role="rowheader">Tone ridicate de un om pe schimb</span>
          <b role="cell">{fmt(r.tonnesPerOperatorBefore)}</b>
          <b role="cell" className="better">
            0
          </b>
        </div>
      </div>
      <p className="fine">
        Cu robotul, oamenii schimbă paleții și pun separatoarele: estimăm {IMPACT_DEFAULTS.swapMinutesPerPallet} minute pe palet.
      </p>

      <div className="headline-stat">
        <b>{fmt(r.hoursFreedYear, 0)}</b>
        <span>
          ore de muncă eliberate pe an, cât {fmt(r.fteFreed)} {r.fteFreed >= 1 && r.fteFreed < 2 ? 'post' : 'posturi'} cu normă întreagă,
          pe care le puteți muta pe alte activități. Plus {fmt(r.tonnesYear, 0)} de tone pe an care nu mai sunt ridicate manual.
        </span>
      </div>

      <h2>Câte celule UR20</h2>
      <div className="seg">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" aria-pressed={r.cells === n} onClick={() => onCells(n)}>
            {n} {n === 1 ? 'celulă' : 'celule'}
            {n === r.cellsNeeded ? ' · recomandat' : ''}
          </button>
        ))}
      </div>
      <p className={`capacity ${r.capacityMargin < 0 ? 'is-short' : ''}`}>
        {r.cells} × {fmt(tested)} găleți/min testate = {fmt(r.capacity)} găleți/min pentru o linie de {fmt(answers.rate)}.{' '}
        {r.capacityMargin < 0
          ? 'Prea puțin: celulele ar deveni blocajul liniei.'
          : `Rezervă de ${fmt(r.capacityMargin * 100, 0)}% față de linie.`}
      </p>

      <h2>Cât costă și cât recuperați</h2>
      <dl className="money">
        <div className="money-main">
          <dt>Investiție orientativă</dt>
          <dd>{eur(r.investment)}</dd>
          <p>
            {r.cells === 1 ? 'Celula integrată' : `${r.cells} celule integrate`}, cu instalare și instruire. Preț de scenariu; oferta
            finală vine după evaluarea tehnică.
          </p>
        </div>
        <div>
          <dt>Economie estimată pe an</dt>
          <dd className="better">{eur(r.savingYear)}</dd>
        </div>
        <div>
          <dt>Se recuperează în</dt>
          <dd>{years(r.paybackYears)}</dd>
        </div>
        <div>
          <dt>Pe {r.horizonYears} ani, pe lună</dt>
          <dd>{eur(r.perMonthOverHorizon)}</dd>
        </div>
        <div>
          <dt>Pe găleată paletizată</dt>
          <dd>{fmt(r.perBucketOverHorizon * 100)} eurocenți</dd>
        </div>
      </dl>

      <Stepper
        label="Cost total pe operator, pe lună"
        value={options.monthlyCostEur}
        step={100}
        min={800}
        max={4000}
        unit="EUR"
        onChange={(v) => onOptions({ monthlyCostEur: v })}
      />
      <p className="fine">
        Estimare, nu garanție. Implicit: {IMPACT_DEFAULTS.monthlyCostEur.toLocaleString('ro-RO')} EUR pe lună cu taxele angajatorului
        (salariul mediu net din industria alimentară, aprilie 2026, INS: 4.373 lei), {IMPACT_DEFAULTS.workingDays} zile lucrătoare pe an.
        Nu includ energia, mentenanța, finanțarea, înfolierea sau transportul paleților.
      </p>

      <div className="cta-bar">
        <button type="button" className="primary" onClick={onRequest}>
          Solicită evaluare tehnică
        </button>
        <p>Inginerul confirmă cifrele pe linia ta.</p>
      </div>
    </div>
  );
}
