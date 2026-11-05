export interface Env {
  USERS: KVNamespace;
  BOT_TOKEN: string;
  APP_URL: string;
  APP_ORIGIN: string;
  /** "1" — ничего не отправлять в Telegram, а печатать сообщения в журнал (для локальной проверки) */
  DRY_RUN?: string;
}

/** Настройки напоминаний — приходят из приложения. */
export interface BotSettings {
  afterWorkout: boolean;
  inactivity: boolean;
  inactivityDays: number;
  weekly: boolean;
  planned: boolean;
  /** дни тренировок: 1 — понедельник … 7 — воскресенье */
  plannedDays: number[];
  /** время напоминаний «ЧЧ:ММ» по местному времени */
  time: string;
}

export const DEFAULT_SETTINGS: BotSettings = {
  afterWorkout: true,
  inactivity: true,
  inactivityDays: 3,
  weekly: true,
  planned: true,
  plannedDays: [1, 3, 5],
  time: '18:00',
};

/** Короткая сводка тренировки — всё, что серверу нужно для сообщений. */
export interface WorkoutBrief {
  id: string;
  name: string;
  startedAt: number;
  finishedAt: number;
  tonnage: number;
  sets: number;
  exercises: number;
  records: { exercise: string; kind: 'weight' | 'e1rm'; value: number; previous: number }[];
}

export interface UserRec {
  userId: number;
  firstName: string;
  tz: string;
  settings: BotSettings;
  lastWorkoutAt: number | null;
  /** сводки тренировок за последние ~6 недель — для итогов недели */
  workouts: (Omit<WorkoutBrief, 'records'> & { records: number })[];
  /** когда (местная дата) какое напоминание уже отправлялось */
  sent: { inactivity?: string; weekly?: string; planned?: string };
  /** пользователь заблокировал бота — не пишем */
  blocked?: boolean;
  updatedAt: number;
}
