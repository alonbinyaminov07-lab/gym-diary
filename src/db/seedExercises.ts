import type { Equipment, Exercise, MuscleGroup } from './types';

// Встроенный справочник базовых упражнений.
// id постоянные (не случайные), чтобы история не ломалась при импорте/экспорте.
const list: [id: string, name: string, group: MuscleGroup, equipment: Equipment][] = [
  // Грудь
  ['bench-press', 'Жим штанги лёжа', 'chest', 'barbell'],
  ['incline-bench-press', 'Жим штанги на наклонной скамье', 'chest', 'barbell'],
  ['db-bench-press', 'Жим гантелей лёжа', 'chest', 'dumbbell'],
  ['incline-db-press', 'Жим гантелей на наклонной скамье', 'chest', 'dumbbell'],
  ['db-fly', 'Разведение гантелей лёжа', 'chest', 'dumbbell'],
  ['cable-crossover', 'Сведение рук в кроссовере', 'chest', 'cable'],
  ['machine-chest-press', 'Жим в тренажёре сидя', 'chest', 'machine'],
  ['dips', 'Отжимания на брусьях', 'chest', 'bodyweight'],
  ['push-ups', 'Отжимания от пола', 'chest', 'bodyweight'],

  // Спина
  ['deadlift', 'Становая тяга', 'back', 'barbell'],
  ['pull-ups', 'Подтягивания', 'back', 'bodyweight'],
  ['barbell-row', 'Тяга штанги в наклоне', 'back', 'barbell'],
  ['db-row', 'Тяга гантели одной рукой', 'back', 'dumbbell'],
  ['lat-pulldown', 'Тяга верхнего блока к груди', 'back', 'cable'],
  ['seated-cable-row', 'Тяга нижнего блока к поясу', 'back', 'cable'],
  ['t-bar-row', 'Тяга Т-грифа', 'back', 'barbell'],
  ['hyperextension', 'Гиперэкстензия', 'back', 'bodyweight'],

  // Ноги
  ['squat', 'Приседания со штангой', 'legs', 'barbell'],
  ['front-squat', 'Фронтальные приседания', 'legs', 'barbell'],
  ['leg-press', 'Жим ногами', 'legs', 'machine'],
  ['hack-squat', 'Гакк-приседания', 'legs', 'machine'],
  ['romanian-deadlift', 'Румынская тяга', 'legs', 'barbell'],
  ['db-lunges', 'Выпады с гантелями', 'legs', 'dumbbell'],
  ['bulgarian-split-squat', 'Болгарские сплит-приседания', 'legs', 'dumbbell'],
  ['leg-extension', 'Разгибание ног в тренажёре', 'legs', 'machine'],
  ['leg-curl', 'Сгибание ног в тренажёре', 'legs', 'machine'],
  ['standing-calf-raise', 'Подъём на носки стоя', 'legs', 'machine'],

  // Плечи
  ['ohp', 'Жим штанги стоя (армейский)', 'shoulders', 'barbell'],
  ['seated-db-press', 'Жим гантелей сидя', 'shoulders', 'dumbbell'],
  ['lateral-raise', 'Махи гантелями в стороны', 'shoulders', 'dumbbell'],
  ['rear-delt-raise', 'Махи гантелями в наклоне', 'shoulders', 'dumbbell'],
  ['upright-row', 'Тяга штанги к подбородку', 'shoulders', 'barbell'],
  ['face-pull', 'Тяга каната к лицу', 'shoulders', 'cable'],

  // Бицепс
  ['barbell-curl', 'Подъём штанги на бицепс', 'biceps', 'barbell'],
  ['db-curl', 'Подъём гантелей на бицепс', 'biceps', 'dumbbell'],
  ['hammer-curl', 'Молотки с гантелями', 'biceps', 'dumbbell'],
  ['preacher-curl', 'Сгибания на скамье Скотта', 'biceps', 'barbell'],
  ['cable-curl', 'Сгибания рук на нижнем блоке', 'biceps', 'cable'],

  // Трицепс
  ['skull-crusher', 'Французский жим лёжа', 'triceps', 'barbell'],
  ['rope-pushdown', 'Разгибания на блоке с канатом', 'triceps', 'cable'],
  ['close-grip-bench', 'Жим лёжа узким хватом', 'triceps', 'barbell'],
  ['overhead-db-extension', 'Разгибание гантели из-за головы', 'triceps', 'dumbbell'],
  ['bench-dips', 'Обратные отжимания от скамьи', 'triceps', 'bodyweight'],

  // Пресс
  ['crunches', 'Скручивания', 'abs', 'bodyweight'],
  ['hanging-leg-raise', 'Подъём ног в висе', 'abs', 'bodyweight'],
  ['plank', 'Планка', 'abs', 'bodyweight'],
  ['cable-crunch', 'Скручивания на блоке', 'abs', 'cable'],
  ['ab-wheel', 'Ролик для пресса', 'abs', 'bodyweight'],

  // Кардио
  ['treadmill', 'Беговая дорожка', 'cardio', 'machine'],
  ['exercise-bike', 'Велотренажёр', 'cardio', 'machine'],
  ['rowing-machine', 'Гребной тренажёр', 'cardio', 'machine'],
  ['jump-rope', 'Скакалка', 'cardio', 'bodyweight'],
];

export const SEED_EXERCISES: Exercise[] = list.map(([id, name, muscleGroup, equipment]) => ({
  id,
  name,
  muscleGroup,
  equipment,
  notes: '',
  isCustom: false,
}));
