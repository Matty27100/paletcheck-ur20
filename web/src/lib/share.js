import { validate } from './calc.js';

// Answers <-> short query string, so a result can be forwarded and reopened as is.
export function toQuery(a) {
  const p = new URLSearchParams({ g: a.weight, d: a.rate, p: a.perPallet, s: a.shifts, m: a.handle });
  if (a.separators !== null && a.separators !== undefined) p.set('sep', a.separators ? '1' : '0');
  if (a.network) p.set('net', a.network);
  if (a.county) p.set('jud', a.county);
  return p.toString();
}

export function fromQuery(search) {
  const p = new URLSearchParams(search);
  if (!p.has('g')) return null;
  const { values, ok } = validate({ weight: p.get('g'), rate: p.get('d'), perPallet: p.get('p'), shifts: p.get('s'), handle: p.get('m') });
  if (!ok) return null;
  return {
    weight: values.weight,
    rate: values.rate,
    perPallet: values.perPallet,
    shifts: values.shifts,
    handle: values.handle,
    separators: p.has('sep') ? p.get('sep') === '1' : null,
    network: p.get('net'),
    county: p.get('jud'),
  };
}

export const shareUrl = (a) => `${window.location.origin}${window.location.pathname}?${toQuery(a)}`;

// Phone share sheet when available, clipboard otherwise. Returns a short status line.
export async function shareResult(a, title) {
  const url = shareUrl(a);
  try {
    if (navigator.share) {
      await navigator.share({ title, text: 'Verificarea liniei pentru o celulă de paletizare UR20', url });
      return null;
    }
    await navigator.clipboard.writeText(url);
    return 'Link copiat. Îl poți trimite directorului.';
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    return url;
  }
}
