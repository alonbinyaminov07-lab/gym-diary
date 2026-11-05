import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  DEFAULT_REST,
  addExercisesToSession,
  discardWorkout,
  finishWorkout,
  removeExerciseFromSession,
  replaceExercise,
  setExerciseRest,
  setSessionNote,
  tonnage,
} from '../db/workout';
import type { Exercise } from '../db/types';
import { autoCloudBackup } from '../backup/cloudBackup';
import { ActionSheet, type SheetAction } from '../components/ActionSheet';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ExerciseBlock } from '../components/workout/ExerciseBlock';
import { RestTimerBar } from '../components/workout/RestTimerBar';
import { IconPlus } from '../components/icons';
import { useNav, useScreen } from '../nav/Nav';
import { confirmDialog, haptic, setSwipeLock } from '../telegram/telegram';
import { restTimer, useNow } from '../workout/restTimer';
import { fmtDuration, fmtNum, fmtRest } from '../utils/format';

/** Часы тренировки. Отдельный компонент: раз в секунду перерисовываются только цифры, а не весь экран. */
function WorkoutClock({ startedAt }: { startedAt: number }) {
  const now = useNow(1000);
  return <>{fmtDuration(now - startedAt)}</>;
}
import { plural } from '../utils/plural';

const REST_OPTIONS = [45, 60, 90, 120, 150, 180, 240, 300];

type Sheet = { kind: 'menu'; exercise: Exercise } | { kind: 'rest'; exercise: Exercise } | null;

/** Экран идущей тренировки. */
export function WorkoutScreen({ sessionId }: { sessionId: string }) {
  const nav = useNav();
  const { isTop } = useScreen();
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);

  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [note, setNote] = useState<string | null>(null);

  // Пока тренировка на экране: Telegram не закрывается свайпом вниз, экран не гаснет
  useEffect(() => {
    if (!isTop) return;
    setSwipeLock(true);
    let lock: WakeLockSentinel | undefined;
    // Запрет гаснуть экрану. Не везде доступен; браузер снимает его при сворачивании,
    // поэтому просим заново, когда приложение снова на экране. Любая ошибка — просто без него.
    const requestLock = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        navigator.wakeLock
          ?.request('screen')
          .then((l) => (lock = l))
          .catch(() => {});
      } catch {
        /* не поддерживается */
      }
    };
    requestLock();
    document.addEventListener('visibilitychange', requestLock);
    return () => {
      setSwipeLock(false);
      document.removeEventListener('visibilitychange', requestLock);
      lock?.release().catch(() => {});
    };
  }, [isTop]);

  useEffect(() => {
    if (session && note === null) setNote(session.note);
  }, [session, note]);

  if (session === undefined || !sets || !exercises) return <div className="screen" />;
  if (session === null || session.finishedAt !== null) {
    return (
      <div className="screen">
        <ScreenHeader title="Тренировка" />
        <p className="empty">Эта тренировка уже завершена или удалена.</p>
      </div>
    );
  }

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const done = sets.filter((s) => s.isDone);
  const workDone = done.filter((s) => !s.isWarmup).length;
  const restFor = (exId: string) => session.restSec[exId] ?? DEFAULT_REST;

  const addExercises = () =>
    nav.push({
      name: 'pickExercises',
      exclude: session.exerciseIds,
      onPick: (ids) => addExercisesToSession(sessionId, ids),
    });

  const replace = (ex: Exercise) =>
    nav.push({
      name: 'pickExercises',
      single: true,
      title: 'Заменить на…',
      initialGroup: ex.muscleGroup,
      exclude: session.exerciseIds,
      onPick: async ([newId]) => {
        const hasDone = sets.some((s) => s.exerciseId === ex.id && s.isDone);
        if (hasDone && !(await confirmDialog('Выполненные подходы этого упражнения удалятся. Заменить?', { ok: 'Заменить', danger: true }))) return;
        await replaceExercise(sessionId, ex.id, newId);
        haptic.success();
      },
    });

  const remove = async (ex: Exercise) => {
    if (!(await confirmDialog(`Убрать «${ex.name}» из тренировки вместе с подходами?`, { ok: 'Убрать', danger: true }))) return;
    await removeExerciseFromSession(sessionId, ex.id);
  };

  const finish = async () => {
    if (done.length === 0) {
      if (await confirmDialog('Ни один подход не отмечен ✓. Удалить эту тренировку?', { ok: 'Удалить тренировку', cancel: 'Продолжить', danger: true })) {
        await discardWorkout(sessionId);
        restTimer.stop();
        nav.forcePop();
      }
      return;
    }
    const undone = sets.length - done.length;
    const question = undone
      ? `${undone} ${plural(undone, ['подход не отмечен', 'подхода не отмечены', 'подходов не отмечены'])} ✓ и не сохранятся. Завершить тренировку?`
      : 'Завершить тренировку?';
    if (!(await confirmDialog(question, { ok: 'Завершить', cancel: 'Продолжить' }))) return;
    await finishWorkout(sessionId);
    restTimer.stop();
    // Копия в облако Telegram — в фоне, пользователь её не ждёт
    autoCloudBackup();
    haptic.success();
    nav.replace({ name: 'workoutSummary', sessionId });
  };

  const cancel = async () => {
    if (!(await confirmDialog('Отменить тренировку? Все записанные в ней подходы удалятся.', { ok: 'Отменить тренировку', cancel: 'Продолжить', danger: true }))) return;
    await discardWorkout(sessionId);
    restTimer.stop();
    nav.forcePop();
  };

  let sheetProps: { title: string; actions: SheetAction[] } | null = null;
  if (sheet?.kind === 'menu') {
    const ex = sheet.exercise;
    sheetProps = {
      title: ex.name,
      actions: [
        {
          label: 'Заметка к упражнению',
          onClick: () => setNoteEditing((l) => (l.includes(ex.id) ? l : [...l, ex.id])),
        },
        { label: 'Заменить упражнение', onClick: () => replace(ex) },
        { label: `Время отдыха: ${fmtRest(restFor(ex.id))}`, onClick: () => setSheet({ kind: 'rest', exercise: ex }) },
        { label: 'Убрать из тренировки', danger: true, onClick: () => remove(ex) },
      ],
    };
  } else if (sheet?.kind === 'rest') {
    const ex = sheet.exercise;
    sheetProps = {
      title: 'Отдых между подходами',
      actions: REST_OPTIONS.map((sec) => ({
        label: fmtRest(sec),
        selected: restFor(ex.id) === sec,
        onClick: () => setExerciseRest(sessionId, ex.id, sec),
      })),
    };
  }

  return (
    <div className="screen workout">
      <ScreenHeader title={session.name} />

      {/* Одна полоса: главное — время тренировки, рядом — сделанное к этому моменту */}
      <div className="workout-strip">
        <span className="workout-clock" aria-label="Время тренировки">
          <WorkoutClock startedAt={session.startedAt} />
        </span>
        <span className="workout-tally">
          <span>
            <b>{workDone}</b> {plural(workDone, ['подход', 'подхода', 'подходов'])}
          </span>
          <span>
            <b>{fmtNum(tonnage(sets))}</b> кг
          </span>
        </span>
      </div>

      {session.exerciseIds.length === 0 && (
        <p className="empty">Добавьте первое упражнение — и можно начинать.</p>
      )}

      {session.exerciseIds.map((exId) => {
        const ex = byId.get(exId);
        if (!ex) return null;
        return (
          <ExerciseBlock
            key={exId}
            sessionId={sessionId}
            exercise={ex}
            sets={sets.filter((s) => s.exerciseId === exId).sort((a, b) => a.order - b.order)}
            restSec={restFor(exId)}
            note={session.exerciseNotes[exId] ?? ''}
            editingNote={noteEditing.includes(exId)}
            activeSetId={activeSetId}
            onActivateSet={setActiveSetId}
            onOpenMenu={() => setSheet({ kind: 'menu', exercise: ex })}
            onOpenCard={() => nav.push({ name: 'exercise', id: exId })}
          />
        );
      })}

      <button className="btn btn-secondary btn-block btn-lg add-btn" onClick={addExercises}>
        <IconPlus /> Упражнение
      </button>

      <label className="field workout-note">
        <span className="field-label">Заметка к тренировке</span>
        <textarea
          className="input textarea"
          rows={2}
          placeholder="Самочувствие, сон, что изменить в следующий раз…"
          value={note ?? ''}
          onChange={(e) => {
            setNote(e.target.value);
            setSessionNote(sessionId, e.target.value);
          }}
        />
      </label>

      <button className="btn btn-danger btn-block" onClick={cancel}>
        Отменить тренировку
      </button>

      {isTop && <RestTimerBar />}
      <div className="rest-spacer" />
      <MainButton text="Завершить тренировку" onClick={finish} />
      {/* key: каждое меню — отдельная шторка. Иначе второе меню (например, «Время отдыха»)
          унаследовало бы состояние «закрываюсь» от первого и перестало бы реагировать. */}
      {sheetProps && sheet && (
        <ActionSheet
          key={`${sheet.kind}-${sheet.exercise.id}`}
          {...sheetProps}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
