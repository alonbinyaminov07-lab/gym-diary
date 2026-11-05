/** Расчётный разовый максимум (1ПМ) по формуле Эпли: вес × (1 + повторы / 30). */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
