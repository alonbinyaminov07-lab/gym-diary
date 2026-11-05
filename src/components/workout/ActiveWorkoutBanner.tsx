import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession } from '../../db/workout';
import { useNav } from '../../nav/Nav';
import { useNow } from '../../workout/restTimer';
import { fmtDuration } from '../../utils/format';

/** Плашка над нижним меню, пока идёт тренировка: можно вернуться в один тап. */
export function ActiveWorkoutBanner() {
  const nav = useNav();
  const active = useLiveQuery(() => getActiveSession(), []);
  const now = useNow(active ? 1000 : null);
  if (!active) return null;

  return (
    <>
      {/* Место в конце списка, чтобы плашка не закрывала последние строки */}
      <div className="banner-spacer" aria-hidden />
      <button className="active-banner" onClick={() => nav.push({ name: 'workout', sessionId: active.id })}>
        <span className="active-banner-dot" aria-hidden />
        <span className="active-banner-text">
          <span className="active-banner-name">{active.name}</span>
          <span className="active-banner-time">{fmtDuration(now - active.startedAt)}</span>
        </span>
        <span className="active-banner-cta">Продолжить</span>
      </button>
    </>
  );
}
