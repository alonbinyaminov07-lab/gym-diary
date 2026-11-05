import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { WorkoutTemplate } from '../db/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { IconPlus } from '../components/icons';
import { useNav } from '../nav/Nav';
import { useStartWorkout } from '../workout/useStartWorkout';
import { plural } from '../utils/plural';

/** Вкладка «Тренировки»: список шаблонов. */
export function TemplatesScreen() {
  const nav = useNav();
  const templates = useLiveQuery(() => db.templates.orderBy('updatedAt').reverse().toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const byId = new Map(exercises?.map((e) => [e.id, e]));

  const startWorkout = useStartWorkout();
  const start = (t: WorkoutTemplate) => startWorkout(t.id);

  const create = () => nav.push({ name: 'templateEdit' });

  return (
    <div className="screen">
      <ScreenHeader
        title="Тренировки"
        right={
          <button className="icon-btn icon-btn-accent" onClick={create} aria-label="Новая тренировка">
            <IconPlus />
          </button>
        }
      />

      {templates && templates.length === 0 && (
        <div className="card empty-card">
          <p>Здесь будут ваши тренировочные дни — например «Грудь + трицепс» или «Фулбади А».</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={create}>
            Создать тренировку
          </button>
        </div>
      )}

      {templates?.map((t) => {
        const totalSets = t.exercises.reduce((sum, e) => sum + e.sets, 0);
        return (
          <div key={t.id} className="card template-card">
            <button className="template-body" onClick={() => nav.push({ name: 'templateEdit', id: t.id })}>
              <span className="template-top">
                <span className="template-name">{t.name}</span>
                {/* «Гриф» тренировки: каждый блин — упражнение, цвет — группа мышц, высота — число подходов */}
                {t.exercises.length > 0 && (
                  <span className="bar-stack" aria-hidden>
                    {t.exercises.map((e) => {
                      const ex = byId.get(e.exerciseId);
                      return (
                        <span
                          key={e.exerciseId}
                          className="bar-plate"
                          style={{
                            background: ex ? `var(--mg-${ex.muscleGroup})` : 'var(--hint)',
                            height: `${Math.min(52, 20 + e.sets * 7)}px`,
                          }}
                        />
                      );
                    })}
                  </span>
                )}
              </span>
              <span className="template-meta">
                {t.exercises.length} {plural(t.exercises.length, ['упражнение', 'упражнения', 'упражнений'])},{' '}
                {totalSets} {plural(totalSets, ['подход', 'подхода', 'подходов'])}
              </span>
              {t.exercises.length > 0 && (
                <span className="template-list">
                  {t.exercises.slice(0, 4).map((e) => (
                    <span key={e.exerciseId}>
                      {byId.get(e.exerciseId)?.name ?? '—'}{' '}
                      <span className="hint-inline">
                        {e.sets}×{e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}
                      </span>
                    </span>
                  ))}
                  {t.exercises.length > 4 && <span className="hint-inline">и ещё {t.exercises.length - 4}</span>}
                </span>
              )}
            </button>
            <div className="template-actions">
              <button className="btn btn-secondary" onClick={() => nav.push({ name: 'templateEdit', id: t.id })}>
                Изменить
              </button>
              <button className="btn btn-primary" onClick={() => start(t)}>
                Начать
              </button>
            </div>
          </div>
        );
      })}

      {templates && (
        <button className="btn btn-block btn-lg add-btn" onClick={() => startWorkout(null)}>
          Начать без шаблона
        </button>
      )}
    </div>
  );
}
