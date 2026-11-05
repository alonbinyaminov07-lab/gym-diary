// Подсчёты для графиков и статистики. Учитываются только завершённые тренировки
// и только выполненные рабочие (не разминочные) подходы.
import { db, todayISO } from './db';
import type { MuscleGroup, Session, SetEntry } from './types';
import { e1rm } from '../utils/records';

const isFinished = (s: Session | undefined): s is Session => !!s && s.finishedAt !== null;
const isWorkDone = (s: SetEntry) => s.isDone && !s.isWarmup;

// ---------- Одно упражнение ----------

export interface ExercisePoint {
  sessionId: string;
  date: string;
  startedAt: number;
  maxWeight: number;
  maxReps: number;
  tonnage: number;
  bestE1rm: number;
  /** подход, давший лучший 1ПМ */
  bestSet: { weight: number; reps: number };
}

/** Точки «одна тренировка — одно значение» для графиков упражнения, по возрастанию даты. */
export async function exercisePoints(exerciseId: string): Promise<ExercisePoint[]> {
  const sets = (await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter(isWorkDone);
  const ids = [...new Set(sets.map((s) => s.sessionId))];
  const sessions = (await db.sessions.bulkGet(ids)).filter(isFinished);

  return sessions
    .map((session) => {
      const mine = sets.filter((s) => s.sessionId === session.id);
      let best = mine[0];
      for (const s of mine) if (e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps)) best = s;
      return {
        sessionId: session.id,
        date: session.date,
        startedAt: session.startedAt,
        maxWeight: Math.max(...mine.map((s) => s.weight)),
        maxReps: Math.max(...mine.map((s) => s.reps)),
        tonnage: mine.reduce((sum, s) => sum + s.weight * s.reps, 0),
        bestE1rm: e1rm(best.weight, best.reps),
        bestSet: { weight: best.weight, reps: best.reps },
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}

export interface ExerciseRecords {
  /** true — упражнение без отягощения (все веса 0): рекорды считаем по повторам */
  bodyweight: boolean;
  maxWeight?: ExercisePoint;
  bestE1rm?: ExercisePoint;
  bestTonnage?: ExercisePoint;
  maxReps?: ExercisePoint;
}

/** Личные рекорды упражнения. При равенстве побеждает более ранний результат. */
export function exerciseRecords(points: ExercisePoint[]): ExerciseRecords {
  const pick = (key: (p: ExercisePoint) => number) =>
    points.reduce<ExercisePoint | undefined>((best, p) => (!best || key(p) > key(best) ? p : best), undefined);
  const bodyweight = points.length > 0 && points.every((p) => p.maxWeight === 0);
  return {
    bodyweight,
    maxWeight: pick((p) => p.maxWeight),
    bestE1rm: pick((p) => p.bestE1rm),
    bestTonnage: pick((p) => p.tonnage),
    maxReps: pick((p) => p.maxReps),
  };
}

// ---------- Общая статистика ----------

/** Понедельник недели, в которую входит дата. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export interface WeekBucket {
  weekStart: string;
  label: string;
  count: number;
  tonnage: number;
}

/** Тренировки и тоннаж по неделям за последние `weeks` недель (включая текущую). */
export async function weeklyStats(weeks = 12): Promise<WeekBucket[]> {
  const thisMonday = mondayOf(new Date());
  const first = new Date(thisMonday);
  first.setDate(first.getDate() - (weeks - 1) * 7);

  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i * 7);
    return {
      weekStart: todayISO(d),
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''),
      count: 0,
      tonnage: 0,
    };
  });

  const sessions = await db.sessions.where('date').aboveOrEqual(todayISO(first)).filter(isFinished).toArray();
  const sets = sessions.length
    ? (await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()).filter(isWorkDone)
    : [];

  const bucketOf = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    const key = todayISO(mondayOf(new Date(y, m - 1, d)));
    return buckets.find((b) => b.weekStart === key);
  };
  const sessionBucket = new Map<string, WeekBucket | undefined>();
  for (const s of sessions) {
    const b = bucketOf(s.date);
    sessionBucket.set(s.id, b);
    if (b) b.count++;
  }
  for (const set of sets) {
    const b = sessionBucket.get(set.sessionId);
    if (b) b.tonnage += set.weight * set.reps;
  }
  return buckets;
}

export interface OverallStats {
  thisWeek: number;
  thisMonth: number;
  monthTonnage: number;
  total: number;
}

export async function overallStats(): Promise<OverallStats> {
  const now = new Date();
  const weekStart = todayISO(mondayOf(now));
  const monthStart = todayISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const all = await db.sessions.filter(isFinished).toArray();
  const month = all.filter((s) => s.date >= monthStart);
  const monthSets = month.length
    ? (await db.sets.where('sessionId').anyOf(month.map((s) => s.id)).toArray()).filter(isWorkDone)
    : [];
  return {
    thisWeek: all.filter((s) => s.date >= weekStart).length,
    thisMonth: month.length,
    monthTonnage: monthSets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    total: all.length,
  };
}

export interface WeekDay {
  date: string;
  /** группы мышц этого дня по убыванию числа подходов */
  groups: MuscleGroup[];
}

/** Текущая неделя (пн–вс): какие группы мышц тренировались в каждый день. */
export async function currentWeek(): Promise<WeekDay[]> {
  const monday = mondayOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return todayISO(d);
  });
  const sessions = await db.sessions.where('date').between(days[0], days[6], true, true).filter(isFinished).toArray();
  const sets = sessions.length
    ? (await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()).filter(isWorkDone)
    : [];
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e.muscleGroup]));
  const dateOf = new Map(sessions.map((s) => [s.id, s.date]));

  return days.map((date) => {
    const counts = new Map<MuscleGroup, number>();
    for (const s of sets) {
      if (dateOf.get(s.sessionId) !== date) continue;
      const g = exercises.get(s.exerciseId);
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return { date, groups: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g) };
  });
}

/** Сколько рабочих подходов на каждую группу мышц за последние `days` дней. */
export async function muscleGroupSets(days = 30): Promise<{ group: MuscleGroup; sets: number }[]> {
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const sessions = await db.sessions.where('date').aboveOrEqual(todayISO(from)).filter(isFinished).toArray();
  if (!sessions.length) return [];
  const sets = (await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()).filter(isWorkDone);
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e.muscleGroup]));
  const counts = new Map<MuscleGroup, number>();
  for (const s of sets) {
    const g = exercises.get(s.exerciseId);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()].map(([group, n]) => ({ group, sets: n })).sort((a, b) => b.sets - a.sets);
}
