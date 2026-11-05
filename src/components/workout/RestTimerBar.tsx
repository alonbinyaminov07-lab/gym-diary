import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { restTimer, useRestTimer } from '../../workout/restTimer';
import { haptic, isTelegram } from '../../telegram/telegram';
import { fmtRest } from '../../utils/format';

/** Сколько длится уход плашки вниз (совпадает с .rest-bar-leave в styles.css) */
const LEAVE_MS = 240;

/**
 * Плашка таймера отдыха внизу экрана тренировки. Вибрирует по окончании.
 * Выезжает снизу и, когда отдых закончился или его сбросили, уезжает обратно вниз.
 */
export function RestTimerBar() {
  const view = useRestView();
  // Последний показанный вид — его и «увозим» вниз, когда плашка больше не нужна
  const last = useRef<ReactNode>(null);
  const [leaving, setLeaving] = useState<ReactNode>(null);

  useLayoutEffect(() => {
    if (view) {
      last.current = view;
      setLeaving(null);
      return;
    }
    if (!last.current) return;
    setLeaving(last.current);
    last.current = null;
    const id = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [view]);

  if (view) return view;
  if (!leaving) return null;
  return (
    <div className="rest-bar-leave" aria-hidden>
      {leaving}
    </div>
  );
}

function useRestView(): ReactNode {
  const { rest, remainingMs } = useRestTimer();
  const [doneFlash, setDoneFlash] = useState(false);
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!rest || remainingMs > 0 || firedFor.current === rest.endsAt) return;
    firedFor.current = rest.endsAt;
    // Если отдых закончился давно (приложение было закрыто) — не жужжим зря
    if (Date.now() - rest.endsAt < 5000) {
      haptic.success();
      window.setTimeout(() => haptic.warning(), 400);
      setDoneFlash(true);
      window.setTimeout(() => {
        setDoneFlash(false);
        restTimer.stop();
      }, 2500);
    } else {
      restTimer.stop();
    }
  }, [rest, remainingMs]);

  if (!rest && !doneFlash) return null;

  const sec = Math.ceil(remainingMs / 1000);
  const progress = rest ? Math.min(1, remainingMs / (rest.total * 1000)) : 0;
  const placement = isTelegram ? 'rest-bar rest-bar-tg' : 'rest-bar';

  if (doneFlash || sec === 0) {
    return (
      <div className={placement + ' rest-bar-done'} role="status">
        <span className="rest-done-text">Отдых окончен</span>
      </div>
    );
  }

  return (
    <div className={placement} role="timer" aria-label={`Отдых, осталось ${sec} секунд`}>
      <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="rest-content">
        <button className="rest-btn" onClick={() => restTimer.add(-15)} aria-label="Минус 15 секунд">
          −15
        </button>
        <div className="rest-time">
          <span className="rest-label">Отдых</span>
          <span className="rest-value">{fmtRest(sec)}</span>
        </div>
        <button className="rest-btn" onClick={() => restTimer.add(15)} aria-label="Плюс 15 секунд">
          +15
        </button>
        <button className="rest-btn rest-skip" onClick={() => restTimer.stop()}>
          Хватит
        </button>
      </div>
    </div>
  );
}
