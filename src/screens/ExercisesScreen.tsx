import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ExerciseList } from '../components/ExerciseList';
import { ScreenHeader } from '../components/ScreenHeader';
import { IconChevron, IconPlus } from '../components/icons';
import { useNav } from '../nav/Nav';

/** Вкладка «Упражнения»: справочник с поиском и фильтром. */
export function ExercisesScreen() {
  const nav = useNav();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);

  return (
    <div className="screen">
      <ScreenHeader
        title="Упражнения"
        right={
          <button className="icon-btn icon-btn-accent" onClick={() => nav.push({ name: 'exerciseEdit' })} aria-label="Добавить своё">
            <IconPlus />
          </button>
        }
      />
      {exercises && (
        <ExerciseList
          exercises={exercises}
          onItemClick={(e) => nav.push({ name: 'exercise', id: e.id })}
          renderRight={() => (
            <span className="hint-icon">
              <IconChevron />
            </span>
          )}
        />
      )}
    </div>
  );
}
