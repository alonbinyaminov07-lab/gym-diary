import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MuscleGroup, TemplateExercise } from '../db/types';
import { PlateMark } from './PlateMark';
import { fmtRest } from '../utils/format';
import { IconClose, IconGrip } from './icons';
import { NumberField, Stepper } from './Stepper';

/**
 * Карточка упражнения в редакторе шаблона.
 * Перетаскивается за «ручку» ⠿ слева — так обычная прокрутка не сдвигает карточки случайно.
 */
export function TemplateExerciseCard({
  item,
  index,
  name,
  group,
  onChange,
  onRemove,
}: {
  item: TemplateExercise;
  index: number;
  name: string;
  group?: MuscleGroup;
  onChange: (patch: Partial<TemplateExercise>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.exerciseId,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const repsInvalid = item.repsMax < item.repsMin;

  return (
    <div ref={setNodeRef} style={style} className={'card te-card' + (isDragging ? ' dragging' : '')}>
      <div className="te-head">
        <button
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label="Перетащить, чтобы изменить порядок"
          {...attributes}
          {...listeners}
        >
          <IconGrip />
        </button>
        {group && <PlateMark group={group} size="lg" />}
        <span className="te-num">{index + 1}</span>
        <span className="te-name">{name}</span>
        <button className="icon-btn icon-btn-danger" onClick={onRemove} aria-label="Убрать">
          <IconClose />
        </button>
      </div>

      <div className="te-row">
        <span className="te-label">Подходы</span>
        <Stepper value={item.sets} min={1} max={20} onChange={(v) => onChange({ sets: v })} />
      </div>

      <div className="te-row">
        <span className="te-label">Повторы</span>
        <div className="reps-range">
          <NumberField
            ariaLabel="Повторов от"
            value={item.repsMin}
            min={1}
            onChange={(v) => onChange({ repsMin: v, repsMax: Math.max(v, item.repsMax) })}
          />
          <span className="hint">–</span>
          <NumberField
            ariaLabel="Повторов до"
            value={item.repsMax}
            min={1}
            invalid={repsInvalid}
            onChange={(v) => onChange({ repsMax: v })}
          />
        </div>
      </div>
      {repsInvalid && (
        <p className="te-error" role="alert">
          Верхняя граница меньше нижней: {item.repsMax} &lt; {item.repsMin}. Исправьте, чтобы сохранить.
        </p>
      )}

      <div className="te-row">
        <span className="te-label">Отдых</span>
        <Stepper
          value={item.restSec}
          step={15}
          min={0}
          max={600}
          format={fmtRest}
          onChange={(v) => onChange({ restSec: v })}
        />
      </div>
    </div>
  );
}
