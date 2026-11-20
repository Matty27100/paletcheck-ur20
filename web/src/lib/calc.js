import { COUNTIES, FACTS } from './facts.js';

const { reference: REF, robot: ROBOT, assumptions: A } = FACTS;

// Accepts 7,4 and 7.4; returns NaN for anything that is not a plain number.
export function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const t = value.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const LIMITS = {
  weight: { min: 0.5, max: 60, label: 'Greutatea găleții', unit: 'kg' },
  rate: { min: 0.5, max: 30, label: 'Debitul liniei', unit: 'găleți/min' },
  perPallet: { min: 1, max: 300, label: 'Găleți pe palet', unit: 'găleți' },
  shifts: { min: 1, max: 3, label: 'Schimburi pe zi', unit: '' },
  shiftHours: { min: 4, max: 12, label: 'Durata schimbului', unit: 'ore' },
};

// Returns { values, errors } where errors maps a field to a message in Romanian.
export function validate(raw) {
  const values = { ...raw };
  const errors = {};
  for (const [key, lim] of Object.entries(LIMITS)) {
    if (raw[key] === undefined && key === 'shiftHours') {
      values.shiftHours = A.shiftHours;
      continue;
    }
    const v = parseNumber(raw[key]);
    if (raw[key] === '' || raw[key] === undefined || raw[key] === null) errors[key] = `${lim.label}: lipsește.`;
    else if (Number.isNaN(v)) errors[key] = `${lim.label}: introduceți doar cifre, de exemplu 7,4.`;
    else if (v < lim.min || v > lim.max)
      errors[key] = `${lim.label}: valoarea trebuie să fie între ${fmt(lim.min)} și ${fmt(lim.max)}${lim.unit ? ' ' + lim.unit : ''}.`;
    else values[key] = v;
  }
  if (!errors.perPallet && !Number.isInteger(values.perPallet)) errors.perPallet = 'Găleți pe palet: număr întreg.';
  if (!errors.shifts && !Number.isInteger(values.shifts)) errors.shifts = 'Schimburi pe zi: 1, 2 sau 3.';
  if (!['da', 'nu', 'nustiu'].includes(raw.handle)) errors.handle = 'Mânerul: alegeți Da, Nu sau Nu știu.';
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

export const fmt = (n, digits = 1) => Number(n).toLocaleString('ro-RO', { maximumFractionDigits: digits });

// The tested rate that applies: 5 kg and lighter ran at 8.6/min, heavier formats at 7.4/min.
export const testedRateFor = (weight) => (weight <= 5 ? REF.testedRate[5] : REF.testedRate[13]);

export function figures({ weight, rate, perPallet, shifts, shiftHours = A.shiftHours }) {
  const minutes = shiftHours * 60;
  return {
    minutesPerPallet: perPallet / rate,
    palletsPerShift: (rate * minutes) / perPallet,
    liftsPerShift: rate * minutes,
    tonnesPerShift: (rate * minutes * weight) / 1000,
    tonnesPerDay: (rate * minutes * weight * shifts) / 1000,
  };
}

const NATIVE = ROBOT.nativeNetworks;

// Seven criteria, each ok | check | no | unknown.
export function criteria(input) {
  const { weight, rate, perPallet, handle, separators, network, gripperKg = A.gripperKg } = input;
  const load = weight + gripperKg;
  const tested = testedRateFor(weight);
  const swapMinutes = perPallet / rate;
  const list = [];

  list.push(
    load <= ROBOT.payloadKg
      ? { id: 'payload', status: 'ok', text: `Sarcina: ${fmt(load)} kg cu dispozitivul de prindere, sub ${ROBOT.payloadKg} kg.` }
      : load <= ROBOT.payloadExtendedKg
        ? { id: 'payload', status: 'check', text: `Sarcina: ${fmt(load)} kg, peste ${ROBOT.payloadKg} kg. Posibil doar în condițiile din manualul robotului.` }
        : { id: 'payload', status: 'no', text: `Sarcina: ${fmt(load)} kg, peste limita de ${ROBOT.payloadExtendedKg} kg a robotului.` },
  );

  if (rate <= REF.targetRate)
    list.push({ id: 'rate', status: 'ok', text: `Debitul: ${fmt(rate)} găleți/min, în ținta de ${REF.targetRate}/min a aplicației de referință.` });
  else if (rate <= tested)
    list.push({ id: 'rate', status: 'ok', text: `Debitul: ${fmt(rate)} găleți/min, sub ritmul testat de ${fmt(tested)}/min.` });
  else if (rate <= REF.testedRate[5])
    list.push({ id: 'rate', status: 'check', text: `Debitul: ${fmt(rate)}/min. Peste ${fmt(REF.testedRate[13])}/min s-a testat doar formatul de 5 kg.` });
  else
    list.push({ id: 'rate', status: 'no', text: `Debitul: ${fmt(rate)}/min, peste ritmul testat al unei celule (${fmt(REF.testedRate[5])}/min).` });

  const [lo, hi] = A.nearFormatKg;
  list.push(
    weight >= 5 && weight <= 13
      ? { id: 'format', status: 'ok', text: `Formatul: ${fmt(weight)} kg, între formatele testate de 5 și 13 kg.` }
      : weight >= lo && weight <= hi
        ? { id: 'format', status: 'check', text: `Formatul: ${fmt(weight)} kg, aproape de formatele testate. Se verifică forma și stabilitatea.` }
        : { id: 'format', status: 'check', text: `Formatul: ${fmt(weight)} kg, diferit de cele testate. Cerințele se validează separat.` },
  );

  list.push(
    handle === 'da'
      ? { id: 'handle', status: 'ok', text: 'Mânerul: există; camera îi verifică poziția înainte de preluare.' }
      : handle === 'nu'
        ? { id: 'handle', status: 'check', text: 'Mânerul: lipsește; e nevoie de alt mod de prindere.' }
        : { id: 'handle', status: 'unknown', text: 'Mânerul: de confirmat.' },
  );

  list.push(
    swapMinutes >= A.minSwapMinutes
      ? { id: 'swap', status: 'ok', text: `Schimbul paletului: un palet la ${fmt(swapMinutes)} min, timp suficient pe a doua poziție.` }
      : { id: 'swap', status: 'check', text: `Schimbul paletului: un palet la ${fmt(swapMinutes)} min, ritm alert pentru operator.` },
  );

  list.push(
    separators === undefined || separators === null
      ? { id: 'separators', status: 'unknown', text: 'Separatoarele între straturi: de confirmat.' }
      : { id: 'separators', status: 'ok', text: separators ? 'Separatoarele: rămân o operație manuală, ca în aplicația de referință.' : 'Separatoarele: nu sunt necesare.' },
  );

  list.push(
    !network || network === 'nustiu'
      ? { id: 'network', status: 'unknown', text: 'Rețeaua liniei: de confirmat.' }
      : NATIVE.includes(network)
        ? { id: 'network', status: 'ok', text: `Rețeaua liniei: ${network}, suportată nativ de UR20.` }
        : { id: 'network', status: 'check', text: 'Rețeaua liniei: alt protocol, se verifică integrarea.' },
  );
  return list;
}

export function verdict(list) {
  const count = (s) => list.filter((c) => c.status === s).length;
  const confirmed = count('ok');
  const unknown = count('unknown');
  const level = count('no') ? 'no' : count('check') ? 'check' : 'ok';
  const title = {
    ok: 'Linia ta se potrivește',
    check: 'Se poate, cu o evaluare tehnică',
    no: 'În afara domeniului testat',
  }[level];
  const first = list.find((c) => c.status === level && level !== 'ok');
  const note = first ? first.text : 'Greutatea, debitul și paletul sunt în valorile testate.';
  return { level, title, note, confirmed, unknown, total: list.length };
}

export function bottleneck({ weight, rate }) {
  const tested = testedRateFor(weight);
  if (rate <= tested)
    return {
      robotIsLimit: false,
      text: `Linia dă ${fmt(rate)} găleți/min, iar celula a fost testată la ${fmt(tested)}/min. Robotul ține pasul; debitul fabricii rămâne dat de umplere.`,
    };
  return {
    robotIsLimit: true,
    text: `Linia dă ${fmt(rate)} găleți/min, peste ritmul testat de ${fmt(tested)}/min. Fără o soluție pentru diferență, celula ar deveni blocajul.`,
  };
}

const toRad = (d) => (d * Math.PI) / 180;
function km(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestHub(countyCode) {
  const c = COUNTIES.find((row) => row[0] === countyCode);
  if (!c) return null;
  const here = { lat: c[2], lon: c[3] };
  return FACTS.hubs
    .map((h) => ({ ...h, km: km(here, h) }))
    .sort((a, b) => a.km - b.km)[0];
}

// What a technical evaluation still needs (brief, page 3).
export const STILL_NEEDED = [
  'Dimensiunile, materialul și stabilitatea găleții',
  'Modelul de paletizare și separatoarele',
  'Spațiul disponibil și accesul operatorilor',
  'Transportorul de alimentare și semnalele de proces',
  'Evaluarea riscurilor și cerințele de igienă',
];

// Romanian company tax ID (CUI/CIF), with or without the RO prefix.
export function validCUI(value) {
  const t = String(value || '').trim().toUpperCase().replace(/^RO/, '').replace(/\s/g, '');
  if (!/^\d{2,10}$/.test(t)) return false;
  const digits = t.split('').map(Number);
  const check = digits.pop();
  const key = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const padded = Array(9 - digits.length).fill(0).concat(digits);
  const sum = padded.reduce((acc, d, i) => acc + d * key[i], 0);
  let expected = (sum * 10) % 11;
  if (expected === 10) expected = 0;
  return expected === check;
}

export const normalCUI = (value) => String(value || '').trim().toUpperCase().replace(/^RO/, '').replace(/\s/g, '');

export const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

// A = ready for a technical visit, B = needs a call first, C = outside the tested domain or a small operation.
export function priority(level, shifts) {
  if (level === 'no') return 'C';
  if (level === 'ok' && shifts >= 2) return 'A';
  if (shifts === 1) return 'C';
  return 'B';
}

// Full assessment used by the result screen and the printable sheet.
export function assess(input) {
  const list = criteria(input);
  return {
    criteria: list,
    verdict: verdict(list),
    figures: figures(input),
    bottleneck: bottleneck(input),
    hub: nearestHub(input.county),
  };
}
