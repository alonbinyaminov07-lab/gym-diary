// Работа с Telegram: проверка подписи данных из Mini App и отправка сообщений.
import type { Env } from './types';

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export interface TgUser {
  id: number;
  first_name?: string;
}

/**
 * Проверка initData по алгоритму Telegram: подпись HMAC-SHA256 ключом, выведенным из токена бота.
 * Подделать её без токена невозможно — так сервер знает, что данные пришли от этого пользователя.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function validateInitData(initData: string, botToken: string, maxAgeSec = 7 * 24 * 3600): Promise<TgUser | null> {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const expected = hex(await hmac(secret, checkString));
  if (expected !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/** Секрет, по которому сервер узнаёт настоящие запросы от Telegram (выводится из токена). */
export async function webhookSecret(botToken: string): Promise<string> {
  return hex(await hmac(enc.encode('gym-diary-webhook'), botToken)).slice(0, 48);
}

export type SendResult = 'ok' | 'blocked' | 'error';

/** Отправить сообщение с кнопкой «Открыть дневник». */
export async function sendMessage(env: Env, chatId: number, text: string, button = 'Открыть дневник'): Promise<SendResult> {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: button, web_app: { url: env.APP_URL } }]] },
  };
  if (env.DRY_RUN === '1') {
    console.log(`[DRY_RUN] → ${chatId}\n${text}`);
    return 'ok';
  }
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return 'ok';
  // 403 — пользователь заблокировал бота или ни разу не нажимал «Старт»
  if (res.status === 403) return 'blocked';
  console.warn('sendMessage failed', res.status, await res.text());
  return 'error';
}

export async function callApi(env: Env, method: string, payload: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/** Экранирование для parse_mode=HTML */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
