/** Русское склонение: plural(5, ['упражнение', 'упражнения', 'упражнений']) → «упражнений». */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
