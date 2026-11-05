import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { SetEntry } from '../../db/types';
import { deleteSet, updateSet } from '../../db/workout';
import { restTimer } from '../../workout/restTimer';
import { haptic } from '../../telegram/telegram';
import { fmtNum } from '../../utils/format';
import { IconCheck, IconClose } from '../icons';

const SWIPE_DELETE = 96;

/** Число → строка для поля ввода (с запятой; 0 → пусто, чтобы видеть подсказку). */
const toField = (n: number) => (n ? String(n).replace('.', ',') : '');

/**
 * Строка подхода: № | прошлый раз | вес | повторы | ✓.
 * Свайп влево — удалить. Тап по номеру — сделать разминочным.
 */
export function SetRow({
  set,
  label,
  prev,
  restSec,
  active,
  isNew = false,
  onActivate,
}: {
  set: SetEntry;
  label: string;
  prev?: SetEntry;
  restSec: number;
  active: boolean;
  /** подход только что добавлен кнопкой «+ Подход» — играем появление */
  isNew?: boolean;
  /** toggle = true — повторный тап по активной строке сворачивает кнопки ± */
  onActivate: (toggle: boolean) => void;
}) {
  const [weight, setWeight] = useState(toField(set.weight));
  const [reps, setReps] = useState(toField(set.reps));
  const [editing, setEditing] = useState<'w' | 'r' | null>(null);

  // Подтягиваем значения из базы, если поле не редактируется прямо сейчас
  useEffect(() => {
    if (editing !== 'w') setWeight(toField(set.weight));
  }, [set.weight, editing]);
  useEffect(() => {
    if (editing !== 'r') setReps(toField(set.reps));
  }, [set.reps, editing]);

  const changeWeight = (raw: string) => {
    const v = raw.replace('.', ',').replace(/[^0-9,]/g, '').replace(/,(?=.*,)/g, '');
    setWeight(v);
    const n = parseFloat(v.replace(',', '.'));
    updateSet(set.id, { weight: Number.isFinite(n) ? Math.min(n, 999) : 0 });
  };

  const commitWeight = () => {
    setEditing(null);
    // Вес — с шагом 0,5 кг
    const n = parseFloat(weight.replace(',', '.'));
    const rounded = Number.isFinite(n) ? Math.round(Math.min(n, 999) * 2) / 2 : 0;
    updateSet(set.id, { weight: rounded });
    setWeight(toField(rounded));
  };

  const changeReps = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 3);
    setReps(v);
    updateSet(set.id, { reps: v ? Number(v) : 0 });
  };

  // Отметка ✓ «впечатывается»: галочка прорисовывается штрихом (только при нажатии, не при открытии экрана)
  const [stamp, setStamp] = useState(false);

  const toggleDone = () => {
    const done = !set.isDone;
    updateSet(set.id, { isDone: done });
    setStamp(done);
    if (done) {
      haptic.medium();
      restTimer.start(set.isWarmup ? Math.min(restSec, 60) : restSec);
    } else {
      haptic.light();
    }
  };

  const copyPrev = () => {
    if (!prev) return;
    haptic.select();
    updateSet(set.id, { weight: prev.weight, reps: prev.reps });
  };

  // ----- Свайп влево для удаления -----
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const drag = useRef<{ x: number; y: number; t: number; dir: 'h' | 'v' | null } | null>(null);

  /** Строка уезжает влево, затем подход удаляется */
  const removeAnimated = () => {
    if (leaving) return;
    haptic.medium();
    setLeaving(true);
    window.setTimeout(() => deleteSet(set.id), 180);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (drag.current) return; // второй палец во время свайпа не сбивает строку
    drag.current = { x: e.clientX, y: e.clientY, t: Date.now(), dir: null };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.dir && Math.hypot(mx, my) > 10) {
      d.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (d.dir === 'h') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* некоторые браузеры не дают «захватить» палец — свайп всё равно работает */
        }
      }
    }
    if (d.dir === 'h') {
      const next = Math.min(0, mx);
      if (next < -SWIPE_DELETE && dx >= -SWIPE_DELETE) haptic.select();
      setDx(next);
    }
  };
  const suppressClick = useRef(false);
  const onPointerEnd = () => {
    const d = drag.current;
    const wasSwipe = d?.dir === 'h';
    drag.current = null;
    suppressClick.current = wasSwipe;
    // Удаляем при достаточном сдвиге или при быстром «щелчке» влево
    const velocity = d ? Math.abs(dx) / Math.max(1, Date.now() - d.t) : 0;
    // Порог «щелчка» 48px — чтобы случайное движение потным пальцем не удаляло подход
    if (wasSwipe && (dx < -SWIPE_DELETE || (dx < -48 && velocity > 0.5))) {
      removeAnimated();
      return;
    }
    setDx(0);
  };

  return (
    <div className={'set-item' + (isNew ? ' entering motion-move' : '')}>
      <div className="set-swipe">
        <div className="set-swipe-bg" aria-hidden>
          Удалить
        </div>
        <div
          className={
            'set-row' +
            (set.isDone ? ' done' : '') +
            (active ? ' active' : '') +
            (set.isWarmup ? ' warmup' : '') +
            (leaving ? ' leaving' : '')
          }
          style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onActivate(true);
          }}
        >
          <button
            className="set-num"
            onClick={(e) => {
              e.stopPropagation();
              haptic.select();
              updateSet(set.id, { isWarmup: !set.isWarmup });
            }}
            aria-label={set.isWarmup ? 'Разминочный подход, сделать рабочим' : 'Рабочий подход, сделать разминочным'}
          >
            {label}
          </button>

          <button className="set-prev" onClick={(e) => (e.stopPropagation(), copyPrev())} disabled={!prev}>
            {prev ? `${fmtNum(prev.weight)}×${prev.reps}` : '—'}
          </button>

          <input
            className="set-input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            aria-label="Вес, кг"
            value={weight}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
              setEditing('w');
              onActivate(false);
              e.target.select();
            }}
            onBlur={commitWeight}
            onChange={(e) => changeWeight(e.target.value)}
          />

          <input
            className="set-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            aria-label="Повторы"
            value={reps}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
              setEditing('r');
              onActivate(false);
              e.target.select();
            }}
            onBlur={() => setEditing(null)}
            onChange={(e) => changeReps(e.target.value)}
          />

          <button
            className={'set-check' + (set.isDone ? ' on' : '') + (stamp && set.isDone ? ' stamp' : '')}
            onClick={(e) => (e.stopPropagation(), toggleDone())}
            onAnimationEnd={() => setStamp(false)}
            aria-label={set.isDone ? 'Снять отметку' : 'Подход выполнен'}
            aria-pressed={set.isDone}
          >
            <IconCheck size={22} />
          </button>
        </div>
      </div>

      {active && (
        <div className="set-tools motion-move">
          <div className="set-tool">
            <button onClick={() => (haptic.select(), updateSet(set.id, { weight: Math.max(0, set.weight - 2.5) }))}>
              −2,5
            </button>
            <span>кг</span>
            <button onClick={() => (haptic.select(), updateSet(set.id, { weight: set.weight + 2.5 }))}>+2,5</button>
          </div>
          <div className="set-tool">
            <button onClick={() => (haptic.select(), updateSet(set.id, { reps: Math.max(0, set.reps - 1) }))}>−1</button>
            <span>повт</span>
            <button onClick={() => (haptic.select(), updateSet(set.id, { reps: set.reps + 1 }))}>+1</button>
          </div>
          <button
            className="set-delete"
            onClick={removeAnimated}
            aria-label="Удалить подход"
          >
            <IconClose size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
