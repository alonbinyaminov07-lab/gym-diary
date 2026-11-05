// Связь приложения с сервером бота: настройки напоминаний и сводки тренировок.
// Работает только внутри Telegram — там у приложения есть подписанные данные пользователя (initData),
// по которым сервер понимает, кому писать. История тренировок на сервер не уходит —
// только короткая сводка завершённой тренировки и дата последней.
import { db } from '../db/db';
import { computeSummary } from '../db/workout';
import { isTelegram, tg } from '../telegram/telegram';

/** Адрес сервера бота (Cloudflare Worker). Пусто — сервер ещё не подключён. */
export const BOT_API_URL = 'https://gym-diary-bot.aigymbot.workers.dev';

export interface BotSettings {
  afterWorkout: boolean;
  inactivity: boolean;
  inactivityDays: number;
  weekly: boolean;
  planned: boolean;
  /** 1 — понедельник … 7 — воскресенье */
  plannedDays: number[];
  /** «ЧЧ:ММ» по местному времени */
  time: string;
}

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  afterWorkout: true,
  inactivity: true,
  inactivityDays: 3,
  weekly: true,
  planned: true,
  plannedDays: [1, 3, 5],
  time: '18:00',
};

const KEY = 'gym-diary:bot-settings';

export function loadBotSettings(): BotSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_BOT_SETTINGS, ...(JSON.parse(raw) as Partial<BotSettings>) } : DEFAULT_BOT_SETTINGS;
  } catch {
    return DEFAULT_BOT_SETTINGS;
  }
}

function storeBotSettings(s: BotSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* хранилище недоступно — настройки уйдут на сервер, но не запомнятся на устройстве */
  }
}

/** Бот может писать: приложение открыто из Telegram и сервер подключён */
export const botAvailable = () => isTelegram && !!tg?.initData && !!BOT_API_URL;

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

async function post(path: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(BOT_API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg!.initData, tz: timeZone(), ...payload }),
  });
}

async function lastWorkoutAt(): Promise<number | null> {
  const last = await db.sessions.orderBy('startedAt').filter((s) => s.finishedAt !== null).last();
  return last?.finishedAt ?? null;
}

/** Отправить серверу настройки, часовой пояс и дату последней тренировки. */
export async function syncBot(settings = loadBotSettings()): Promise<boolean> {
  if (!botAvailable()) return false;
  try {
    const res = await post('/api/sync', { settings, lastWorkoutAt: await lastWorkoutAt() });
    return res.ok;
  } catch {
    return false;
  }
}

/** Сохранить настройки на устройстве и сообщить серверу. */
export async function saveBotSettings(s: BotSettings): Promise<boolean> {
  storeBotSettings(s);
  return syncBot(s);
}

/** Сообщить о завершённой тренировке — бот пришлёт итоги. В фоне, ошибки не мешают. */
export async function reportWorkout(sessionId: string): Promise<void> {
  if (!botAvailable()) return;
  try {
    const sum = await computeSummary(sessionId);
    if (!sum || sum.session.finishedAt === null) return;
    await post('/api/workout', {
      settings: loadBotSettings(),
      workout: {
        id: sum.session.id,
        name: sum.session.name,
        startedAt: sum.session.startedAt,
        finishedAt: sum.session.finishedAt,
        tonnage: sum.tonnage,
        sets: sum.setsDone,
        exercises: sum.exercisesDone,
        records: sum.records.map((r) => ({
          exercise: r.exercise.name,
          kind: r.kind,
          value: Math.round(r.value * 10) / 10,
          previous: Math.round(r.previous * 10) / 10,
        })),
      },
    });
  } catch (e) {
    console.warn('Не удалось сообщить боту о тренировке:', e);
  }
}

/** Попросить бота прислать тестовое сообщение. */
export async function sendTestMessage(): Promise<'ok' | 'blocked' | 'error'> {
  if (!botAvailable()) return 'error';
  try {
    const res = await post('/api/test', {});
    const data = (await res.json()) as { ok?: boolean; result?: string };
    if (data.ok) return 'ok';
    return data.result === 'blocked' ? 'blocked' : 'error';
  } catch {
    return 'error';
  }
}
