// Browser storage for the prototype. Every call is guarded: private windows and
// blocked storage must never break the tool.

const KEY_ANSWERS = 'paletcheck.answers';
const KEY_LEADS = 'paletcheck.leads';

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const loadAnswers = () => safe(() => JSON.parse(localStorage.getItem(KEY_ANSWERS)), null);
export const saveAnswers = (a) => safe(() => localStorage.setItem(KEY_ANSWERS, JSON.stringify(a)));

export const loadLeads = () => safe(() => JSON.parse(localStorage.getItem(KEY_LEADS)) || [], []);
const saveLeads = (leads) => safe(() => localStorage.setItem(KEY_LEADS, JSON.stringify(leads)));

// One company = one request: a second request with the same CUI updates the first.
export function upsertLead(lead) {
  const leads = loadLeads();
  const i = leads.findIndex((l) => l.cui === lead.cui);
  const duplicate = i >= 0;
  if (duplicate) leads[i] = { ...leads[i], ...lead, created: leads[i].created, updated: lead.created };
  else leads.unshift(lead);
  saveLeads(leads);
  return { duplicate, leads };
}

export const clearLeads = () => saveLeads([]);

export function trafficSource() {
  const p = safe(() => new URLSearchParams(window.location.search), new URLSearchParams());
  return [p.get('utm_source'), p.get('utm_campaign')].filter(Boolean).join(' / ') || 'direct';
}

const COLUMNS = [
  ['created', 'Data'],
  ['company', 'Companie'],
  ['cui', 'CUI'],
  ['role', 'Rol'],
  ['email', 'Email'],
  ['phone', 'Telefon'],
  ['county', 'Judet'],
  ['hub', 'Centru Tech-Con'],
  ['verdict', 'Verdict'],
  ['priority', 'Prioritate'],
  ['weight', 'Greutate galeata kg'],
  ['rate', 'Galeti pe minut'],
  ['perPallet', 'Galeti pe palet'],
  ['shifts', 'Schimburi'],
  ['handle', 'Maner'],
  ['separators', 'Separatoare'],
  ['network', 'Retea linie'],
  ['source', 'Sursa'],
];

// Semicolon-separated with a BOM, so Excel in Romanian locale opens it correctly.
export function leadsCsv(leads) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [COLUMNS.map((c) => cell(c[1])).join(';')];
  for (const l of leads) rows.push(COLUMNS.map(([k]) => cell(l[k])).join(';'));
  return '﻿' + rows.join('\r\n');
}

export function downloadCsv(leads) {
  const blob = new Blob([leadsCsv(leads)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cereri-evaluare-ur20.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
