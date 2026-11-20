import { FACTS } from './facts.js';

// The shareholders' question: how many delivered cells reach the net profit target?
export function finance({ otherCosts = 0, taxRate = FACTS.finance.taxRate } = {}) {
  const { price, directCost, promoBudget, targetNetProfit } = FACTS.finance;
  const contributionPerCell = price - directCost;
  const needBeforeTax = targetNetProfit + promoBudget + otherCosts;
  const needAfterTax = targetNetProfit / (1 - taxRate) + promoBudget + otherCosts;
  const at = (cells) => {
    const resultAfterPromo = cells * contributionPerCell - promoBudget;
    const net = (resultAfterPromo - otherCosts) * (1 - taxRate);
    return {
      cells,
      revenue: cells * price,
      directCost: cells * directCost,
      resultAfterPromo,
      net,
      promoPerCell: promoBudget / cells,
      // Other costs these cells could absorb and still hit the target after tax.
      headroomOtherCosts: resultAfterPromo - targetNetProfit / (1 - taxRate),
    };
  };
  return {
    contributionPerCell,
    cellsBeforeTax: Math.ceil(needBeforeTax / contributionPerCell - 1e-9),
    cellsAfterTax: Math.ceil(needAfterTax / contributionPerCell - 1e-9),
    at,
  };
}
