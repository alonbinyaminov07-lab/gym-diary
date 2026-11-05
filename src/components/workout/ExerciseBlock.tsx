import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, SetEntry } from '../../db/types';
import { addSet, previousSets, setExerciseNote } from '../../db/workout';
import { haptic } from '../../telegram/telegram';
import { fmtRest } from '../../utils/format';
import { PlateMark } from '../PlateMark';
import { IconPlus } from '../icons';
import { SetRow } from './SetRow';

/** Блок одного упражнения в тренировке: заголовок, таблица подходов, «+ подход». */
export function ExerciseBlock({
  sessionId,
  exercise,
  sets,
  restSec,
  note,
  editingNote,
  activeSetId,
  onActivateSet,
  onOpenMenu,
  onOpenCard,
}: {
  sessionId: string;
  exercise: Exercise;
  sets: SetEntry[];
  restSec: number;
  note: string;
  editingNote: boolean;
  activeSetId: string | null;
  onActivateSet: (id: string | null) => void;
  onOpenMenu: () => void;
  onOpenCard: () => void;
}) {
  const prev = useLiveQuery(() => previousSets(exercise.id, sessionId), [exercise.id, sessionId]) ?? [];
  const prevWork = prev.filter((s) => !s.isWarmup);
  const prevWarm = prev.filter((s) => s.isWarmup);
  const [noteDraft, setNoteDraft] = useState(note);
  // Подходы, которые были при открытии экрана, появляются сразу; анимируем только добавленные позже
  const initialIds = useRef(new Set(sets.map((s) => s.id)));

  let work = 0;
  let warm = 0;
  const doneCount = sets.filter((s) => s.isDone).length;

  return (
    <section className="ex-block">
      <header className="ex-head">
        <PlateMark group={exercise.muscleGroup} size="lg" />
        <button className="ex-title" onClick={onOpenCard}>
          <span className="ex-name">{exercise.name}</span>
          <span className="ex-sub">
            {doneCount} из {sets.length} выполнено, отдых {fmtRest(restSec)}
          </span>
        </button>
        <button className="icon-btn ex-menu" onClick={onOpenMenu} aria-label="Действия с упражнением">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </header>

      {(editingNote || note) && (
        <textarea
          className="input textarea ex-note"
          rows={2}
          placeholder="Заметка к упражнению: настройки, ощущения…"
          value={noteDraft}
          autoFocus={editingNote && !note}
          onChange={(e) => {
            setNoteDraft(e.target.value);
            setExerciseNote(sessionId, exercise.id, e.target.value);
          }}
        />
      )}

      <div className="set-head" aria-hidden>
        <span className="set-head-num">№</span>
        <span>Прошлый</span>
        <span>кг</span>
        <span>Повт.</span>
        <span />
      </div>

      {sets.map((s) => {
        const label = s.isWarmup ? 'Р' : String(++work);
        const p = s.isWarmup ? prevWarm[warm++] : prevWork[work - 1];
        return (
          <SetRow
            key={s.id}
            set={s}
            label={label}
            prev={p}
            restSec={restSec}
            active={activeSetId === s.id}
            isNew={!initialIds.current.has(s.id)}
            onActivate={(toggle) => onActivateSet(toggle && activeSetId === s.id ? null : s.id)}
          />
        );
      })}

      <button
        className="btn btn-block add-set"
        onClick={() => {
          haptic.light();
          addSet(sessionId, exercise.id);
        }}
      >
        <IconPlus /> Подход
      </button>
    </section>
  );
}
