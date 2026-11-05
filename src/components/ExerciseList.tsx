import { useMemo, useState, type ReactNode } from 'react';
import { EQUIPMENT, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../db/types';
import { normalize } from '../utils/format';
import { IconClose, IconSearch } from './icons';
import { PlateDot, PlateMark } from './PlateMark';

const GROUPS = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];

/**
 * Список упражнений с поиском и фильтром по группе мышц.
 * Используется и в справочнике, и при выборе упражнений в тренировку.
 */
export function ExerciseList({
  exercises,
  onItemClick,
  renderRight,
  isSelected,
  initialGroup = 'all',
}: {
  exercises: Exercise[];
  onItemClick: (ex: Exercise) => void;
  renderRight?: (ex: Exercise) => ReactNode;
  isSelected?: (ex: Exercise) => boolean;
  initialGroup?: MuscleGroup | 'all';
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>(initialGroup);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return exercises
      .filter((e) => group === 'all' || e.muscleGroup === group)
      .filter((e) => !q || normalize(e.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [exercises, query, group]);

  const sections = GROUPS.map((g) => ({ g, items: filtered.filter((e) => e.muscleGroup === g) })).filter(
    (s) => s.items.length > 0,
  );

  return (
    <div>
      <div className="search">
        <IconSearch />
        <input
          type="search"
          placeholder="Поиск упражнения"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
        {query && (
          <button className="icon-btn" onClick={() => setQuery('')} aria-label="Очистить">
            <IconClose size={18} />
          </button>
        )}
      </div>

      <div className="chips">
        <button className={'chip' + (group === 'all' ? ' active' : '')} onClick={() => setGroup('all')}>
          Все
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={'chip' + (group === g ? ' active' : '')} onClick={() => setGroup(g)}>
            <PlateDot group={g} />
            {MUSCLE_GROUPS[g]}
          </button>
        ))}
      </div>

      {sections.length === 0 && <p className="empty">Ничего не найдено</p>}

      {sections.map(({ g, items }) => (
        <section key={g} className="group">
          <h2 className="group-title">
            {MUSCLE_GROUPS[g]}
            <span className="group-count">{items.length}</span>
          </h2>
          <div className="card list">
            {items.map((e) => (
              <button
                key={e.id}
                className={'list-row list-row-btn' + (isSelected?.(e) ? ' selected' : '')}
                onClick={() => onItemClick(e)}
              >
                <PlateMark group={e.muscleGroup} />
                <span className="list-row-main">
                  <span className="list-row-title">{e.name}</span>
                  <span className="list-row-sub">
                    {EQUIPMENT[e.equipment]}
                    {e.isCustom && <span className="tag">своё</span>}
                  </span>
                </span>
                {renderRight?.(e)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
