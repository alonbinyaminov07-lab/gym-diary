// Местное время пользователя по его часовому поясу (например, Europe/Moscow).

export interface LocalNow {
  /** YYYY-MM-DD */
  date: string;
  /** минуты от начала суток */
  minutes: number;
  /** 1 — понедельник … 7 — воскресенье */
  weekday: number;
}

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localNow(ms: number, tz: string): LocalNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms));
  } catch {
    return localNow(ms, 'UTC');
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: WD[get('weekday')] ?? 1,
  };
}

/** Местная дата YYYY-MM-DD для момента времени */
export const localDate = (ms: number, tz: string) => localNow(ms, tz).date;

/** Сколько календарных дней между двумя датами YYYY-MM-DD */
export function daysBetween(a: string, b: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** «18:00» → 1080 */
export function parseTime(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return 18 * 60;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}
