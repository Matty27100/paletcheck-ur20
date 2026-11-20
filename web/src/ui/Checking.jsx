import { useEffect, useState } from 'react';

// A short, visible check of what is being compared: people value a result more
// when they can see the work behind it.
const ITEMS = [
  'Sarcina robotului, cu dispozitivul de prindere',
  'Ritmul liniei față de ritmul testat',
  'Timpul pentru schimbul paletului',
  'Formatul găleții și mânerul',
];

export default function Checking({ onDone }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setInterval(() => setN((x) => x + 1), reduced ? 90 : 360);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (n === ITEMS.length + 1) onDone();
  }, [n, onDone]);

  return (
    <div className="screen checking" aria-live="polite">
      <h1>Verificăm linia ta</h1>
      <ul className="checklist">
        {ITEMS.map((item, i) => (
          <li key={item} className={i < n ? 'is-done' : i === n ? 'is-now' : ''}>
            <span className="tick" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
