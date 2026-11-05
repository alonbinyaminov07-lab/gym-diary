import { getActiveSession, startWorkout } from '../db/workout';
import { useNav } from '../nav/Nav';
import { confirmDialog, haptic } from '../telegram/telegram';

/** Начать тренировку. Если уже идёт другая — предлагает вернуться к ней. */
export function useStartWorkout() {
  const nav = useNav();
  return async (templateId: string | null) => {
    const active = await getActiveSession();
    if (active) {
      if (await confirmDialog(`Сейчас идёт тренировка «${active.name}». Вернуться к ней?`, { ok: 'Вернуться', cancel: 'Остаться' })) {
        nav.push({ name: 'workout', sessionId: active.id });
      }
      return;
    }
    const id = await startWorkout(templateId);
    haptic.medium();
    nav.push({ name: 'workout', sessionId: id });
  };
}
