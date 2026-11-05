import { todayISO } from '../db/db';

/** Дата YYYY-MM-DD из года, месяца (0–11) и дня. */
export function isoOf(year: number, month: number, day: number): string {
  return todayISO(new Date(year, month, day));
}

/**
 * Клетки месячного календаря, неделя начинается с понедельника.
 * null — пустая клетка до 1-го числа или после последнего.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** «Ноябрь 2026» */
export function monthTitle(year: number, month: number): string {
  const name = new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/** Время «18:05» из метки времени. */
export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
