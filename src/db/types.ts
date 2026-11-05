// Модель данных приложения. Все id — строки (UUID), чтобы экспорт/импорт
// и синхронизация между устройствами не давали конфликтов номеров.

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'cardio';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable';

export const MUSCLE_GROUPS: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  legs: 'Ноги',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  abs: 'Пресс',
  cardio: 'Кардио',
};

export const EQUIPMENT: Record<Equipment, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  machine: 'Тренажёр',
  bodyweight: 'Свой вес',
  cable: 'Блок',
};

/** Упражнение из справочника. */
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  notes: string;
  /** true — добавлено пользователем, false — из встроенного справочника */
  isCustom: boolean;
}

/** Одно упражнение внутри шаблона тренировки (например «Жим лёжа 3×8–12, отдых 120 с»). */
export interface TemplateExercise {
  exerciseId: string;
  /** Целевое число рабочих подходов */
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Отдых между подходами, секунды */
  restSec: number;
}

/** Шаблон тренировки / тренировочный день программы. Порядок упражнений = порядок в массиве. */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
  updatedAt: number;
}

/** Проведённая (или идущая прямо сейчас) тренировка. */
export interface Session {
  id: string;
  /** Дата тренировки в формате YYYY-MM-DD (локальное время) — для календаря */
  date: string;
  /** Из какого шаблона начата; null — свободная тренировка */
  templateId: string | null;
  /** Название (копируется из шаблона или «Свободная тренировка») */
  name: string;
  /** Время начала, мс (Date.now()) */
  startedAt: number;
  /** Время окончания, мс; null — тренировка ещё идёт */
  finishedAt: number | null;
  note: string;
  /** Порядок упражнений в этой тренировке (exerciseId) */
  exerciseIds: string[];
  /** Заметки к отдельным упражнениям: exerciseId → текст */
  exerciseNotes: Record<string, string>;
  /** Время отдыха по упражнениям из шаблона: exerciseId → секунды */
  restSec: Record<string, number>;
}

/** Один подход. */
export interface SetEntry {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** Порядковый номер подхода внутри упражнения (0, 1, 2…) */
  order: number;
  /** Вес в кг, шаг 0.5 */
  weight: number;
  reps: number;
  isWarmup: boolean;
  isDone: boolean;
  note: string;
}

export type Sex = 'm' | 'f';
export type Goal = 'strength' | 'mass' | 'cut' | 'fit';

export const GOALS: Record<Goal, string> = {
  strength: 'Сила',
  mass: 'Набор массы',
  cut: 'Похудение',
  fit: 'Форма и здоровье',
};

/**
 * Профиль пользователя (одна запись с id «me»).
 * Текущий вес здесь не хранится — он берётся из последнего замера тела.
 */
export interface Profile {
  id: 'me';
  name: string;
  /** фото, выбранное пользователем: квадратная JPEG-картинка в виде data:-адреса */
  photo?: string;
  sex?: Sex;
  /** дата рождения YYYY-MM-DD — возраст считается сам */
  birthDate?: string;
  heightCm?: number;
  targetWeight?: number;
  goal?: Goal;
  updatedAt: number;
}

export type MeasurementKey = 'weight' | 'chest' | 'waist' | 'hips' | 'arm' | 'thigh';

export const MEASUREMENTS: { key: MeasurementKey; label: string; unit: string }[] = [
  { key: 'weight', label: 'Вес тела', unit: 'кг' },
  { key: 'chest', label: 'Грудь', unit: 'см' },
  { key: 'waist', label: 'Талия', unit: 'см' },
  { key: 'hips', label: 'Бёдра', unit: 'см' },
  { key: 'arm', label: 'Рука', unit: 'см' },
  { key: 'thigh', label: 'Бедро', unit: 'см' },
];

/** Замеры тела. Все поля, кроме id и даты, необязательны. Размеры — в см, вес — в кг. */
export interface BodyMeasurement {
  id: string;
  date: string;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arm?: number;
  thigh?: number;
}
