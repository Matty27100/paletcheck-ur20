// "Compared with today": what the client's palletizing costs now, what changes with
// one or more UR20 cells, what the cells cost and how long until they pay back.
// Estimates from editable assumptions, never a guarantee. Out of scope (brief, p. 3):
// wrapping, transport and shipping — no savings are attributed to them.

import { FACTS } from './facts.js';
import { testedRateFor } from './calc.js';

export const IMPACT_DEFAULTS = {
  operatorsBefore: FACTS.reference.operatorsPerShiftBefore, // 2 per shift at the reference client
  monthlyCostEur: 1500, // total employer cost per operator; INS April 2026 food-industry net 4.373 lei, grossed up (team estimate)
  workingDays: 250,
  swapMinutesPerPallet: 3, // operator time per full pallet: swap plus separator sheet (assumption)
  horizonYears: 5,
};

export const PRICE_PER_CELL = FACTS.finance.price; // scenario price: integrated cell, installation, training

export const cellsNeeded = (weight, rate) => Math.max(1, Math.ceil(rate / testedRateFor(weight) - 1e-9));

export function impact(line, opts = {}) {
  const o = { ...IMPACT_DEFAULTS, ...opts };
  const { weight, rate, perPallet, shifts, shiftHours = FACTS.assumptions.shiftHours } = line;
  const cells = Math.min(3, Math.max(1, opts.cells ?? cellsNeeded(weight, rate)));
  const shiftMin = shiftHours * 60;
  const yearShifts = shifts * o.workingDays;

  const capacity = cells * testedRateFor(weight);
  const palletsPerShift = (rate * shiftMin) / perPallet;
  const liftsPerShift = rate * shiftMin;

  // People time per shift, in hours.
  const hoursBefore = o.operatorsBefore * shiftHours;
  const hoursAfter = Math.min(hoursBefore, (palletsPerShift * o.swapMinutesPerPallet) / 60);
  const hoursFreedYear = (hoursBefore - hoursAfter) * yearShifts;
  const fteFreed = hoursFreedYear / (shiftHours * o.workingDays);

  const hourlyCost = (o.monthlyCostEur * 12) / (shiftHours * o.workingDays);
  const costBeforeYear = hoursBefore * yearShifts * hourlyCost;
  const costAfterYear = hoursAfter * yearShifts * hourlyCost;
  const savingYear = costBeforeYear - costAfterYear;

  const investment = cells * PRICE_PER_CELL;
  const bucketsHorizon = liftsPerShift * yearShifts * o.horizonYears;

  return {
    cells,
    cellsNeeded: cellsNeeded(weight, rate),
    capacity,
    capacityMargin: capacity / rate - 1, // >0: cells faster than the line
    liftsPerOperatorBefore: liftsPerShift / o.operatorsBefore,
    tonnesPerOperatorBefore: (liftsPerShift * weight) / 1000 / o.operatorsBefore,
    tonnesYear: (liftsPerShift * weight * yearShifts) / 1000,
    hoursBefore,
    hoursAfter,
    hoursFreedYear,
    fteFreed,
    costBeforeYear,
    costAfterYear,
    savingYear,
    investment,
    paybackYears: savingYear > 0 ? investment / savingYear : null,
    perMonthOverHorizon: investment / (o.horizonYears * 12),
    perBucketOverHorizon: investment / bucketsHorizon,
    horizonYears: o.horizonYears,
    assumptions: o,
  };
}
