import Dexie, { type Table } from 'dexie';
import type { BodyMeasurement, Exercise, Profile, Session, SetEntry, WorkoutTemplate } from './types';
import { SEED_EXERCISES } from './seedExercises';

/**
 * Локальная база данных в браузере (IndexedDB) через библиотеку Dexie.
 * Данные хранятся на устройстве и доступны без интернета.
 */
export class GymDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<Session, string>;
  sets!: Table<SetEntry, string>;
  measurements!: Table<BodyMeasurement, string>;
  profile!: Table<Profile, string>;

  constructor() {
    super('gym-diary');
    // Строка после имени таблицы — список полей, по которым нужен быстрый поиск (индексы).
    this.version(1).stores({
      exercises: 'id, name, muscleGroup, isCustom',
      templates: 'id, name, updatedAt',
      sessions: 'id, date, templateId, startedAt',
      sets: 'id, sessionId, exerciseId, [sessionId+exerciseId]',
      measurements: 'id, date',
    });
    // Версия 2: добавлен профиль. Существующие данные не трогаются — Dexie просто добавит таблицу.
    this.version(2).stores({
      profile: 'id',
    });

    // Срабатывает один раз — при самом первом создании базы: заполняем справочник.
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(SEED_EXERCISES);
    });
  }
}

export const db = new GymDB();

/** Генерация уникального id. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Сегодняшняя дата в формате YYYY-MM-DD по местному времени. */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
