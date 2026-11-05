import { fmtNum } from './format';

/** 12 500 → «12,5 т», 850 → «850 кг», 0 → «—» */
export function compactKgText(kg: number): string {
  if (!kg) return '—';
  return kg >= 1000 ? `${fmtNum(Math.round(kg / 100) / 10)} т` : `${fmtNum(Math.round(kg))} кг`;
}
