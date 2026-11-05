// Резервная копия в облаке Telegram (CloudStorage).
//
// Ограничения Telegram: значение — до 4096 символов, ключей — до 1024 на пользователя.
// Поэтому копия режется на куски по 4000 символов. Чтобы обрыв связи посреди записи не испортил
// последнюю удачную копию, используются две «ячейки» (a и b): новая копия пишется в свободную,
// и только когда все куски записаны, «указатель» bk_meta переключается на неё.
import { isTelegram, tg } from '../telegram/telegram';
import { buildBackup, countsOf, parseBackup, type BackupCounts, type BackupFile } from './backupData';

const CHUNK = 4000;
/** Две ячейки по 500 кусков + указатель укладываются в лимит 1024 ключа (~2 МБ на копию) */
const MAX_CHUNKS = 500;
const META_KEY = 'bk_meta';
const PARALLEL = 4;

type Slot = 'a' | 'b';

export interface CloudMeta {
  v: 1;
  slot: Slot;
  chunks: number;
  size: number;
  savedAt: number;
  counts: BackupCounts;
}

/** Минимальный интерфейс хранилища — настоящий Telegram или отладочная замена в браузере. */
interface KV {
  set(key: string, value: string): Promise<void>;
  getMany(keys: string[]): Promise<Record<string, string>>;
  keys(): Promise<string[]>;
  remove(keys: string[]): Promise<void>;
}

function telegramKV(): KV | null {
  const cs = tg?.CloudStorage;
  if (!isTelegram || !cs || !tg?.isVersionAtLeast('6.9')) return null;
  const wrap = <T,>(fn: (cb: (err: string | null, v?: T) => void) => void) =>
    new Promise<T>((resolve, reject) => fn((err, v) => (err ? reject(new Error(err)) : resolve(v as T))));
  return {
    set: (k, v) => wrap<boolean>((cb) => cs.setItem(k, v, cb)).then(() => undefined),
    getMany: (keys) => wrap<Record<string, string>>((cb) => cs.getItems(keys, cb)).then((r) => r ?? {}),
    keys: () => wrap<string[]>((cb) => cs.getKeys(cb)).then((r) => r ?? []),
    remove: (keys) =>
      keys.length ? wrap<boolean>((cb) => cs.removeItems(keys, cb)).then(() => undefined) : Promise.resolve(),
  };
}

/**
 * Отладочная замена облака для обычного браузера при разработке (npm run dev):
 * те же ограничения на размер, хранится в localStorage. В собранном приложении не используется.
 */
function devKV(): KV | null {
  if (!import.meta.env.DEV) return null;
  const P = 'gym-diary:cloud-dev:';
  return {
    async set(k, v) {
      if (v.length > 4096) throw new Error('Значение длиннее 4096 символов');
      localStorage.setItem(P + k, v);
    },
    async getMany(keys) {
      return Object.fromEntries(keys.map((k) => [k, localStorage.getItem(P + k) ?? '']));
    },
    async keys() {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(P))
        .map((k) => k.slice(P.length));
    },
    async remove(keys) {
      keys.forEach((k) => localStorage.removeItem(P + k));
    },
  };
}

const kv = (): KV | null => telegramKV() ?? devKV();

export type CloudMode = 'telegram' | 'dev' | 'unavailable';

export function cloudMode(): CloudMode {
  if (telegramKV()) return 'telegram';
  if (devKV()) return 'dev';
  return 'unavailable';
}

async function readMeta(store: KV): Promise<CloudMeta | null> {
  const raw = (await store.getMany([META_KEY]))[META_KEY];
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as CloudMeta;
    return m && m.v === 1 && (m.slot === 'a' || m.slot === 'b') ? m : null;
  } catch {
    return null;
  }
}

/** Сведения о последней копии в облаке (или null, если копий нет). */
export async function cloudInfo(): Promise<CloudMeta | null> {
  const store = kv();
  return store ? readMeta(store) : null;
}

/** Выполнить задачи не больше PARALLEL одновременно. */
async function runLimited(tasks: (() => Promise<void>)[]) {
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) await tasks[i++]();
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, tasks.length) }, worker));
}

/** Сохранить копию в облако. */
export async function saveToCloud(): Promise<CloudMeta> {
  const store = kv();
  if (!store) throw new Error('Облако Telegram доступно только внутри Telegram.');

  const backup = await buildBackup();
  const text = JSON.stringify(backup);
  const chunks = Math.ceil(text.length / CHUNK);
  if (chunks > MAX_CHUNKS) {
    throw new Error('Данных слишком много для облака Telegram. Сохраните копию в файл.');
  }

  const prev = await readMeta(store);
  const slot: Slot = prev?.slot === 'a' ? 'b' : 'a';

  // 1. Пишем все куски в свободную ячейку
  await runLimited(
    Array.from({ length: chunks }, (_, i) => () => store.set(`bk_${slot}_${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK))),
  );

  // 2. Переключаем указатель — с этого момента новая копия считается действующей
  const meta: CloudMeta = { v: 1, slot, chunks, size: text.length, savedAt: backup.exportedAt, counts: countsOf(backup.data) };
  await store.set(META_KEY, JSON.stringify(meta));

  // 3. Убираем старую ячейку и лишние куски прошлых копий (ошибки уборки не критичны)
  try {
    const stale = (await store.keys()).filter((k) => {
      const m = /^bk_([ab])_(\d+)$/.exec(k);
      if (!m) return false;
      return m[1] !== slot || Number(m[2]) >= chunks;
    });
    for (let i = 0; i < stale.length; i += 50) await store.remove(stale.slice(i, i + 50));
  } catch {
    /* уберём в следующий раз */
  }
  return meta;
}

/** Загрузить последнюю копию из облака. */
export async function loadFromCloud(): Promise<BackupFile> {
  const store = kv();
  if (!store) throw new Error('Облако Telegram доступно только внутри Telegram.');
  const meta = await readMeta(store);
  if (!meta) throw new Error('В облаке пока нет копии.');

  const keys = Array.from({ length: meta.chunks }, (_, i) => `bk_${meta.slot}_${i}`);
  let text = '';
  for (let i = 0; i < keys.length; i += 20) {
    const part = await store.getMany(keys.slice(i, i + 20));
    for (const k of keys.slice(i, i + 20)) {
      if (!part[k]) throw new Error('Копия в облаке неполная. Сохраните новую копию.');
      text += part[k];
    }
  }
  if (text.length !== meta.size) throw new Error('Копия в облаке повреждена. Сохраните новую копию.');
  const parsed = parseBackup(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.backup;
}

/** Тихое автосохранение после тренировки: ошибки не мешают пользователю. */
export function autoCloudBackup() {
  if (cloudMode() === 'unavailable') return;
  saveToCloud().catch((e) => console.warn('Автокопия в облако не удалась:', e));
}
