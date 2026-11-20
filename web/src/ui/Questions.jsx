import { useEffect, useRef, useState } from 'react';
import { LIMITS, fmt, parseNumber } from '../lib/calc.js';
import { AssistantButton } from './Assistant.jsx';

export const QUESTIONS = [
  {
    key: 'weight',
    text: 'Cât cântărește o găleată plină?',
    options: [
      { value: 5, label: '5 kg' },
      { value: 13, label: '13 kg' },
    ],
    other: { label: 'Altă greutate', step: 1 },
  },
  { key: 'rate', text: 'Câte găleți ies pe minut din linie?', number: { step: 0.2 } },
  {
    key: 'perPallet',
    text: 'Câte găleți intră pe un palet?',
    options: [
      { value: 44, label: '44' },
      { value: 100, label: '100' },
    ],
    other: { label: 'Alt număr', step: 4 },
  },
  {
    key: 'shifts',
    text: 'Câte schimburi lucrați pe zi?',
    options: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ],
  },
  {
    key: 'handle',
    text: 'Găleata are mâner?',
    options: [
      { value: 'da', label: 'Da' },
      { value: 'nu', label: 'Nu' },
      { value: 'nustiu', label: 'Nu știu' },
    ],
  },
];

// Fast early, slower later: the pattern that lowered drop-off across 32 survey experiments.
export const PROGRESS = [0.18, 0.44, 0.63, 0.79, 0.91];

const unitOf = (key) => LIMITS[key].unit;

export function NumberField({ id, value, limit, step, onChange, onEnter, autoFocus }) {
  const [text, setText] = useState(fmt(value, 2));
  const [touched, setTouched] = useState(false);
  const num = parseNumber(text);
  const error = Number.isNaN(num)
    ? 'Introduceți doar cifre, de exemplu 7,4.'
    : num < limit.min || num > limit.max
      ? `Introduceți o valoare între ${fmt(limit.min)} și ${fmt(limit.max)}.`
      : null;

  const report = (t) => {
    const n = parseNumber(t);
    onChange(n, !Number.isNaN(n) && n >= limit.min && n <= limit.max);
  };
  const bump = (d) => {
    const base = Number.isNaN(num) ? value : num;
    const v = Math.min(limit.max, Math.max(limit.min, Math.round((base + d) * 10) / 10));
    const t = fmt(v, 2);
    setText(t);
    setTouched(false);
    report(t);
  };

  return (
    <div className="numfield">
      <div className="numfield-row">
        <button type="button" aria-label="Mai puțin" onClick={() => bump(-step)}>
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus={autoFocus}
          value={text}
          aria-invalid={touched && !!error}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setText(e.target.value);
            report(e.target.value);
          }}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setTouched(true);
              if (!error) onEnter?.();
            }
          }}
        />
        <button type="button" aria-label="Mai mult" onClick={() => bump(step)}>
          +
        </button>
      </div>
      <p id={`${id}-hint`} className={touched && error ? 'field-error' : 'field-unit'}>
        {touched && error ? error : limit.unit}
      </p>
    </div>
  );
}

export default function Questions({ index, answers, onAnswer, onNext, onBack }) {
  const q = QUESTIONS[index];
  const [custom, setCustom] = useState(!!q.number);
  const [valid, setValid] = useState(true);
  const [chosen, setChosen] = useState(null);
  const heading = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (index > 0) heading.current?.focus({ preventScroll: true });
    return () => clearTimeout(timer.current);
  }, [index]);

  const choose = (value) => {
    setChosen(value);
    setCustom(false);
    onAnswer(q.key, value);
    clearTimeout(timer.current);
    timer.current = setTimeout(onNext, 240);
  };
  const numberSpec = q.number || q.other;

  return (
    <div className="screen">
      <div className="progress">
        <button type="button" className="back" onClick={onBack} disabled={index === 0}>
          Înapoi
        </button>
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(PROGRESS[index] * 100)}
          aria-label={`Întrebarea ${index + 1} din ${QUESTIONS.length}`}
        >
          <span style={{ width: `${PROGRESS[index] * 100}%` }} />
        </div>
        <span className="count">
          {index + 1}/{QUESTIONS.length}
        </span>
      </div>

      {index === 0 && (
        <p className="hook">Verifică în două minute dacă un robot UR20 îți poate paletiza gălețile. Cinci întrebări, fără cont.</p>
      )}

      <div className="question" key={q.key}>
        <h1 ref={heading} tabIndex={-1}>
          {q.text}
        </h1>

        {q.options && (
          <div className="options">
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={!custom && chosen === o.value}
                onClick={() => choose(o.value)}
              >
                {o.label}
              </button>
            ))}
            {q.other && (
              <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
                {q.other.label}
              </button>
            )}
          </div>
        )}

        {custom && numberSpec && (
          <div className="number-block">
            <label className="sr-only" htmlFor={`f-${q.key}`}>
              {q.text}
            </label>
            <NumberField
              id={`f-${q.key}`}
              value={answers[q.key]}
              limit={{ ...LIMITS[q.key], unit: unitOf(q.key) }}
              step={numberSpec.step}
              autoFocus={!q.number}
              onChange={(v, ok) => {
                setValid(ok);
                if (ok) onAnswer(q.key, v);
              }}
              onEnter={onNext}
            />
            <button type="button" className="primary" onClick={onNext} disabled={!valid}>
              Continuă
            </button>
          </div>
        )}
      </div>

      <div className="assistant-slot">
        <AssistantButton labelled />
      </div>
    </div>
  );
}
