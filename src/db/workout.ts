// Всё, что происходит с тренировкой: начать, записать подходы, завершить.
// Каждое изменение сразу пишется в базу — поэтому незавершённая тренировка
// переживает закрытие приложения.
import { db, todayISO, uid } from './db';
import type { Exercise, Session, SetEntry } from './types';
import { e1rm } from '../utils/records';

export const DEFAULT_REST = 90;

/** Тренировка, которая идёт прямо сейчас (не завершена). */
export function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.finishedAt === null).first();
}

/** Выполненные подходы упражнения с последней завершённой тренировки (кроме текущей). */
export async function previousSets(exerciseId: string, excludeSessionId?: string): Promise<SetEntry[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const ids = [...new Set(sets.map((s) => s.sessionId))].filter((id) => id !== excludeSessionId);
  const sessions = (await db.sessions.bulkGet(ids)).filter((s): s is Session => !!s && s.finishedAt !== null);
  if (!sessions.length) return [];
  const last = sessions.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
  return sets.filter((s) => s.sessionId === last.id && s.isDone).sort((a, b) => a.order - b.order);
}

/** Новые подходы, предзаполненные значениями прошлой тренировки. */
function makeSets(sessionId: string, exerciseId: string, count: number, prev: SetEntry[], fallbackReps: number, startOrder = 0) {
  const prevWork = prev.filter((s) => !s.isWarmup);
  return Array.from({ length: count }, (_, i): SetEntry => {
    const p = prevWork[i] ?? prevWork[prevWork.length - 1];
    return {
      id: uid(),
      sessionId,
      exerciseId,
      order: startOrder + i,
      weight: p?.weight ?? 0,
      reps: p?.reps ?? fallbackReps,
      isWarmup: false,
      isDone: false,
      note: '',
    };
  });
}

/** Начать тренировку по шаблону (или свободную, если templateId = null). */
export async function startWorkout(templateId: string | null): Promise<string> {
  const template = templateId ? await db.templates.get(templateId) : undefined;
  const id = uid();
  const now = Date.now();
  const session: Session = {
    id,
    date: todayISO(),
    templateId: template?.id ?? null,
    name: template?.name ?? 'Свободная тренировка',
    startedAt: now,
    finishedAt: null,
    note: '',
    exerciseIds: template?.exercises.map((e) => e.exerciseId) ?? [],
    exerciseNotes: {},
    restSec: Object.fromEntries(template?.exercises.map((e) => [e.exerciseId, e.restSec]) ?? []),
  };
  const sets: SetEntry[] = [];
  for (const te of template?.exercises ?? []) {
    const prev = await previousSets(te.exerciseId);
    sets.push(...makeSets(id, te.exerciseId, te.sets, prev, te.repsMin));
  }
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.add(session);
    await db.sets.bulkAdd(sets);
  });
  return id;
}

/** Добавить упражнения в идущую тренировку. */
export async function addExercisesToSession(sessionId: string, exerciseIds: string[]) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const newIds = exerciseIds.filter((id) => !session.exerciseIds.includes(id));
  const sets: SetEntry[] = [];
  for (const exId of newIds) {
    const prev = await previousSets(exId, sessionId);
    const count = prev.filter((s) => !s.isWarmup).length || 3;
    sets.push(...makeSets(sessionId, exId, count, prev, 10));
  }
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.update(sessionId, { exerciseIds: [...session.exerciseIds, ...newIds] });
    await db.sets.bulkAdd(sets);
  });
}

/** «+ подход»: копирует значения прошлой тренировки на этой позиции или последнего подхода. */
export async function addSet(sessionId: string, exerciseId: string) {
  const current = (await db.sets.where('[sessionId+exerciseId]').equals([sessionId, exerciseId]).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const workIndex = current.filter((s) => !s.isWarmup).length;
  const prevWork = (await previousSets(exerciseId, sessionId)).filter((s) => !s.isWarmup);
  const source = prevWork[workIndex] ?? current[current.length - 1];
  await db.sets.add({
    id: uid(),
    sessionId,
    exerciseId,
    order: (current[current.length - 1]?.order ?? -1) + 1,
    weight: source?.weight ?? 0,
    reps: source?.reps ?? 10,
    isWarmup: false,
    isDone: false,
    note: '',
  });
}

export function updateSet(id: string, patch: Partial<SetEntry>) {
  return db.sets.update(id, patch);
}

export function deleteSet(id: string) {
  return db.sets.delete(id);
}

export async function removeExerciseFromSession(sessionId: string, exerciseId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const notes = { ...session.exerciseNotes };
  delete notes[exerciseId];
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('[sessionId+exerciseId]').equals([sessionId, exerciseId]).delete();
    await db.sessions.update(sessionId, {
      exerciseIds: session.exerciseIds.filter((id) => id !== exerciseId),
      exerciseNotes: notes,
    });
  });
}

/**
 * Заменить упражнение на аналог. Раскладка подходов сохраняется (сколько было и какие из них
 * разминочные), а значения веса и повторов берутся из истории нового упражнения.
 */
export async function replaceExercise(sessionId: string, oldId: string, newId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session || session.exerciseIds.includes(newId)) return;
  const oldSets = (await db.sets.where('[sessionId+exerciseId]').equals([sessionId, oldId]).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const prev = await previousSets(newId, sessionId);
  const prevWork = prev.filter((s) => !s.isWarmup);
  const prevWarm = prev.filter((s) => s.isWarmup);
  const layout = oldSets.length ? oldSets.map((s) => s.isWarmup) : [false, false, false];
  let w = 0;
  let r = 0;
  const sets = layout.map((isWarmup, i): SetEntry => {
    const p = isWarmup ? prevWarm[r++] : (prevWork[w++] ?? prevWork[prevWork.length - 1]);
    return {
      id: uid(),
      sessionId,
      exerciseId: newId,
      order: i,
      weight: p?.weight ?? 0,
      reps: p?.reps ?? 10,
      isWarmup,
      isDone: false,
      note: '',
    };
  });
  const rest = { ...session.restSec, [newId]: session.restSec[oldId] ?? DEFAULT_REST };
  delete rest[oldId];
  const notes = { ...session.exerciseNotes };
  delete notes[oldId];
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.bulkDelete(oldSets.map((s) => s.id));
    await db.sets.bulkAdd(sets);
    await db.sessions.update(sessionId, {
      exerciseIds: session.exerciseIds.map((id) => (id === oldId ? newId : id)),
      restSec: rest,
      exerciseNotes: notes,
    });
  });
}

export async function setExerciseNote(sessionId: string, exerciseId: string, note: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  await db.sessions.update(sessionId, { exerciseNotes: { ...session.exerciseNotes, [exerciseId]: note } });
}

export async function setExerciseRest(sessionId: string, exerciseId: string, sec: number) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  await db.sessions.update(sessionId, { restSec: { ...session.restSec, [exerciseId]: sec } });
}

export function setSessionNote(sessionId: string, note: string) {
  return db.sessions.update(sessionId, { note });
}

/** Завершить: невыполненные подходы удаляются, фиксируется время окончания. */
export async function finishWorkout(sessionId: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets
      .where('sessionId')
      .equals(sessionId)
      .filter((s) => !s.isDone)
      .delete();
    await db.sessions.update(sessionId, { finishedAt: Date.now() });
  });
}

/** Отменить тренировку целиком. */
export async function discardWorkout(sessionId: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** Тоннаж = сумма (вес × повторы) выполненных рабочих подходов. */
export function tonnage(sets: SetEntry[]): number {
  return sets.filter((s) => s.isDone && !s.isWarmup).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export interface RecordItem {
  exercise: Exercise;
  kind: 'weight' | 'e1rm';
  value: number;
  previous: number;
}

export interface WorkoutSummary {
  session: Session;
  durationMs: number;
  tonnage: number;
  setsDone: number;
  exercisesDone: number;
  records: RecordItem[];
  /** «Блины» для итогового экрана: упражнения в порядке выполнения, цвет — группа мышц */
  plates: { exerciseId: string; group: Exercise['muscleGroup']; sets: number }[];
}

/** Итоги тренировки и новые рекорды (по сравнению со всеми прошлыми тренировками). */
export async function computeSummary(sessionId: string): Promise<WorkoutSummary | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.isDone);
  const exIds = [...new Set(sets.map((s) => s.exerciseId))];
  const records: RecordItem[] = [];

  for (const exId of exIds) {
    const exercise = await db.exercises.get(exId);
    if (!exercise) continue;
    const mine = sets.filter((s) => s.exerciseId === exId && !s.isWarmup && s.weight > 0);
    if (!mine.length) continue;

    const all = await db.sets.where('exerciseId').equals(exId).toArray();
    const sessIds = [...new Set(all.map((s) => s.sessionId))].filter((id) => id !== sessionId);
    const earlier = new Set(
      (await db.sessions.bulkGet(sessIds))
        .filter((s): s is Session => !!s && s.finishedAt !== null && s.startedAt < session.startedAt)
        .map((s) => s.id),
    );
    const before = all.filter((s) => earlier.has(s.sessionId) && s.isDone && !s.isWarmup);
    // Рекорд считаем, только если есть с чем сравнить
    if (!before.length) continue;

    const maxW = Math.max(...mine.map((s) => s.weight));
    const prevW = Math.max(...before.map((s) => s.weight));
    if (maxW > prevW) records.push({ exercise, kind: 'weight', value: maxW, previous: prevW });

    const best = Math.max(...mine.map((s) => e1rm(s.weight, s.reps)));
    const prevBest = Math.max(...before.map((s) => e1rm(s.weight, s.reps)));
    if (best > prevBest + 0.01) records.push({ exercise, kind: 'e1rm', value: best, previous: prevBest });
  }

  const groups = new Map((await db.exercises.bulkGet(exIds)).filter((e) => !!e).map((e) => [e!.id, e!.muscleGroup]));
  const order = [...session.exerciseIds.filter((id) => exIds.includes(id)), ...exIds.filter((id) => !session.exerciseIds.includes(id))];
  const plates = order
    .filter((id) => groups.has(id))
    .map((id) => ({
      exerciseId: id,
      group: groups.get(id)!,
      sets: sets.filter((s) => s.exerciseId === id && !s.isWarmup).length,
    }));

  return {
    session,
    plates,
    durationMs: (session.finishedAt ?? Date.now()) - session.startedAt,
    tonnage: tonnage(sets),
    setsDone: sets.filter((s) => !s.isWarmup).length,
    exercisesDone: exIds.length,
    records,
  };
}

