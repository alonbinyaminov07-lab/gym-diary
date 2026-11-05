// Сервер бота «Дневник тренировок».
//
//  POST /api/sync     — приложение присылает настройки напоминаний, часовой пояс и дату последней тренировки
//  POST /api/workout  — приложение сообщает о завершённой тренировке → бот сразу присылает итоги
//  POST /api/test     — тестовое сообщение (кнопка в настройках приложения)
//  POST /tg           — сообщения от Telegram (команда /start)
//  GET  /setup        — один раз: подключить сервер к Telegram (webhook и список команд)
//  каждые 30 минут    — проверка, кому пора отправить напоминание
import { afterWorkoutText, welcomeText } from './messages';
import { decide } from './schedule';
import { callApi, sendMessage, validateInitData, webhookSecret, type TgUser } from './telegram';
import { DEFAULT_SETTINGS, type BotSettings, type Env, type UserRec, type WorkoutBrief } from './types';

const KEY = (id: number) => `u:${id}`;
/** Храним сводки тренировок только за последние 42 дня — больше для сообщений не нужно */
const KEEP_MS = 42 * 24 * 3600 * 1000;

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

const json = (env: Env, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(env) } });

/** Проверить и привести настройки из приложения к безопасному виду */
function cleanSettings(raw: unknown): BotSettings {
  const s = (typeof raw === 'object' && raw ? raw : {}) as Partial<BotSettings>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const days = Array.isArray(s.plannedDays)
    ? [...new Set(s.plannedDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
    : DEFAULT_SETTINGS.plannedDays;
  return {
    afterWorkout: bool(s.afterWorkout, DEFAULT_SETTINGS.afterWorkout),
    inactivity: bool(s.inactivity, DEFAULT_SETTINGS.inactivity),
    inactivityDays: Math.min(30, Math.max(1, Math.round(Number(s.inactivityDays) || DEFAULT_SETTINGS.inactivityDays))),
    weekly: bool(s.weekly, DEFAULT_SETTINGS.weekly),
    planned: bool(s.planned, DEFAULT_SETTINGS.planned),
    plannedDays: days,
    time: typeof s.time === 'string' && /^\d{1,2}:\d{2}$/.test(s.time) ? s.time : DEFAULT_SETTINGS.time,
  };
}

function cleanTz(tz: unknown): string {
  if (typeof tz !== 'string' || tz.length > 64) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

async function loadUser(env: Env, user: TgUser): Promise<UserRec> {
  const rec = await env.USERS.get<UserRec>(KEY(user.id), 'json');
  return (
    rec ?? {
      userId: user.id,
      firstName: user.first_name ?? '',
      tz: 'UTC',
      settings: DEFAULT_SETTINGS,
      lastWorkoutAt: null,
      workouts: [],
      sent: {},
      updatedAt: Date.now(),
    }
  );
}

const saveUser = (env: Env, rec: UserRec) =>
  env.USERS.put(KEY(rec.userId), JSON.stringify({ ...rec, updatedAt: Date.now() }));

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return typeof body === 'object' && body ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function authed(env: Env, body: Record<string, unknown> | null): Promise<TgUser | null> {
  return body ? validateInitData(String(body.initData ?? ''), env.BOT_TOKEN) : null;
}

// ---------- Обработчики ----------

async function handleSync(req: Request, env: Env) {
  const body = await readBody(req);
  const user = await authed(env, body);
  if (!user || !body) return json(env, { ok: false, error: 'unauthorized' }, 401);
  const rec = await loadUser(env, user);
  rec.firstName = user.first_name ?? rec.firstName;
  rec.tz = cleanTz(body.tz);
  rec.settings = cleanSettings(body.settings);
  const last = Number(body.lastWorkoutAt);
  if (Number.isFinite(last) && last > 0 && last <= Date.now() + 60_000) {
    rec.lastWorkoutAt = Math.max(rec.lastWorkoutAt ?? 0, last);
  }
  rec.blocked = false;
  await saveUser(env, rec);
  return json(env, { ok: true });
}

async function handleWorkout(req: Request, env: Env) {
  const body = await readBody(req);
  const user = await authed(env, body);
  if (!user || !body) return json(env, { ok: false, error: 'unauthorized' }, 401);
  const w = body.workout as WorkoutBrief | undefined;
  if (!w || typeof w.id !== 'string' || !Number.isFinite(w.finishedAt) || !Number.isFinite(w.startedAt)) {
    return json(env, { ok: false, error: 'bad workout' }, 400);
  }
  const rec = await loadUser(env, user);
  rec.tz = cleanTz(body.tz ?? rec.tz);
  if (body.settings) rec.settings = cleanSettings(body.settings);

  // Повторная отправка той же тренировки (например, при плохой связи) — не дублируем сообщение
  const isNew = !rec.workouts.some((x) => x.id === w.id);
  if (isNew) {
    const brief = {
      id: w.id,
      name: String(w.name ?? 'Тренировка').slice(0, 80),
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      tonnage: Math.max(0, Number(w.tonnage) || 0),
      sets: Math.max(0, Math.round(Number(w.sets) || 0)),
      exercises: Math.max(0, Math.round(Number(w.exercises) || 0)),
      records: Array.isArray(w.records) ? w.records.length : 0,
    };
    rec.workouts = [...rec.workouts, brief].filter((x) => x.finishedAt > Date.now() - KEEP_MS);
    rec.lastWorkoutAt = Math.max(rec.lastWorkoutAt ?? 0, w.finishedAt);
    await saveUser(env, rec);

    if (rec.settings.afterWorkout) {
      const records = (Array.isArray(w.records) ? w.records : []).slice(0, 5).map((r) => ({
        exercise: String(r.exercise ?? '').slice(0, 80),
        kind: r.kind === 'e1rm' ? ('e1rm' as const) : ('weight' as const),
        value: Number(r.value) || 0,
        previous: Number(r.previous) || 0,
      }));
      const result = await sendMessage(env, rec.userId, afterWorkoutText({ ...w, ...brief, records }));
      if (result === 'blocked') await saveUser(env, { ...rec, blocked: true });
    }
  }
  return json(env, { ok: true, new: isNew });
}

/** Кнопка «Прислать тестовое сообщение» в настройках приложения */
async function handleTest(req: Request, env: Env) {
  const body = await readBody(req);
  const user = await authed(env, body);
  if (!user) return json(env, { ok: false, error: 'unauthorized' }, 401);
  const result = await sendMessage(
    env,
    user.id,
    '✅ Связь с ботом работает. Напоминания и итоги тренировок будут приходить сюда.',
  );
  return json(env, { ok: result === 'ok', result });
}

async function handleTelegram(req: Request, env: Env) {
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== (await webhookSecret(env.BOT_TOKEN))) {
    return new Response('forbidden', { status: 403 });
  }
  const update = (await readBody(req)) as {
    message?: { chat: { id: number; type: string }; from?: TgUser; text?: string };
    my_chat_member?: { chat: { id: number }; new_chat_member: { status: string } };
  } | null;

  // Пользователь заблокировал/разблокировал бота
  const member = update?.my_chat_member;
  if (member) {
    const rec = await env.USERS.get<UserRec>(KEY(member.chat.id), 'json');
    if (rec) await saveUser(env, { ...rec, blocked: member.new_chat_member.status === 'kicked' });
  }

  const msg = update?.message;
  if (msg && msg.chat.type === 'private' && msg.text?.startsWith('/')) {
    const cmd = msg.text.split(/[\s@]/)[0];
    if (cmd === '/start' || cmd === '/help') {
      await sendMessage(env, msg.chat.id, welcomeText(msg.from?.first_name));
    } else if (cmd === '/settings') {
      await sendMessage(env, msg.chat.id, 'Настройки напоминаний — в приложении: «Прогресс» → иконка настроек.', 'Открыть настройки');
    }
  }
  return new Response('ok');
}

/** Подключить сервер к Telegram. Безопасно вызывать сколько угодно раз. */
async function handleSetup(req: Request, env: Env) {
  const origin = new URL(req.url).origin;
  const webhook = await callApi(env, 'setWebhook', {
    url: `${origin}/tg`,
    secret_token: await webhookSecret(env.BOT_TOKEN),
    allowed_updates: ['message', 'my_chat_member'],
  });
  const commands = await callApi(env, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'О боте' },
      { command: 'settings', description: 'Настройки напоминаний' },
    ],
  });
  const ok = (webhook as { ok?: boolean }).ok && (commands as { ok?: boolean }).ok;
  return new Response(ok ? 'Готово: бот подключён к серверу.' : `Ошибка: ${JSON.stringify({ webhook, commands })}`, {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// ---------- Напоминания по расписанию ----------

async function runSchedule(env: Env, nowMs = Date.now()) {
  let cursor: string | undefined;
  do {
    const page = await env.USERS.list({ prefix: 'u:', cursor });
    for (const k of page.keys) {
      const rec = await env.USERS.get<UserRec>(k.name, 'json');
      if (!rec) continue;
      const d = decide(rec, nowMs);
      if (!d) continue;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: rec.tz }).format(new Date(nowMs));
      const result = await sendMessage(env, rec.userId, d.text);
      // Отмечаем отправку даже при ошибке сети — лучше пропустить одно напоминание, чем заспамить
      await saveUser(env, { ...rec, sent: { ...rec.sent, [d.kind]: today }, blocked: result === 'blocked' });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    try {
      if (req.method === 'POST' && url.pathname === '/api/sync') return await handleSync(req, env);
      if (req.method === 'POST' && url.pathname === '/api/workout') return await handleWorkout(req, env);
      if (req.method === 'POST' && url.pathname === '/api/test') return await handleTest(req, env);
      if (req.method === 'POST' && url.pathname === '/tg') return await handleTelegram(req, env);
      if (req.method === 'GET' && url.pathname === '/setup') return await handleSetup(req, env);
      if (req.method === 'GET' && url.pathname === '/') return new Response('Gym diary bot is running');
      return new Response('not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return json(env, { ok: false, error: 'server error' }, 500);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSchedule(env));
  },
} satisfies ExportedHandler<Env>;
