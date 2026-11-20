import { AssistantButton } from './Assistant.jsx';
import { useEffect, useRef, useState } from 'react';
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
  const teamReady = Boolean(options.operatorsBefore && options.monthlyCostEur);
  const [costText, setCostText] = useState(options.monthlyCostEur ? String(options.monthlyCostEur) : '');
  const [costTouched, setCostTouched] = useState(false);
  const costError =
    costTouched && costText && !options.monthlyCostEur ? 'Introduceți o sumă între 500 și 6.000 EUR pe lună.' : null;
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

      <section className="team" aria-labelledby="team-title">
        <h2 id="team-title">Echipa ta de acum</h2>
        <fieldset className="field">
          <legend>Câți oameni paletizează pe un schimb?</legend>
          <div className="seg">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" aria-pressed={options.operatorsBefore === n} onClick={() => onOptions({ operatorsBefore: n })}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="team-cost">Cât costă un om pe lună, cu salariu și taxe?</label>
          <div className="input-unit">
            <input
              id="team-cost"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1.500"
              value={costText}
              aria-invalid={!!costError}
              aria-describedby="team-cost-msg"
              onChange={(e) => {
                setCostText(e.target.value);
                const v = Number(e.target.value.replace(/[.\s]/g, '').replace(',', '.'));
                if (v >= 500 && v <= 6000) onOptions({ monthlyCostEur: v, costIsAverage: false });
                else onOptions({ monthlyCostEur: null, costIsAverage: false });
              }}
              onBlur={() => setCostTouched(true)}
            />
            <span>EUR / lună</span>
          </div>
          <p id="team-cost-msg" className={costError ? 'field-error' : 'field-hint'}>
            {costError || 'Costul total pentru firmă: salariul brut plus contribuțiile angajatorului.'}
          </p>
          <button
            type="button"
            className={`chip-btn ${options.costIsAverage ? 'chip-primary' : ''}`}
            onClick={() => {
              setCostText(String(IMPACT_DEFAULTS.monthlyCostEur));
              setCostTouched(false);
              onOptions({ monthlyCostEur: IMPACT_DEFAULTS.monthlyCostEur, costIsAverage: true });
            }}
          >
            Nu știu: folosește media din industrie ({IMPACT_DEFAULTS.monthlyCostEur.toLocaleString('ro-RO')} EUR)
          </button>
        </div>
        {!teamReady && <p className="team-wait">Răspunde la cele două întrebări ca să vezi timpul și banii economisiți.</p>}
      </section>

      {teamReady && (
        <>
      <h2>Timp</h2>
      <div className="versus" role="table" aria-label="Timp de muncă acum comparat cu celula UR20">
        <div role="row" className="versus-head">
          <span role="columnheader" />
          <span role="columnheader">Acum</span>
          <span role="columnheader">Cu UR20</span>
        </div>
        <div role="row">
          <span role="rowheader">Minute de muncă pentru un palet</span>
          <b role="cell">{fmt(r.personMinPerPalletBefore)}</b>
          <b role="cell" className="better">
            {fmt(r.personMinPerPalletAfter)}
          </b>
        </div>
        <div role="row">
          <span role="rowheader">Ore de muncă pe zi la paletizare</span>
          <b role="cell">{fmt(r.hoursPerDayBefore, 0)}</b>
          <b role="cell" className="better">
            {fmt(r.hoursPerDayAfter)}
          </b>
        </div>
        <div role="row">
          <span role="rowheader">Găleți ridicate de un om pe schimb</span>
          <b role="cell">{fmt(r.liftsPerOperatorBefore, 0)}</b>
          <b role="cell" className="better">
            0
          </b>
        </div>
      </div>
      <p className="fine">
        Cu robotul, oamenii schimbă paleții și pun separatoarele: estimăm {IMPACT_DEFAULTS.swapMinutesPerPallet} minute pe palet.
      </p>

      <div className="headline-stat">
        <b>−{fmt(r.timeCut * 100, 0)}%</b>
        <span>
          timp de muncă pentru fiecare palet. Pe an, {fmt(r.personDaysFreedYear, 0)} de zile-om eliberate, cât {fmt(r.fteFreed)}{' '}
          {r.fteFreed >= 1 && r.fteFreed < 2 ? 'post' : 'posturi'} cu normă întreagă mutate pe alte activități, și{' '}
          {fmt(r.tonnesYear, 0)} de tone care nu mai sunt ridicate manual.
        </span>
      </div>

      <dl className="time-facts">
        <div>
          <dt>{r.capacityMargin >= 0 ? `+${fmt(r.capacityMargin * 100, 0)}%` : 'insuficient'}</dt>
          <dd>{r.capacityMargin >= 0 ? 'cât poate crește ritmul liniei până devine robotul limita' : 'celulele alese nu țin pasul cu linia'}</dd>
        </div>
        <div>
          <dt>≈ {r.deliveryMonths} luni</dt>
          <dd>de la comandă până la celula în funcțiune</dd>
        </div>
      </dl>

        </>
      )}

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

      <h2>Bani</h2>
      <dl className="money">
        <div className="money-main">
          <dt>Investiție orientativă</dt>
          <dd>{eur(r.investment)}</dd>
          <p>
            {r.cells === 1 ? 'Celula integrată' : `${r.cells} celule integrate`}, cu instalare și instruire. Preț orientativ; oferta
            finală vine după evaluarea tehnică.
          </p>
        </div>
        {teamReady ? (
          <>
            <div>
              <dt>Economie estimată pe an</dt>
              <dd className="better">{eur(r.savingYear)}</dd>
            </div>
            <div>
              <dt>Se recuperează în</dt>
              <dd>{years(r.paybackYears)}</dd>
            </div>
          </>
        ) : (
          <p className="money-wait">Economia pe an și timpul de recuperare apar după ce răspunzi despre echipa ta.</p>
        )}
        <div>
          <dt>Pe {r.horizonYears} ani, pe lună</dt>
          <dd>{eur(r.perMonthOverHorizon)}</dd>
        </div>
        <div>
          <dt>Pe găleată paletizată</dt>
          <dd>{fmt(r.perBucketOverHorizon * 100)} eurocenți</dd>
        </div>
      </dl>

      <p className="fine">
        Estimare din datele tale, nu garanție. {options.costIsAverage
          ? `Costul pe om este media din industria alimentară (salariul mediu net, aprilie 2026, INS: 4.373 lei, plus taxe). `
          : ''}
        Calculul folosește {IMPACT_DEFAULTS.workingDays} zile lucrătoare pe an și nu include energia, mentenanța, finanțarea, înfolierea
        sau transportul paleților.
      </p>

      <div className="cta-bar">
        <div className="cta-row">
        <button type="button" className="primary" onClick={onRequest}>
          Solicită evaluare tehnică
        </button>
        <AssistantButton />
        </div>
        <p>Inginerul confirmă cifrele pe linia ta.</p>
      </div>
    </div>
  );
}
