// Резервная копия: все данные приложения в одном JSON. Этот же формат используется
// и для файла, и для облака Telegram.
import { db } from '../db/db';
import type { BodyMeasurement, Exercise, Profile, Session, SetEntry, WorkoutTemplate } from '../db/types';
import { restTimer } from '../workout/restTimer';

export const BACKUP_APP = 'gym-diary';
export const BACKUP_VERSION = 1;

export interface BackupData {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  sessions: Session[];
  sets: SetEntry[];
  measurements: BodyMeasurement[];
  /** профиль с фото; в копиях до появления профиля этого поля нет */
  profile?: Profile[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  data: BackupData;
}

export interface BackupCounts {
  sessions: number;
  sets: number;
  templates: number;
  measurements: number;
  customExercises: number;
}

/** Собрать копию всех данных. */
export async function buildBackup(): Promise<BackupFile> {
  const [exercises, templates, sessions, sets, measurements, profile] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.measurements.toArray(),
    db.profile.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: { exercises, templates, sessions, sets, measurements, profile },
  };
}

export function countsOf(data: BackupData): BackupCounts {
  return {
    sessions: data.sessions.filter((s) => s.finishedAt !== null).length,
    sets: data.sets.filter((s) => s.isDone).length,
    templates: data.templates.length,
    measurements: data.measurements.length,
    customExercises: data.exercises.filter((e) => e.isCustom).length,
  };
}

/** Текущие данные устройства — для сводки на экране «Данные». */
export async function currentCounts(): Promise<BackupCounts> {
  return countsOf((await buildBackup()).data);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const hasId = (v: unknown) => isObj(v) && typeof v.id === 'string' && v.id.length > 0;

/**
 * Разобрать и проверить копию. Возвращает понятную ошибку, если файл не наш или повреждён.
 */
export function parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл повреждён или это не файл копии (не удалось прочитать JSON).' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) {
    return { ok: false, error: 'Это не файл копии дневника тренировок.' };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'Копия сделана более новой версией приложения. Обновите приложение и попробуйте снова.' };
  }
  const d = raw.data;
  const keys: (keyof BackupData)[] = ['exercises', 'templates', 'sessions', 'sets', 'measurements'];
  for (const k of keys) {
    const list = d[k];
    if (!Array.isArray(list) || !list.every(hasId)) {
      return { ok: false, error: `Копия повреждена: раздел «${k}» не читается.` };
    }
  }
  // Подходы без тренировки или с нечисловыми значениями отбрасываем, чтобы не сломать экраны
  const sessionIds = new Set((d.sessions as Session[]).map((s) => s.id));
  const sets = (d.sets as SetEntry[]).filter(
    (s) => sessionIds.has(s.sessionId) && Number.isFinite(s.weight) && Number.isFinite(s.reps),
  );
  // Профиль — необязательный раздел; берём только корректную запись «me»
  const profile = Array.isArray(d.profile)
    ? (d.profile as Profile[]).filter((p) => isObj(p) && p.id === 'me' && typeof p.name === 'string')
    : [];
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      data: { ...(d as unknown as BackupData), sets, profile },
    },
  };
}

/**
 * Восстановить копию.
 * merge — добавить к текущим данным (записи с одинаковым id заменяются версией из копии);
 * replace — полностью заменить данные устройства содержимым копии.
 */
export async function restoreBackup(backup: BackupFile, mode: 'merge' | 'replace') {
  const { exercises, templates, sessions, sets, measurements, profile = [] } = backup.data;
  const tables = [db.exercises, db.templates, db.sessions, db.sets, db.measurements, db.profile];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.map((t) => t.clear()));
    }
    await db.exercises.bulkPut(exercises);
    await db.templates.bulkPut(templates);
    await db.sessions.bulkPut(sessions);
    await db.sets.bulkPut(sets);
    await db.measurements.bulkPut(measurements);
    // При «добавить к текущим» профиль из копии не затирает уже заполненный профиль
    if (profile.length && (mode === 'replace' || !(await db.profile.get('me')))) await db.profile.bulkPut(profile);
  });
  if (mode === 'replace') restTimer.stop();
}

/** Имя файла копии: gym-diary-2026-11-05.json */
export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `gym-diary-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
