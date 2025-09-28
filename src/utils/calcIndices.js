import { HM_CONSTANTS } from "./hpiConstants.js";

export function calculateIndices(metals) {
  let sumWiQi = 0;
  let sumWi = 0;
  let hei = 0;

  for (const { metal, values } of metals) {
    const M = values;
    const { S, I } = HM_CONSTANTS[metal] || {};

    if (!S || !I) continue; // skip metals not in constants

    const Wi = 1 / S;
    const Qi = ((M - I) / (S - I)) * 100;

    sumWiQi += Wi * Qi;
    sumWi += Wi;

    hei += M / S;
  }

  const HPI = sumWi > 0 ? Math.round((sumWiQi / sumWi) * 1000) / 1000 : null;
  const HEI = Math.round(hei * 1000) / 1000;
  return { HPI, HEI };
}
