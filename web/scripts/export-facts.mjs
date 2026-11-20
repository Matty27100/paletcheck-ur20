// Writes the shared numbers to data/facts.json for the Python document builders.
import { writeFileSync, mkdirSync } from 'node:fs';
import { COUNTIES, FACTS } from '../src/lib/facts.js';
import { finance } from '../src/lib/finance.js';

const total = FACTS.budget.reduce((s, l) => s + l.eur, 0);
if (total !== FACTS.finance.promoBudget) throw new Error(`Budget lines total ${total}, expected ${FACTS.finance.promoBudget}`);
const f = finance();
const out = {
  ...FACTS,
  counties: COUNTIES,
  derived: {
    contributionPerCell: f.contributionPerCell,
    cellsBeforeTax: f.cellsBeforeTax,
    cellsAfterTax: f.cellsAfterTax,
    at17: f.at(17),
    at20: f.at(20),
    at22: f.at(22),
  },
};
mkdirSync(new URL('../../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../data/facts.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('data/facts.json written; budget total', total);
