// Browser storage for the prototype. Every call is guarded: private windows and
// blocked storage must never break the tool. A production version would send
// requests to the CRM Tech-Con already uses; here they stay in this browser.

import { nextAction, stageLabel } from './leads.js';

const KEY_ANSWERS = 'paletcheck.answers';
const KEY_LEADS = 'paletcheck.leads.v2';

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
export const saveLeads = (leads) => safe(() => localStorage.setItem(KEY_LEADS, JSON.stringify(leads)));

// One company = one request: a second request with the same CUI updates the first
// and keeps its pipeline stage, notes and follow-up history.
export function upsertLead(lead) {
  const leads = loadLeads();
  const i = leads.findIndex((l) => l.cui === lead.cui);
  const duplicate = i >= 0;
  if (duplicate) {
    const old = leads[i];
    leads[i] = {
      ...old,
      ...lead,
      createdAt: old.createdAt,
      stage: old.stage,
      done: old.done,
      notes: old.notes,
      contactedAt: old.contactedAt,
      history: [...(old.history || []), { at: lead.createdAt, text: 'Cerere nouă de la aceeași firmă: date actualizate' }],
    };
  } else {
    leads.unshift({ stage: 'new', done: {}, notes: [], history: [{ at: lead.createdAt, text: 'Cerere primită' }], ...lead });
  }
  saveLeads(leads);
  return { duplicate, leads };
}

export function updateLead(updated) {
  const leads = loadLeads().map((l) => (l.cui === updated.cui ? updated : l));
  saveLeads(leads);
  return leads;
}

export function trafficSource() {
  const p = safe(() => new URLSearchParams(window.location.search), new URLSearchParams());
  return [p.get('utm_source'), p.get('utm_campaign')].filter(Boolean).join(' / ') || 'direct';
}

const COLUMNS = [
  ['createdAt', 'Data cererii'],
  ['company', 'Companie'],
  ['cui', 'CUI'],
  ['role', 'Rol'],
  ['email', 'Email'],
  ['phone', 'Telefon'],
  ['county', 'Judet'],
  ['hub', 'Centru Tech-Con'],
  ['priority', 'Prioritate'],
  ['stage', 'Etapa'],
  ['nextStep', 'Pasul urmator'],
  ['nextDue', 'Termen'],
  ['contactedAt', 'Primul contact'],
  ['verdict', 'Verdict'],
  ['preference', 'Pas preferat'],
  ['weight', 'Greutate galeata kg'],
  ['rate', 'Galeti pe minut'],
  ['perPallet', 'Galeti pe palet'],
  ['shifts', 'Schimburi'],
  ['handle', 'Maner'],
  ['network', 'Retea linie'],
  ['consentMarketing', 'Acord marketing'],
  ['source', 'Sursa'],
];

const local = (iso) => (iso ? new Date(iso).toLocaleString('ro-RO') : '');

// Semicolon-separated with a BOM, so Excel in Romanian locale and most CRMs import it cleanly.
export function leadsCsv(leads, now = Date.now()) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [COLUMNS.map((c) => cell(c[1])).join(';')];
  for (const l of leads) {
    const next = nextAction(l, now);
    const flat = {
      ...l,
      ...(l.answers || {}),
      createdAt: local(l.createdAt),
      contactedAt: local(l.contactedAt || l.done?.call),
      stage: stageLabel(l.stage),
      nextStep: next?.title || '',
      nextDue: next ? local(new Date(next.due).toISOString()) : '',
      consentMarketing: l.consentMarketing ? 'da' : 'nu',
    };
    rows.push(COLUMNS.map(([k]) => cell(flat[k])).join(';'));
  }
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
