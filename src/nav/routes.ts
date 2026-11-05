// Список «внутренних» экранов, которые открываются поверх вкладок.

export type Route =
  | { name: 'exercise'; id: string }
  | { name: 'exerciseEdit'; id?: string; onSaved?: (id: string) => void }
  | { name: 'templateEdit'; id?: string }
  | { name: 'measurementEdit'; id?: string }
  | { name: 'data' }
  | { name: 'workout'; sessionId: string }
  | { name: 'workoutSummary'; sessionId: string }
  | {
      name: 'pickExercises';
      title?: string;
      /** Уже выбранные — их не показываем повторно */
      exclude?: string[];
      /** Выбор одного упражнения (для замены) вместо нескольких */
      single?: boolean;
      /** С какой группы мышц открыть фильтр (для «Заменить упражнение») */
      initialGroup?: import('../db/types').MuscleGroup;
      onPick: (ids: string[]) => void;
    };

export type StackEntry = Route & {
  key: string;
  /** экран доигрывает анимацию ухода и сейчас будет убран */
  leaving?: boolean;
  /** как экран появляется: выезжает справа (по умолчанию) или проявляется на месте */
  enter?: 'slide' | 'fade';
};
