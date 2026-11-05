// Профиль: чтение, сохранение, производные показатели (возраст, ИМТ, серия недель).
import { db, todayISO } from './db';
import { saveMeasurement } from './repo';
import { mondayOf } from './stats';
import type { Profile, Session } from './types';
import { tg } from '../telegram/telegram';

/** Профиль из базы; если его ещё нет — заготовка с именем из Telegram. */
export async function loadProfile(): Promise<Profile> {
  const p = await db.profile.get('me');
  return p ?? { id: 'me', name: telegramUser()?.first_name ?? '', updatedAt: 0 };
}

export async function saveProfile(p: Omit<Profile, 'id' | 'updatedAt'>) {
  await db.profile.put({ ...p, id: 'me', updatedAt: Date.now() });
}

/** Записать текущий вес: это обычный замер тела на сегодня (дополнит сегодняшний, если он есть). */
export async function saveCurrentWeight(weight: number) {
  await saveMeasurement({ date: todayISO(), weight });
}

export interface TgUserInfo {
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export function telegramUser(): TgUserInfo | undefined {
  return tg?.initDataUnsafe?.user;
}

/** Полных лет на сегодня */
export function ageFrom(birthDate?: string): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Индекс массы тела и его словесная оценка */
export function bmi(weight?: number, heightCm?: number): { value: number; label: string } | null {
  if (!weight || !heightCm) return null;
  const v = weight / (heightCm / 100) ** 2;
  if (!Number.isFinite(v)) return null;
  const label = v < 18.5 ? 'ниже нормы' : v < 25 ? 'норма' : v < 30 ? 'выше нормы' : 'сильно выше нормы';
  return { value: Math.round(v * 10) / 10, label };
}

/** Последний и предыдущий записанный вес тела */
export async function weightInfo(): Promise<{ current?: number; previous?: number; date?: string }> {
  const list = (await db.measurements.orderBy('date').toArray()).filter((m) => m.weight !== undefined);
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  return { current: last?.weight, previous: prev?.weight, date: last?.date };
}

export interface Activity {
  total: number;
  tonnage: number;
  /** сколько недель подряд (по понедельникам) была хотя бы одна тренировка */
  streakWeeks: number;
  /** дней с последней тренировки (null — тренировок не было) */
  daysSinceLast: number | null;
}

export async function activity(): Promise<Activity> {
  const sessions = (await db.sessions.toArray()).filter((s): s is Session => s.finishedAt !== null);
  const sets = sessions.length
    ? (await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()).filter((s) => s.isDone && !s.isWarmup)
    : [];

  // Серия недель: идём назад от текущей недели. Текущая неделя без тренировок серию не обрывает —
  // она ещё не закончилась.
  const weeks = new Set(
    sessions.map((s) => {
      const [y, m, d] = s.date.split('-').map(Number);
      return todayISO(mondayOf(new Date(y, m - 1, d)));
    }),
  );
  const cursor = mondayOf(new Date());
  if (!weeks.has(todayISO(cursor))) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(todayISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }

  const last = sessions.reduce<number | null>((max, s) => Math.max(max ?? 0, s.finishedAt!), null);
  return {
    total: sessions.length,
    tonnage: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    streakWeeks: streak,
    daysSinceLast: last === null ? null : Math.floor((Date.now() - last) / 86400000),
  };
}

/**
 * Подготовить выбранное фото: обрезать до квадрата по центру, уменьшить до 512×512
 * и сжать в JPEG (~40–80 КБ) — чтобы хранилось на телефоне и не раздувало резервную копию.
 */
export function prepareAvatar(file: File, size = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Не удалось обработать фото'));
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Этот файл не похож на фотографию. Выберите снимок в формате JPG или PNG.'));
    };
    img.src = url;
  });
}
