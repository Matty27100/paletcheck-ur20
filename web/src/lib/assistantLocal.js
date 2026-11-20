// Offline mode of the assistant, used when no AI endpoint is configured or reachable.
// Not AI: it reads line data out of a sentence and answers from the tool's own facts.

import { FACTS } from './facts.js';
import { FAQ } from './faq.js';
import { fmt, parseNumber } from './calc.js';

const num = (s) => parseNumber(String(s).replace(/\s/g, ''));
const strip = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// "găleți de 10 kg, cam 400 pe oră, 44 pe palet, 3 schimburi, fără mâner"
export function extractLine(text) {
  const t = strip(text);
  const out = {};
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)/);
  if (kg) out.weight = num(kg[1]);
  const perMin = t.match(/(\d+(?:[.,]\d+)?)\s*(?:galeti|bucati|buc)?\s*(?:\/|pe|per)\s*min/);
  const perHour = t.match(/(\d+(?:[.,]\d+)?)\s*(?:galeti|bucati|buc)?\s*(?:\/|pe|per|la)\s*(?:ora|h\b)/);
  if (perMin) out.rate = num(perMin[1]);
  else if (perHour) out.rate = Math.round((num(perHour[1]) / 60) * 10) / 10;
  const pallet = t.match(/(\d+)\s*(?:galeti|bucati|buc)?\s*(?:\/|pe|per)\s*palet/);
  if (pallet) out.perPallet = num(pallet[1]);
  const shifts = t.match(/(\d)\s*(?:schimburi|schimb|ture|tura)/) || (/(?:un|un singur)\s+schimb/.test(t) ? [0, '1'] : null);
  if (shifts) out.shifts = num(shifts[1]);
  if (/(fara|nu are|n-are)\s+(un\s+)?maner/.test(t)) out.handle = 'nu';
  else if (/(cu|are)\s+maner/.test(t)) out.handle = 'da';
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && !Number.isNaN(v)));
}

export function describeLine(v) {
  const parts = [];
  if (v.weight !== undefined) parts.push(`${fmt(v.weight)} kg`);
  if (v.rate !== undefined) parts.push(`${fmt(v.rate)} găleți/min`);
  if (v.perPallet !== undefined) parts.push(`${v.perPallet} pe palet`);
  if (v.shifts !== undefined) parts.push(`${v.shifts} ${v.shifts === 1 ? 'schimb' : 'schimburi'}`);
  if (v.handle) parts.push(v.handle === 'da' ? 'cu mâner' : v.handle === 'nu' ? 'fără mâner' : 'mâner de confirmat');
  return parts.join(', ');
}

const R = FACTS.reference;
const TOPICS = [
  [/pret|cost|cat costa|investit|bani|eur/, `Prețul orientativ din scenariul de lucru este ${FACTS.finance.price.toLocaleString('ro-RO')} EUR pe celulă integrată, cu instalare și instruire. Pe ecranul „Cât economisești față de acum” vezi investiția, economia estimată și în cât timp se recuperează, din ipoteze pe care le poți modifica. Oferta reală vine după evaluarea tehnică.`],
  [/livr|cat dureaza|termen|cand/, `Livrarea durează aproximativ ${R.deliveryMonths} luni de la comandă, pentru aplicația de referință. Termenul exact se stabilește după evaluarea tehnică.`],
  [/sigur|scaner|protect|accident|om(ul|enii)? in zona/, 'Trei scanere urmăresc accesul în zona celulei: când intră cineva, robotul încetinește sau se oprește, după configurație. Evaluarea riscurilor face parte din evaluarea tehnică.'],
  [/igien|aliment|curat/, 'Cerințele de igienă se verifică la evaluarea tehnică, împreună cu procedurile de operare ale fabricii.'],
  [/sap|erp|retea|profinet|ethernet|modbus|plc|integr/, `UR20 comunică nativ prin ${FACTS.robot.nativeNetworks.join(', ')}. Legătura cu transportorul și semnalele de proces se verifică la evaluare; o legătură cu un sistem ERP precum SAP se discută separat.`],
  [/mai multe|doua celule|2 celule|3 celule|nu tine pasul|prea rapid/, `O celulă a fost testată la ${fmt(R.testedRate[13])} găleți/min la 13 kg și ${fmt(R.testedRate[5])} la 5 kg. Pentru linii mai rapide, pe ecranul de comparație poți vedea varianta cu 2 sau 3 celule.`],
  [/separat|palet(ul|ii)? (se )?schimb|manual|ce ramane/, 'Schimbarea paleților și amplasarea separatoarelor rămân operații manuale; robotul preia ridicarea repetitivă a găleților.'],
  [/inf(o|oi)l|transport|expedi|stretch/, 'Înfolierea, transportul paleților și expedierea nu fac parte din această soluție.'],
];

export function localReply(text, ctx) {
  const t = strip(text);
  const line = extractLine(text);
  if (Object.keys(line).length) {
    return {
      text: "Am înțeles datele de mai jos. Aplică-le în verificare ca să vezi rezultatul.",
      proposal: line,
    };
  }
  if (/rezultat|verdict|de ce|ce inseamna|potriv/.test(t) && ctx?.assessment) {
    const v = ctx.assessment.verdict;
    return { text: `${v.title}. ${v.note} ${ctx.assessment.bottleneck.text}` };
  }
  for (const [re, answer] of TOPICS) if (re.test(t)) return { text: answer };
  let best = null;
  let bestScore = 0;
  const words = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  for (const [q, a] of FAQ) {
    const score = strip(q).split(/[^a-z0-9]+/).filter((w) => words.has(w)).length;
    if (score > bestScore) [best, bestScore] = [a, score];
  }
  if (best) return { text: best };
  return {
    text: 'Pot răspunde despre ritm, greutate, siguranță, livrare, preț și ce rămâne manual. Poți și să-mi descrii linia, de exemplu: „găleți de 10 kg, 400 pe oră, 3 schimburi”.',
  };
}
