import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assess,
  bottleneck,
  criteria,
  figures,
  nearestHub,
  parseNumber,
  priority,
  validate,
  validCUI,
  validEmail,
  verdict,
} from '../src/lib/calc.js';
import { finance } from '../src/lib/finance.js';

const base = { weight: 13, rate: 6, perPallet: 44, shifts: 2, handle: 'da' };

test('parses Romanian and English decimals, rejects text', () => {
  assert.equal(parseNumber('7,4'), 7.4);
  assert.equal(parseNumber('7.4'), 7.4);
  assert.ok(Number.isNaN(parseNumber('1O')));
  assert.ok(Number.isNaN(parseNumber('')));
});

test('brief figures: 44 x 13 kg at 6/min fills a pallet every 7.3 min', () => {
  const f = figures(base);
  assert.equal(f.minutesPerPallet.toFixed(1), '7.3');
  assert.equal(figures({ ...base, weight: 5, perPallet: 100 }).minutesPerPallet.toFixed(1), '16.7');
  assert.equal(Math.round(f.tonnesPerShift), 37); // 6 x 480 x 13 kg
});

test('reference formats are compatible', () => {
  assert.equal(assess({ ...base, rate: 7.4 }).verdict.level, 'ok');
  assert.equal(assess({ ...base, weight: 5, perPallet: 100, rate: 8.6 }).verdict.level, 'ok');
});

test('13 kg above 7.4/min needs evaluation; above 8.6/min is outside the tested domain', () => {
  assert.equal(assess({ ...base, rate: 8 }).verdict.level, 'check');
  assert.equal(assess({ ...base, rate: 9 }).verdict.level, 'no');
});

test('payload: 18 kg bucket plus gripper needs the extended range, 25 kg is outside', () => {
  const p18 = criteria({ ...base, weight: 18 }).find((c) => c.id === 'payload');
  assert.equal(p18.status, 'check');
  assert.equal(assess({ ...base, weight: 25 }).verdict.level, 'no');
});

test('unknowns do not block a positive verdict but are counted', () => {
  const v = verdict(criteria(base));
  assert.equal(v.level, 'ok');
  assert.equal(v.unknown, 2); // separators and network not answered yet
  assert.equal(v.confirmed, 5);
  const v2 = verdict(criteria({ ...base, separators: true, network: 'PROFINET' }));
  assert.equal(v2.confirmed, 7);
});

test('handle missing asks for evaluation; non-native network is flagged', () => {
  assert.equal(assess({ ...base, handle: 'nu' }).verdict.level, 'check');
  assert.equal(criteria({ ...base, network: 'alta' }).find((c) => c.id === 'network').status, 'check');
});

test('bottleneck statement says when the robot is not the limit', () => {
  assert.equal(bottleneck(base).robotIsLimit, false);
  assert.equal(bottleneck({ ...base, rate: 8 }).robotIsLimit, true);
});

test('validation catches missing, wrong and absurd values', () => {
  const r = validate({ weight: '1O', rate: '0', perPallet: '', shifts: 2, handle: 'da' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.weight.includes('cifre'));
  assert.ok(r.errors.rate.includes('între'));
  assert.ok(r.errors.perPallet.includes('lipsește'));
  assert.equal(validate({ ...base, weight: '13', rate: '6,5' }).ok, true);
});

test('nearest Tech-Con hub', () => {
  assert.equal(nearestHub('CJ').name, 'Timișoara');
  assert.equal(nearestHub('SV').name, 'Iași');
  assert.equal(nearestHub('PH').name, 'Dragomirești-Deal');
  assert.equal(nearestHub('XX'), null);
});

test('CUI check digit and e-mail', () => {
  assert.equal(validCUI('12345674'), true);
  assert.equal(validCUI('RO 12345674'), true);
  assert.equal(validCUI('12345675'), false);
  assert.equal(validCUI('abc'), false);
  assert.equal(validEmail('ana@fabrica-demo.ro'), true);
  assert.equal(validEmail('ana@fabrica'), false);
});

test('priority', () => {
  assert.equal(priority('ok', 3), 'A');
  assert.equal(priority('check', 2), 'B');
  assert.equal(priority('no', 3), 'C');
});

test('finance: thresholds the shareholders asked about', () => {
  const f = finance();
  assert.equal(f.contributionPerCell, 20000);
  assert.equal(f.cellsBeforeTax, 17); // 17 x 20,000 - 30,000 = 310,000
  assert.equal(f.cellsAfterTax, 20); // (20 x 20,000 - 30,000) x 0.84 = 310,800
  assert.equal(finance({ otherCosts: 50000 }).cellsAfterTax, 22);
  assert.equal(finance({ otherCosts: 100000 }).cellsAfterTax, 25);
  assert.equal(finance({ otherCosts: 200000 }).cellsAfterTax, 30);
  const at22 = finance().at(22);
  assert.equal(at22.resultAfterPromo, 410000);
  assert.equal(Math.round(at22.headroomOtherCosts), 52857); // unplanned cost 22 cells absorb
});
