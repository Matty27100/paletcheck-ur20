import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCUI } from '../src/lib/calc.js';
import {
  DAY,
  HOUR,
  MIN,
  demoLeads,
  draft,
  followups,
  makeCUI,
  nextAction,
  responseState,
  stats,
  withStage,
  withStepDone,
} from '../src/lib/leads.js';

const T0 = Date.UTC(2027, 1, 3, 9, 0); // a Wednesday morning
const lead = (o = {}) => ({
  company: 'Fabrica Demo SRL',
  email: 'test@fabrica-demo.ro',
  phone: '0700 000 000',
  hub: 'Timișoara',
  verdict: 'Linia ta se potrivește',
  verdictLevel: 'ok',
  preference: 'demo',
  stage: 'new',
  createdAt: new Date(T0).toISOString(),
  answers: { weight: 13, rate: 6, perPallet: 44, shifts: 2, handle: 'da' },
  ...o,
});

test('schedule: confirmation is automatic, call due within the hour, then day 2, 5, 14', () => {
  const steps = followups(lead(), T0 + 10 * MIN);
  assert.deepEqual(steps.map((s) => s.id), ['confirm', 'call', 'casestudy', 'next', 'checkin']);
  assert.equal(steps[0].state, 'done');
  assert.equal(steps[1].state, 'due');
  assert.equal(steps[2].due, T0 + 2 * DAY);
  assert.equal(steps[3].due, T0 + 5 * DAY);
  assert.equal(steps[4].due, T0 + 14 * DAY);
  assert.equal(nextAction(lead(), T0 + 10 * MIN).id, 'call');
});

test('an uncalled lead becomes overdue after one hour', () => {
  assert.equal(followups(lead(), T0 + 61 * MIN)[1].state, 'overdue');
  assert.equal(responseState(lead(), T0 + 61 * MIN).onTime, false);
});

test('marking the call done moves the lead to Contactat and records response time', () => {
  const l = withStepDone(lead(), 'call', 'Apel', T0 + 25 * MIN);
  assert.equal(l.stage, 'contacted');
  const r = responseState(l, T0 + 5 * HOUR);
  assert.equal(r.contacted, true);
  assert.equal(r.minutes, 25);
  assert.equal(r.onTime, true);
});

test('later stages skip steps that are no longer useful; closed leads skip everything open', () => {
  const ev = withStage(lead(), 'evaluation', T0 + 30 * MIN);
  const s = followups(ev, T0 + 3 * DAY);
  assert.equal(s.find((x) => x.id === 'casestudy').state, 'skipped');
  assert.equal(s.find((x) => x.id === 'checkin').state, 'upcoming');
  const lost = withStage(lead(), 'lost', T0 + 30 * MIN);
  assert.ok(followups(lost, T0 + 3 * DAY).filter((x) => x.id !== 'confirm').every((x) => x.state === 'skipped'));
});

test('without a phone number the call becomes an e-mail with time slots', () => {
  const s = followups(lead({ phone: '' }), T0);
  assert.equal(s[1].channel, 'email');
  assert.match(draft(lead({ phone: '' }), 'call').body, /15 minute/);
});

test('drafts carry the line data and the preferred next step', () => {
  const d = draft(lead(), 'confirm');
  assert.match(d.subject, /Fabrica Demo SRL/);
  assert.match(d.body, /7,3 minute/);
  assert.match(d.body, /37 tone/);
  assert.match(draft(lead({ preference: 'bucket' }), 'next').body, /găleți pline/);
});

test('demo leads have valid fictitious CUIs and stats add up', () => {
  assert.equal(validCUI(makeCUI(1234567)), true);
  const leads = demoLeads(T0);
  assert.ok(leads.every((l) => validCUI(l.cui)));
  assert.equal(new Set(leads.map((l) => l.cui)).size, leads.length);
  const st = stats(leads, T0);
  assert.equal(st.total, 6);
  assert.equal(Object.values(st.byStage).reduce((a, b) => a + b, 0), 6);
  assert.ok(st.respondedOnTimeShare > 0 && st.respondedOnTimeShare < 1); // one demo lead was called after 3 h
});
