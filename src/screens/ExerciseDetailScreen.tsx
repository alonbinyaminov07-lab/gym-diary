import { Suspense, lazy } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { EQUIPMENT, MUSCLE_GROUPS, type Session, type SetEntry } from '../db/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlateDot } from '../components/PlateMark';
import { useNav } from '../nav/Nav';
import { fmtDate, fmtNum } from '../utils/format';

// Графики грузятся отдельно — только когда открывают карточку упражнения
const ExerciseProgress = lazy(() =>
  import('../components/charts/ExerciseProgress').then((m) => ({ default: m.ExerciseProgress })),
);

interface HistoryItem {
  session: Session;
  sets: SetEntry[];
}

/** Карточка упражнения: описание и история подходов по датам. */
export function ExerciseDetailScreen({ id }: { id: string }) {
  const nav = useNav();
  const exercise = useLiveQuery(() => db.exercises.get(id), [id]);

  const history = useLiveQuery(async (): Promise<HistoryItem[]> => {
    const sets = await db.sets.where('exerciseId').equals(id).toArray();
    const sessionIds = [...new Set(sets.map((s) => s.sessionId))];
    const sessions = (await db.sessions.bulkGet(sessionIds)).filter(
      (s): s is Session => !!s && s.finishedAt !== null,
    );
    return sessions
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((session) => ({
        session,
        sets: sets.filter((x) => x.sessionId === session.id && x.isDone).sort((a, b) => a.order - b.order),
      }))
      .filter((h) => h.sets.length > 0);
  }, [id]);

  if (exercise === undefined) return <div className="screen" />;
  if (exercise === null) return <div className="screen">Упражнение не найдено</div>;

  return (
    <div className="screen">
      <ScreenHeader
        title={exercise.name}
        right={
          <button className="btn btn-ghost" onClick={() => nav.push({ name: 'exerciseEdit', id })}>
            Изменить
          </button>
        }
      />

      <div className="meta-row">
        <span className="pill">
          <PlateDot group={exercise.muscleGroup} />
          {MUSCLE_GROUPS[exercise.muscleGroup]}
        </span>
        <span className="pill">{EQUIPMENT[exercise.equipment]}</span>
        {exercise.isCustom && <span className="pill">своё</span>}
      </div>

      {exercise.notes && <div className="card note-card">{exercise.notes}</div>}

      <Suspense fallback={null}>
        <ExerciseProgress exerciseId={id} />
      </Suspense>

      <h2 className="group-title">История</h2>
      {history && history.length === 0 && (
        <p className="empty">Пока нет записанных подходов. Они появятся после первой тренировки с этим упражнением.</p>
      )}
      {history?.map(({ session, sets }) => (
        <div key={session.id} className="card history-card">
          <div className="history-head">
            <span className="history-date">{fmtDate(session.date)}</span>
            <span className="hint">{session.name}</span>
          </div>
          {sets.map((s, i) => (
            <div key={s.id} className={'history-set' + (s.isWarmup ? ' warmup' : '')}>
              <span className="history-set-n">{s.isWarmup ? 'Р' : i + 1}</span>
              <span>
                {fmtNum(s.weight)} кг × {s.reps}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
