import { useEffect, useRef, useState } from 'react';
import { restTimer, useRestTimer } from '../../workout/restTimer';
import { haptic, isTelegram } from '../../telegram/telegram';
import { fmtRest } from '../../utils/format';

/** Плашка таймера отдыха внизу экрана тренировки. Вибрирует по окончании. */
export function RestTimerBar() {
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
