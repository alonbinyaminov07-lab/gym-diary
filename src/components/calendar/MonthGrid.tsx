import type { MuscleGroup } from '../../db/types';
import { haptic } from '../../telegram/telegram';
import { WEEKDAYS, monthCells } from '../../utils/dates';

/**
 * Месячная сетка. Под числом дня с тренировкой — «блины» цветов групп мышц,
 * которые тренировались в этот день.
 */
export function MonthGrid({
  year,
  month,
  today,
  selected,
  dayGroups,
  onSelect,
}: {
  year: number;
  month: number;
  today: string;
  selected: string;
  /** дата → группы мышц, которые тренировались (по убыванию числа подходов) */
  dayGroups: Map<string, MuscleGroup[]>;
  onSelect: (iso: string) => void;
}) {
  const cells = monthCells(year, month);

  return (
    <div className="month" role="grid" aria-label="Календарь тренировок">
      {WEEKDAYS.map((d, i) => (
        <span key={d} className={'month-wd' + (i >= 5 ? ' weekend' : '')} role="columnheader">
          {d}
        </span>
      ))}
      {cells.map((iso, i) => {
        if (!iso) return <span key={'e' + i} className="day day-empty" />;
        const groups = dayGroups.get(iso);
        const cls =
          'day' +
          (groups ? ' has-workout' : '') +
          (iso === today ? ' today' : '') +
          (iso === selected ? ' selected' : '') +
          (iso > today ? ' future' : '');
        return (
          <button
            key={iso}
            className={cls}
            role="gridcell"
            aria-selected={iso === selected}
            aria-label={iso + (groups ? ', есть тренировка' : '')}
            onClick={() => {
              haptic.select();
              onSelect(iso);
            }}
          >
            <span className="day-num">{Number(iso.slice(8))}</span>
            <span className="day-plates" aria-hidden>
              {groups?.slice(0, 4).map((g) => (
                <span key={g} className="day-plate" style={{ background: `var(--mg-${g})` }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
