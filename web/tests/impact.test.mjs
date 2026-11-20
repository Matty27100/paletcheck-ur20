import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsNeeded, impact } from '../src/lib/impact.js';

const line = { weight: 13, rate: 6, perPallet: 44, shifts: 2 };

test('cells needed follow the tested rate per format', () => {
  assert.equal(cellsNeeded(13, 6), 1);
  assert.equal(cellsNeeded(13, 7.4), 1);
  assert.equal(cellsNeeded(13, 9), 2); // 9 / 7.4
  assert.equal(cellsNeeded(5, 9), 2); // 9 / 8.6
  assert.equal(cellsNeeded(13, 16), 3);
});

test('people time: 2 operators x 8 h before; pallet swaps only after', () => {
  const r = impact(line);
  assert.equal(r.hoursBefore, 16);
  // 6 x 480 / 44 = 65.45 pallets x 3 min = 196 min
  assert.equal(r.hoursAfter.toFixed(2), '3.27');
  assert.equal(Math.round(r.hoursFreedYear), Math.round((16 - 3.2727) * 2 * 250));
});

test('money: saving, investment, payback, per-month and per-bucket views', () => {
  const r = impact(line);
  // hourly = 1500 x 12 / 2000 = 9 EUR
  assert.equal(Math.round(r.costBeforeYear), 72000); // 16 h x 500 shifts x 9
  assert.equal(Math.round(r.savingYear), Math.round((16 - 3.2727) * 500 * 9));
  assert.equal(r.investment, 130000);
  assert.ok(r.paybackYears > 2 && r.paybackYears < 2.5);
  assert.equal(Math.round(r.perMonthOverHorizon), 2167);
  assert.equal(r.perBucketOverHorizon.toFixed(4), '0.0181'); // 130,000 / (2,880 x 500 x 5)
});

test('more cells raise capacity and investment, not the saving', () => {
  const one = impact(line, { cells: 1 });
  const two = impact(line, { cells: 2 });
  assert.equal(two.investment, 260000);
  assert.equal(two.capacity.toFixed(1), '14.8');
  assert.equal(two.savingYear, one.savingYear);
  assert.equal(impact(line, { cells: 9 }).cells, 3);
});

test('assumptions are editable', () => {
  const r = impact(line, { operatorsBefore: 3, monthlyCostEur: 1800 });
  assert.ok(r.savingYear > impact(line).savingYear);
  assert.equal(impact({ ...line, rate: 0.1 }, { operatorsBefore: 0 }).paybackYears, null);
});
