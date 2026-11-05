// Тексты сообщений бота. У каждого типа несколько вариантов — чтобы бот не звучал как автомат.
import { esc } from './telegram';
import type { UserRec, WorkoutBrief } from './types';

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function plural(n: number, forms: [string, string, string]) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return forms[0];
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return forms[1];
  return forms[2];
}

const num = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

/** 12 500 → «12,5 т», 850 → «850 кг» */
const tons = (kg: number) => (kg >= 1000 ? `${num(kg / 1000)} т` : `${num(kg)} кг`);

function duration(min: number) {
  if (min < 1) return 'меньше минуты';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${m} мин`;
}

// ---------- После тренировки ----------

const AFTER_PRAISE = [
  'Отличная работа! 💪',
  'Тренировка в копилке! 🔥',
  'Есть! Ещё один шаг вперёд. 💪',
  'Сделано. Так и растут результаты. 🏋️',
];

const AFTER_MOTIVATION = [
  'Сила — это сумма тренировок, которые ты не пропустил.',
  'Теперь главное — восстановиться: поесть, попить воды и выспаться.',
  'Каждая тренировка — кирпич в фундамент. Продолжаем строить.',
  'Мышцы растут во время отдыха. Хорошего восстановления!',
  'Регулярность важнее рекордов. Ты на правильном пути.',
];

const RECORD_MOTIVATION = [
  'Новый рекорд — лучшее доказательство, что всё работает! 🏆',
  'Рекорды не случаются сами — ты их заработал. 🏆',
  'Планка поднята. Следующая цель уже ждёт! 🏆',
];

export function afterWorkoutText(w: WorkoutBrief): string {
  const min = Math.round((w.finishedAt - w.startedAt) / 60000);
  const lines = [
    `<b>${pick(AFTER_PRAISE)}</b>`,
    '',
    `«${esc(w.name)}»`,
    `⏱ ${duration(min)}`,
    `🏋️ ${tons(w.tonnage)} тоннажа, ${w.sets} ${plural(w.sets, ['подход', 'подхода', 'подходов'])}`,
  ];
  if (w.records.length) {
    lines.push('', '🏆 <b>Новые рекорды:</b>');
    for (const r of w.records.slice(0, 5)) {
      const what = r.kind === 'weight' ? 'вес' : '1ПМ';
      lines.push(`• ${esc(r.exercise)} — ${what} ${num(r.value)} кг (было ${num(r.previous)})`);
    }
  }
  lines.push('', w.records.length ? pick(RECORD_MOTIVATION) : pick(AFTER_MOTIVATION));
  return lines.join('\n');
}

// ---------- Давно не было тренировки ----------

export function inactivityText(rec: UserRec, days: number): string {
  const d = `${days} ${plural(days, ['день', 'дня', 'дней'])}`;
  const name = rec.firstName ? `${esc(rec.firstName)}, ` : '';
  const variants =
    days >= 7
      ? [
          `${name}уже ${d} без тренировок. Самое сложное — начать заново, а дальше пойдёт. Даже лёгкая тренировка сегодня лучше, чем никакой. 💪`,
          `${name}${d} без зала. Форма уходит медленно, но возвращать её легче, пока перерыв небольшой. Давай сегодня?`,
        ]
      : [
          `${name}последняя тренировка была ${d} назад. Самое время снова в зал! 🏋️`,
          `${name}${d} отдыха — мышцы восстановились и ждут нагрузки. Сегодня тренировка? 💪`,
          `${name}прошло ${d} с последней тренировки. Не дай перерыву затянуться!`,
        ];
  return pick(variants);
}

// ---------- В день тренировки ----------

export function plannedText(rec: UserRec): string {
  const name = rec.firstName ? `${esc(rec.firstName)}, ` : '';
  return pick([
    `${name}сегодня по плану тренировка! 💪`,
    `${name}напоминаю: сегодня день тренировки. Удачи в зале! 🏋️`,
    `${name}сегодня тренировка по расписанию. Собирай сумку! 🎒`,
  ]);
}

// ---------- Итоги недели ----------

export function weeklyText(rec: UserRec, week: UserRec['workouts']): string {
  if (!week.length) {
    return pick([
      'Итоги недели: тренировок не было. Новая неделя — новый старт. Запланируй хотя бы две! 💪',
      'На этой неделе без тренировок. Ничего страшного — главное, начать следующую. Жду тебя в зале! 🏋️',
    ]);
  }
  const tonnage = week.reduce((s, w) => s + w.tonnage, 0);
  const sets = week.reduce((s, w) => s + w.sets, 0);
  const records = week.reduce((s, w) => s + w.records, 0);
  const minutes = week.reduce((s, w) => s + Math.round((w.finishedAt - w.startedAt) / 60000), 0);
  const lines = [
    '<b>📊 Итоги недели</b>',
    '',
    `🗓 ${week.length} ${plural(week.length, ['тренировка', 'тренировки', 'тренировок'])}`,
    `⏱ ${duration(minutes)} в зале`,
    `🏋️ ${tons(tonnage)} тоннажа, ${sets} ${plural(sets, ['подход', 'подхода', 'подходов'])}`,
  ];
  if (records) lines.push(`🏆 ${records} ${plural(records, ['новый рекорд', 'новых рекорда', 'новых рекордов'])}`);
  lines.push(
    '',
    week.length >= 3
      ? pick(['Отличная неделя! Так держать. 🔥', 'Стабильность — твоя суперсила. 💪'])
      : pick(['Хорошая работа! На следующей неделе можно добавить ещё одну тренировку. 💪', 'Неплохо! Держим темп. 🏋️']),
  );
  return lines.join('\n');
}

// ---------- Приветствие ----------

export function welcomeText(firstName?: string): string {
  return [
    `Привет${firstName ? `, ${esc(firstName)}` : ''}! 👋`,
    '',
    'Я — дневник силовых тренировок. Записывай подходы, следи за рекордами и прогрессом.',
    '',
    'Я буду присылать итоги после тренировок, напоминания и итоги недели. Настроить их можно в приложении: «Прогресс» → иконка настроек.',
  ].join('\n');
}
