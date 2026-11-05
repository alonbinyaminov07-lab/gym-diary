// Решает, какое напоминание (и нужно ли вообще) отправить пользователю прямо сейчас.
// Вызывается каждые 30 минут. За один вечер — не больше одного напоминания.
import { inactivityText, plannedText, weeklyText } from './messages';
import { daysBetween, localDate, localNow, parseTime } from './time';
import type { UserRec } from './types';

export interface Decision {
  kind: 'weekly' | 'planned' | 'inactivity';
  text: string;
}

/** Окно отправки: напоминание уходит в течение 30 минут после выбранного времени */
const WINDOW_MIN = 30;

export function decide(rec: UserRec, nowMs: number): Decision | null {
  if (rec.blocked) return null;
  const s = rec.settings;
  const now = localNow(nowMs, rec.tz);
  const start = parseTime(s.time);
  if (now.minutes < start || now.minutes >= start + WINDOW_MIN) return null;

  const today = now.date;
  const lastDate = rec.lastWorkoutAt ? localDate(rec.lastWorkoutAt, rec.tz) : null;
  const trainedToday = lastDate === today;

  // 1. Итоги недели — в воскресенье
  if (s.weekly && now.weekday === 7 && rec.sent.weekly !== today) {
    const week = rec.workouts.filter((w) => {
      const d = localDate(w.finishedAt, rec.tz);
      const diff = daysBetween(d, today);
      return diff >= 0 && diff <= 6;
    });
    return { kind: 'weekly', text: weeklyText(rec, week) };
  }

  if (trainedToday) return null;

  // 2. Сегодня день тренировки по расписанию
  if (s.planned && s.plannedDays.includes(now.weekday) && rec.sent.planned !== today) {
    return { kind: 'planned', text: plannedText(rec) };
  }

  // 3. Давно не было тренировки — не чаще, чем раз в N дней
  if (s.inactivity && lastDate) {
    const days = daysBetween(lastDate, today);
    const lastNotice = rec.sent.inactivity;
    const noticeOk = !lastNotice || daysBetween(lastNotice, today) >= s.inactivityDays;
    if (days >= s.inactivityDays && noticeOk) {
      return { kind: 'inactivity', text: inactivityText(rec, days) };
    }
  }
  return null;
}
