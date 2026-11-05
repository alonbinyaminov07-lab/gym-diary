import type { Exercise, Session, SetEntry } from '../../db/types';
import { tonnage } from '../../db/workout';
import { fmtDurationWords, fmtNum } from '../../utils/format';
import { fmtTime } from '../../utils/dates';
import { plural } from '../../utils/plural';
import { PlateMark } from '../PlateMark';

/** Проведённая тренировка: время, длительность, тоннаж и все подходы по упражнениям. */
export function SessionCard({
  session,
  sets,
  exercisesById,
  onOpenExercise,
  onMenu,
}: {
  session: Session;
  sets: SetEntry[];
  exercisesById: Map<string, Exercise>;
  onOpenExercise: (id: string) => void;
  onMenu: () => void;
}) {
  const done = sets.filter((s) => s.isDone);
  const work = done.filter((s) => !s.isWarmup);
  const duration = (session.finishedAt ?? session.startedAt) - session.startedAt;
  // Порядок упражнений как в тренировке; плюс те, что вдруг не попали в список
  const order = [...session.exerciseIds, ...new Set(done.map((s) => s.exerciseId))].filter(
    (id, i, arr) => arr.indexOf(id) === i && done.some((s) => s.exerciseId === id),
  );

  return (
    <article className="card session-card">
      <header className="session-head">
        <div className="session-title">
          <span className="session-name">{session.name}</span>
          <span className="session-time">
            {fmtTime(session.startedAt)}–{session.finishedAt ? fmtTime(session.finishedAt) : '…'}
          </span>
        </div>
        <button className="icon-btn ex-menu" onClick={onMenu} aria-label="Действия с тренировкой">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </header>

      <div className="session-stats">
        <span>
          <b>{fmtDurationWords(duration)}</b>
          длительность
        </span>
        <span>
          <b>{fmtNum(tonnage(done))} кг</b>
          тоннаж
        </span>
        <span>
          <b>{work.length}</b>
          {plural(work.length, ['подход', 'подхода', 'подходов'])}
        </span>
      </div>

      <div className="session-exercises">
        {order.map((exId) => {
          const ex = exercisesById.get(exId);
          const exSets = done.filter((s) => s.exerciseId === exId).sort((a, b) => a.order - b.order);
          const working = exSets.filter((s) => !s.isWarmup);
          const warm = exSets.length - working.length;
          return (
            <button key={exId} className="session-ex" onClick={() => onOpenExercise(exId)}>
              {ex && <PlateMark group={ex.muscleGroup} size="sm" />}
              <span className="session-ex-main">
                <span className="session-ex-name">{ex?.name ?? 'Удалённое упражнение'}</span>
                <span className="session-ex-sets">
                  {working.map((s) => `${fmtNum(s.weight)}×${s.reps}`).join(', ')}
                  {warm > 0 && <span className="hint-inline"> и {warm} размин.</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {session.note && <p className="session-note">{session.note}</p>}
    </article>
  );
}
