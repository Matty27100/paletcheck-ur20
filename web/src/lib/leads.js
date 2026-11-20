// Lead pipeline for the CRM: stages, the follow-up schedule, message drafts,
// response-time tracking and statistics. Pure functions; `now` is passed in for tests.

import { fmt } from './calc.js';

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const RESPONSE_TARGET = HOUR; // contacting within an hour made qualification ~7x likelier (HBR 2011)

export const STAGES = [
  { id: 'new', label: 'Nouă' },
  { id: 'contacted', label: 'Contactat' },
  { id: 'evaluation', label: 'Evaluare programată' },
  { id: 'offer', label: 'Ofertă trimisă' },
  { id: 'won', label: 'Câștigat' },
  { id: 'lost', label: 'Pierdut' },
];
const stageIndex = (id) => STAGES.findIndex((s) => s.id === id);
export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id;

export const PREFERENCES = [
  { id: 'call', label: 'Un apel de 15 minute', short: 'apel' },
  { id: 'demo', label: 'Demonstrație la centrul Tech-Con', short: 'demonstrație' },
  { id: 'bucket', label: 'Trimit o găleată pentru un test de prindere', short: 'test cu găleata' },
  { id: 'visit', label: 'Vizită în fabrică', short: 'vizită' },
];
export const preferenceLabel = (id) => PREFERENCES.find((p) => p.id === id)?.label || 'nespecificat';

const at = (lead) => new Date(lead.createdAt).getTime();

// The follow-up sequence. `skipFrom` = the stage at which the step stops being useful.
const PLAN = [
  { id: 'confirm', offset: 0, channel: 'email', auto: true, title: 'Confirmare automată cu fișa de pre-evaluare' },
  { id: 'call', offset: HOUR, channel: 'phone', title: 'Apel de calificare, 15 minute', skipFrom: 'contacted' },
  { id: 'casestudy', offset: 2 * DAY, channel: 'email', title: 'Studiul de caz și video-ul celulei', skipFrom: 'evaluation' },
  { id: 'next', offset: 5 * DAY, channel: 'email', title: 'Invitație la pasul preferat', skipFrom: 'evaluation' },
  { id: 'checkin', offset: 14 * DAY, channel: 'email', title: 'Revenire: întrebări rămase și calendarul deciziei' },
];

// Steps with their due time and state: done | skipped | overdue | due | upcoming.
export function followups(lead, now = Date.now()) {
  const closed = lead.stage === 'won' || lead.stage === 'lost';
  return PLAN.map((step) => {
    const due = at(lead) + step.offset;
    const doneAt = lead.done?.[step.id] || (step.auto ? lead.createdAt : null);
    let state;
    if (doneAt) state = 'done';
    else if (closed || (step.skipFrom && stageIndex(lead.stage) >= stageIndex(step.skipFrom))) state = 'skipped';
    else if (now > due + (step.id === 'call' ? 0 : DAY)) state = 'overdue';
    else if (now >= due - (step.id === 'call' ? HOUR : 0)) state = 'due';
    else state = 'upcoming';
    const title = step.id === 'next' ? nextStepTitle(lead) : step.id === 'call' && !lead.phone ? 'E-mail cu 3 intervale pentru apel' : step.title;
    return { ...step, title, due, doneAt, state, channel: step.id === 'call' && !lead.phone ? 'email' : step.channel };
  });
}

function nextStepTitle(lead) {
  if (lead.verdictLevel === 'no') return 'Propunerea inginerului pentru o variantă adaptată';
  return {
    demo: 'Invitație la demonstrație la centrul Tech-Con',
    bucket: 'Instrucțiuni pentru trimiterea găleții la test',
    visit: 'Programarea vizitei în fabrică',
    call: 'Invitație la demonstrație la centrul Tech-Con',
  }[lead.preference || 'call'];
}

// The step the sales engineer should act on now (first open step in order).
export function nextAction(lead, now = Date.now()) {
  return followups(lead, now).find((s) => s.state === 'overdue' || s.state === 'due' || s.state === 'upcoming') || null;
}

// Time to first human contact: the call step, or moving the lead past "new".
export function firstContactAt(lead) {
  const t = [lead.done?.call, lead.contactedAt].filter(Boolean).map((d) => new Date(d).getTime());
  return t.length ? Math.min(...t) : null;
}

export function responseState(lead, now = Date.now()) {
  const first = firstContactAt(lead);
  if (first) return { contacted: true, minutes: Math.round((first - at(lead)) / MIN), onTime: first - at(lead) <= RESPONSE_TARGET };
  const waited = now - at(lead);
  return { contacted: false, minutes: Math.round(waited / MIN), onTime: waited <= RESPONSE_TARGET };
}

export function ago(iso, now = Date.now()) {
  const d = Math.max(0, now - new Date(iso).getTime());
  if (d < MIN) return 'acum';
  if (d < HOUR) return `acum ${Math.round(d / MIN)} min`;
  if (d < DAY) return `acum ${Math.round(d / HOUR)} h`;
  const days = Math.round(d / DAY);
  return days === 1 ? 'ieri' : `acum ${days} zile`;
}

export function dueLabel(ms, now = Date.now()) {
  const d = ms - now;
  const abs = Math.abs(d);
  const span = abs < HOUR ? `${Math.max(1, Math.round(abs / MIN))} min` : abs < DAY ? `${Math.round(abs / HOUR)} h` : `${Math.round(abs / DAY)} zile`;
  return d >= 0 ? `în ${span}` : `întârziat ${span}`;
}

// Message drafts, personalised from the line data the visitor entered.
export function draft(lead, stepId) {
  const a = lead.answers || {};
  const minutes = a.rate ? fmt(a.perPallet / a.rate) : '';
  const tonnes = a.rate ? fmt((a.rate * 480 * a.weight) / 1000, 0) : '';
  const sign = `\n\nCu stimă,\nEchipa de aplicații robotice Tech-Con, centrul ${lead.hub}`;
  const hello = `Bună ziua,\n\n`;
  const line = `linia de ${fmt(a.weight)} kg la ${fmt(a.rate)} găleți/min (${a.perPallet} pe palet, ${a.shifts} schimburi)`;
  switch (stepId) {
    case 'confirm':
      return {
        subject: `Fișa de pre-evaluare UR20 pentru ${lead.company}`,
        body: `${hello}Vă mulțumim pentru verificarea făcută pentru ${line}. Rezultatul: ${lead.verdict.toLowerCase()}. Un palet complet la aproximativ ${minutes} minute; echipa ridică manual circa ${tonnes} tone pe schimb.\n\nAtașat găsiți fișa de pre-evaluare. Un inginer de la centrul ${lead.hub} vă contactează în cel mult o oră din programul de lucru.${sign}`,
      };
    case 'call':
      return lead.phone
        ? {
            subject: `Apel: ${lead.company}`,
            body: `Scop: confirmăm datele liniei și pasul următor (${preferenceLabel(lead.preference).toLowerCase()}).\nDe verificat: dimensiunile găleții, modelul de paletizare, spațiul, transportorul și semnalele de proces.\nDate: ${line}; verdict: ${lead.verdict}.`,
          }
        : {
            subject: `${lead.company}: 15 minute pentru linia de paletizare`,
            body: `${hello}Am primit verificarea pentru ${line}. Vă propun un apel de 15 minute ca să confirmăm datele: mâine la 10:00, mâine la 14:00 sau poimâine la 11:00. Răspundeți cu varianta potrivită sau cu un număr de telefon.${sign}`,
          };
    case 'casestudy':
      return {
        subject: 'Cum arată o celulă UR20 care paletizează găleți',
        body: `${hello}Vă trimit studiul de caz al aplicației de referință: găleți de 5 și 13 kg, două poziții de paletizare, cameră care verifică mânerul. La recepție: 7,4 găleți/min la 13 kg și 8,6 la 5 kg (rezultate de test, nu o garanție). Video-ul arată și schimbul de palet, care rămâne manual.\n\nPentru ${line}, pasul următor ar fi ${preferenceLabel(lead.preference).toLowerCase()}. Vă convine săptămâna aceasta?${sign}`,
      };
    case 'next':
      return {
        subject: `${nextStepTitle(lead)}: ${lead.company}`,
        body:
          lead.preference === 'bucket'
            ? `${hello}Ne puteți trimite 2–3 găleți pline (sau goale, cu greutatea notată) la centrul ${lead.hub}. Filmăm testul de prindere cu UR20 și vă trimitem înregistrarea în 3 zile lucrătoare.${sign}`
            : lead.preference === 'visit'
              ? `${hello}Pentru evaluarea tehnică propunem o vizită de 2 ore în fabrică: măsurăm spațiul, transportorul și accesul operatorilor. Ce zile vă convin săptămâna viitoare?${sign}`
              : `${hello}Vă invităm la o demonstrație la centrul ${lead.hub}, cu găleți de format apropiat de al dumneavoastră. Durează o oră; puteți veni cu colegii care aprobă investiția.${sign}`,
      };
    default:
      return {
        subject: `${lead.company}: au rămas întrebări despre paletizarea cu UR20?`,
        body: `${hello}Revin la verificarea pentru ${line}. Aveți întrebări rămase sau o dată la care se decide bugetul? Livrarea durează aproximativ patru luni de la comandă.${sign}`,
      };
  }
}

export const mailto = (lead, d) =>
  `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;

// Changing stage records history and, the first time a lead leaves "new", the contact time.
export function withStage(lead, stage, now = Date.now()) {
  const iso = new Date(now).toISOString();
  return {
    ...lead,
    stage,
    contactedAt: lead.contactedAt || (stage !== 'new' && stage !== 'lost' ? iso : null),
    history: [...(lead.history || []), { at: iso, text: `Etapă: ${stageLabel(stage)}` }],
  };
}

export function withStepDone(lead, stepId, title, now = Date.now()) {
  const iso = new Date(now).toISOString();
  const next = { ...lead, done: { ...(lead.done || {}), [stepId]: iso }, history: [...(lead.history || []), { at: iso, text: `Făcut: ${title}` }] };
  return stepId === 'call' && lead.stage === 'new' ? withStage(next, 'contacted', now) : next;
}

export function withNote(lead, text, now = Date.now()) {
  const iso = new Date(now).toISOString();
  return { ...lead, notes: [{ at: iso, text }, ...(lead.notes || [])] };
}

export function stats(leads, now = Date.now()) {
  const by = (f) => leads.reduce((acc, l) => ((acc[f(l)] = (acc[f(l)] || 0) + 1), acc), {});
  const contacted = leads.filter((l) => firstContactAt(l));
  const onTime = contacted.filter((l) => responseState(l, now).onTime).length;
  const waitingLate = leads.filter((l) => !firstContactAt(l) && l.stage === 'new' && !responseState(l, now).onTime).length;
  return {
    total: leads.length,
    byStage: by((l) => l.stage),
    bySource: by((l) => l.source || 'direct'),
    byPriority: by((l) => l.priority),
    respondedOnTimeShare: contacted.length ? onTime / contacted.length : null,
    waitingLate,
    actionsNow: leads.filter((l) => ['due', 'overdue'].includes(nextAction(l, now)?.state)).length,
  };
}

// Romanian CUI with a valid check digit, for the sample companies.
export function makeCUI(base) {
  const digits = String(base).split('').map(Number);
  const key = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const padded = Array(9 - digits.length).fill(0).concat(digits);
  let c = (padded.reduce((s, d, i) => s + d * key[i], 0) * 10) % 11;
  if (c === 10) c = 0;
  return `${base}${c}`;
}

// Fictitious leads at different points of the pipeline, so the CRM can be shown at once.
export function demoLeads(now = Date.now()) {
  const iso = (ms) => new Date(now - ms).toISOString();
  const mk = (o) => ({
    stage: 'new',
    done: {},
    notes: [],
    history: [],
    consentMarketing: false,
    role: 'Director de producție',
    ...o,
    email: `achizitii@${o.slug}.example.com`,
    cui: makeCUI(o.cuiBase),
    createdAt: iso(o.ago),
    demo: true,
  });
  return [
    mk({ slug: 'cremeria-nord', cuiBase: 4410271, company: 'Cremeria Nord SRL', county: 'Prahova', countyCode: 'PH', hub: 'Dragomirești-Deal', verdictLevel: 'ok', verdict: 'Linia ta se potrivește', priority: 'A', source: 'linkedin / lansare-2027', preference: 'demo', phone: '0700 000 101', ago: 18 * MIN, answers: { weight: 13, rate: 6.2, perPallet: 44, shifts: 3, handle: 'da' } }),
    mk({ slug: 'panifico', cuiBase: 3820117, company: 'Panifico Ingrediente SRL', county: 'Cluj', countyCode: 'CJ', hub: 'Timișoara', verdictLevel: 'check', verdict: 'Se poate, cu o evaluare tehnică', priority: 'B', source: 'google / paletizare', preference: 'bucket', phone: '', ago: 95 * MIN, answers: { weight: 15, rate: 5, perPallet: 40, shifts: 2, handle: 'nustiu' } }),
    mk({ slug: 'lactis-moldova', cuiBase: 2955310, company: 'Lactis Moldova SA', county: 'Iași', countyCode: 'IS', hub: 'Iași', verdictLevel: 'ok', verdict: 'Linia ta se potrivește', priority: 'A', source: 'direct', preference: 'call', phone: '0700 000 102', role: 'Director general sau investiții', ago: 3 * DAY, stage: 'evaluation', contactedAt: iso(3 * DAY - 40 * MIN), done: { call: iso(3 * DAY - 40 * MIN) }, notes: [{ at: iso(2 * DAY), text: 'Evaluare la fabrică marți; vor și separatoare automate, de discutat separat.' }], answers: { weight: 5, rate: 8, perPallet: 100, shifts: 2, handle: 'da' } }),
    mk({ slug: 'sosuri-banat', cuiBase: 1677402, company: 'Sosuri Banat SRL', county: 'Timiș', countyCode: 'TM', hub: 'Timișoara', verdictLevel: 'ok', verdict: 'Linia ta se potrivește', priority: 'A', source: 'webinar / martie', preference: 'demo', phone: '0700 000 103', ago: 12 * DAY, stage: 'offer', contactedAt: iso(12 * DAY - 25 * MIN), done: { call: iso(12 * DAY - 25 * MIN), casestudy: iso(10 * DAY) }, answers: { weight: 10, rate: 6.8, perPallet: 54, shifts: 3, handle: 'da' } }),
    mk({ slug: 'vopsele-arges', cuiBase: 5120339, company: 'Vopsele Argeș SRL', county: 'Argeș', countyCode: 'AG', hub: 'Dragomirești-Deal', verdictLevel: 'no', verdict: 'În afara domeniului testat', priority: 'C', source: 'google / galeti', preference: 'call', phone: '', role: 'Inginer de proces sau mentenanță', ago: 6 * DAY, stage: 'contacted', contactedAt: iso(6 * DAY - 3 * HOUR), answers: { weight: 22, rate: 9.5, perPallet: 36, shifts: 3, handle: 'nu' } }),
    mk({ slug: 'dulciuri-ardeal', cuiBase: 6043285, company: 'Dulciuri Ardeal SRL', county: 'Sibiu', countyCode: 'SB', hub: 'Timișoara', verdictLevel: 'ok', verdict: 'Linia ta se potrivește', priority: 'A', source: 'linkedin / lansare-2027', preference: 'visit', phone: '0700 000 104', ago: 40 * DAY, stage: 'won', contactedAt: iso(40 * DAY - 50 * MIN), done: { call: iso(40 * DAY - 50 * MIN), casestudy: iso(38 * DAY), next: iso(34 * DAY) }, notes: [{ at: iso(9 * DAY), text: 'Comandă semnată: 2 celule, livrare estimată în 4 luni.' }], answers: { weight: 13, rate: 7, perPallet: 44, shifts: 3, handle: 'da' } }),
  ];
}
