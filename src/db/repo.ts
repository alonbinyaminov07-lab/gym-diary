// Операции с данными (создать / изменить / удалить), чтобы экраны не работали с базой напрямую.
import { db, uid } from './db';
import type { BodyMeasurement, Exercise, TemplateExercise, WorkoutTemplate } from './types';

// ---------- Упражнения ----------

export async function saveExercise(data: Omit<Exercise, 'id'> & { id?: string }): Promise<string> {
  const id = data.id ?? uid();
  await db.exercises.put({ ...data, id });
  return id;
}

/** Есть ли по упражнению записанные подходы (тогда его нельзя удалить). */
export async function exerciseHasHistory(id: string): Promise<boolean> {
  return (await db.sets.where('exerciseId').equals(id).count()) > 0;
}

/** Удалить своё упражнение. Нельзя, если по нему уже есть записанные подходы. */
export async function deleteExercise(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const used = await db.sets.where('exerciseId').equals(id).count();
  if (used > 0) {
    return { ok: false, reason: 'По этому упражнению уже есть история тренировок — удалить его нельзя, иначе история потеряется.' };
  }
  await db.transaction('rw', db.exercises, db.templates, async () => {
    // Убираем упражнение из всех шаблонов
    const templates = await db.templates.toArray();
    for (const t of templates) {
      if (t.exercises.some((e) => e.exerciseId === id)) {
        await db.templates.update(t.id, { exercises: t.exercises.filter((e) => e.exerciseId !== id) });
      }
    }
    await db.exercises.delete(id);
  });
  return { ok: true };
}

// ---------- Шаблоны тренировок ----------

export function defaultTemplateExercise(ex: Exercise): TemplateExercise {
  const cardio = ex.muscleGroup === 'cardio';
  return {
    exerciseId: ex.id,
    sets: cardio ? 1 : 3,
    repsMin: cardio ? 10 : 8,
    repsMax: cardio ? 20 : 12,
    restSec: 90,
  };
}

export async function saveTemplate(t: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const now = Date.now();
  if (t.id) {
    const existing = await db.templates.get(t.id);
    await db.templates.put({ ...t, id: t.id, createdAt: existing?.createdAt ?? now, updatedAt: now });
    return t.id;
  }
  const id = uid();
  await db.templates.add({ ...t, id, createdAt: now, updatedAt: now });
  return id;
}

export async function deleteTemplate(id: string) {
  await db.templates.delete(id);
}

// ---------- Замеры тела ----------

/**
 * Сохранить замер. Один день — одна запись: если на эту дату замер уже есть,
 * новые значения дописываются в него (заполненные поля заменяются, остальные сохраняются).
 */
export async function saveMeasurement(m: Omit<BodyMeasurement, 'id'> & { id?: string }) {
  const sameDay = (await db.measurements.where('date').equals(m.date).toArray()).find((x) => x.id !== m.id);
  if (!sameDay) {
    const id = m.id ?? uid();
    await db.measurements.put({ ...m, id });
    return id;
  }
  const filled = Object.fromEntries(Object.entries(m).filter(([k, v]) => v !== undefined && k !== 'id'));
  await db.transaction('rw', db.measurements, async () => {
    await db.measurements.put({ ...sameDay, ...filled, id: sameDay.id });
    if (m.id) await db.measurements.delete(m.id);
  });
  return sameDay.id;
}

export function deleteMeasurement(id: string) {
  return db.measurements.delete(id);
}

export async function duplicateTemplate(id: string) {
  const t = await db.templates.get(id);
  if (!t) return;
  const now = Date.now();
  await db.templates.add({ ...t, id: uid(), name: `${t.name} (копия)`, createdAt: now, updatedAt: now });
}
