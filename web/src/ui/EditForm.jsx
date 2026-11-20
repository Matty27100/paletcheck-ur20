import { useEffect, useRef, useState } from 'react';
import { LIMITS, fmt, validate } from '../lib/calc.js';

const FIELDS = [
  ['weight', 'Greutatea unei găleți pline', 'kg'],
  ['rate', 'Găleți pe minut din linie', 'găleți/min'],
  ['perPallet', 'Găleți pe un palet', 'găleți'],
  ['shifts', 'Schimburi pe zi', '1, 2 sau 3'],
  ['shiftHours', 'Durata unui schimb', 'ore'],
];

const asText = (v) => (typeof v === 'number' ? fmt(v, 2) : (v ?? ''));

// All answers on one screen. Used for "Modifică datele" and for the wrong-data example.
export default function EditForm({ initial, showErrors, onSubmit, onCancel }) {
  const [raw, setRaw] = useState(() =>
    Object.fromEntries([...FIELDS.map(([k]) => [k, asText(initial[k])]), ['handle', initial.handle]]),
  );
  const [touched, setTouched] = useState(() => (showErrors ? Object.fromEntries(FIELDS.map(([k]) => [k, true])) : {}));
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  const { values, errors, ok } = validate(raw);
  const visible = Object.entries(errors).filter(([k]) => touched[k] || k === 'handle');

  return (
    <form
      className="screen edit"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(Object.fromEntries(FIELDS.map(([k]) => [k, true])));
        if (ok) onSubmit(values);
      }}
    >
      <h1 ref={heading} tabIndex={-1}>
        Datele liniei
      </h1>
      {FIELDS.map(([key, label, unit]) => (
        <div className="field" key={key}>
          <label htmlFor={`e-${key}`}>{label}</label>
          <div className="input-unit">
            <input
              id={`e-${key}`}
              inputMode="decimal"
              autoComplete="off"
              value={raw[key]}
              aria-invalid={!!(touched[key] && errors[key])}
              aria-describedby={`e-${key}-err`}
              onChange={(e) => setRaw({ ...raw, [key]: e.target.value })}
              onBlur={() => setTouched({ ...touched, [key]: true })}
            />
            <span>{unit}</span>
          </div>
          <p id={`e-${key}-err`} className="field-error">
            {touched[key] && errors[key]}
          </p>
        </div>
      ))}
      <fieldset className="field">
        <legend>Găleata are mâner?</legend>
        <div className="seg">
          {[
            ['da', 'Da'],
            ['nu', 'Nu'],
            ['nustiu', 'Nu știu'],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={raw.handle === v} onClick={() => setRaw({ ...raw, handle: v })}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      {visible.length > 0 && (
        <p className="form-summary" role="alert">
          Corectează {visible.length === 1 ? 'câmpul marcat' : `cele ${visible.length} câmpuri marcate`} ca să vezi rezultatul.
        </p>
      )}
      <button type="submit" className="primary">
        Vezi rezultatul
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Renunță
      </button>
      <p className="fine">
        Limite acceptate: greutate {fmt(LIMITS.weight.min)}–{fmt(LIMITS.weight.max)} kg, debit {fmt(LIMITS.rate.min)}–
        {fmt(LIMITS.rate.max)} găleți/min.
      </p>
    </form>
  );
}
