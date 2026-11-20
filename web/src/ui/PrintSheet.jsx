import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FACTS } from '../lib/facts.js';
import { STILL_NEEDED, fmt } from '../lib/calc.js';
import { shareUrl } from '../lib/share.js';

const HANDLE = { da: 'da', nu: 'nu', nustiu: 'de confirmat' };

// One A4 page, shown only when printing: the sheet a production director forwards.
export default function PrintSheet({ answers, assessment, lead }) {
  const [qr, setQr] = useState('');
  const url = shareUrl(answers);
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  const { verdict, figures, criteria, bottleneck, hub } = assessment;
  const rows = [
    ['Greutatea unei găleți', `${fmt(answers.weight)} kg`],
    ['Debitul liniei', `${fmt(answers.rate)} găleți/min`],
    ['Găleți pe palet', answers.perPallet],
    ['Schimburi pe zi', `${answers.shifts} × ${answers.shiftHours || 8} ore`],
    ['Mâner', HANDLE[answers.handle]],
    ['Separatoare', answers.separators === null ? 'de confirmat' : answers.separators ? 'da' : 'nu'],
    ['Rețeaua liniei', answers.network || 'de confirmat'],
  ];

  return (
    <article className="print-sheet" aria-hidden="true">
      <header>
        <p>Tech-Con · Fișă de pre-evaluare</p>
        <h1>Celulă de paletizare UR20: {verdict.title.toLowerCase()}</h1>
        <p>
          {lead ? `${lead.company}, ${lead.county} · ` : ''}
          {new Date().toLocaleDateString('ro-RO')}
        </p>
      </header>
      <section className="ps-cols">
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ps-figs">
          <p>
            <b>{fmt(figures.minutesPerPallet)}</b> minute pe palet
          </p>
          <p>
            <b>{fmt(figures.palletsPerShift, 0)}</b> paleți pe schimb
          </p>
          <p>
            <b>{fmt(figures.tonnesPerShift, 0)}</b> tone ridicate manual pe schimb
          </p>
          <p>
            <b>{fmt(figures.tonnesPerDay, 0)}</b> tone pe zi
          </p>
        </div>
      </section>
      <h2>Criterii</h2>
      <ul>
        {criteria.map((c) => (
          <li key={c.id}>
            [{c.status === 'ok' ? 'confirmat' : c.status === 'unknown' ? 'necunoscut' : c.status === 'no' ? 'în afara domeniului' : 'de verificat'}] {c.text}
          </li>
        ))}
      </ul>
      <p>{bottleneck.text}</p>
      <h2>Ce verificăm la evaluarea tehnică</h2>
      <ul>
        {STILL_NEEDED.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <footer>
        <div>
          <p>
            Centru Tech-Con: {hub?.name || lead?.hub || 'Dragomirești-Deal, Iași sau Timișoara'}. Livrare orientativă: aproximativ{' '}
            {FACTS.reference.deliveryMonths} luni de la comandă.
          </p>
          <p>
            Rezultatele de test (7,4 găleți/min la 13 kg, 8,6 la 5 kg) aparțin aplicației de referință și nu sunt o garanție.
            Schimbarea paletului și separatoarele rămân manuale.
          </p>
        </div>
        {qr && <div className="ps-qr" dangerouslySetInnerHTML={{ __html: qr }} />}
      </footer>
    </article>
  );
}
