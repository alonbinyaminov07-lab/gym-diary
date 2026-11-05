import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ExerciseList } from '../components/ExerciseList';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { IconCheck, IconPlus } from '../components/icons';
import { useNav } from '../nav/Nav';
import { haptic } from '../telegram/telegram';
import type { MuscleGroup } from '../db/types';

/** Выбор упражнений (несколько — для шаблона/тренировки, одно — для замены). */
export function ExercisePickerScreen({
  title,
  exclude = [],
  single = false,
  initialGroup,
  onPick,
}: {
  title?: string;
  exclude?: string[];
  single?: boolean;
  initialGroup?: MuscleGroup;
  onPick: (ids: string[]) => void;
}) {
  const nav = useNav();
  const all = useLiveQuery(() => db.exercises.toArray(), []);
  const [selected, setSelected] = useState<string[]>([]);

  const exercises = all?.filter((e) => !exclude.includes(e.id));

  const finish = (ids: string[]) => {
    nav.forcePop();
    onPick(ids);
  };

  const toggle = (id: string) => {
    haptic.select();
    if (single) return finish([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="screen">
      <ScreenHeader
        title={title ?? (single ? 'Выберите упражнение' : 'Добавить упражнения')}
        right={
          <button
            className="icon-btn icon-btn-accent"
            aria-label="Создать своё"
            onClick={() =>
              nav.push({
                name: 'exerciseEdit',
                // Только что созданное упражнение сразу отмечаем выбранным
                onSaved: (newId) => (single ? finish([newId]) : setSelected((s) => [...s, newId])),
              })
            }
          >
            <IconPlus />
          </button>
        }
      />
      {exercises && (
        <ExerciseList
          exercises={exercises}
          initialGroup={initialGroup}
          onItemClick={(e) => toggle(e.id)}
          isSelected={(e) => selected.includes(e.id)}
          renderRight={(e) => {
            const idx = selected.indexOf(e.id);
            return <span className={'check' + (idx >= 0 ? ' on' : '')}>{idx >= 0 ? <IconCheck size={18} /> : null}</span>;
          }}
        />
      )}
      {!single && (
        <MainButton
          text={selected.length ? `Добавить (${selected.length})` : 'Выберите упражнения'}
          disabled={!selected.length}
          onClick={() => finish(selected)}
        />
      )}
    </div>
  );
}
