import type { MuscleGroup } from '../../db/types';

/**
 * Итоговый «гриф»: каждое выполненное упражнение — блин цвета своей группы мышц,
 * высота блина — сколько рабочих подходов сделано. Блины надеваются на гриф с двух сторон
 * по очереди, от центра к краям — один раз, при появлении итога тренировки.
 */
export function BarbellLoad({ plates }: { plates: { exerciseId: string; group: MuscleGroup; sets: number }[] }) {
  // Не больше 6 блинов на сторону, иначе гриф не помещается на экране телефона
  const shown = plates.slice(0, 6);
  const height = (sets: number) => `${Math.min(100, 46 + sets * 11)}%`;

  const side = (dir: 'left' | 'right') =>
    shown.map((p, i) => (
      <span
        key={p.exerciseId + dir}
        className={`load-plate load-plate-${dir} motion-move`}
        style={{
          background: `var(--mg-${p.group})`,
          height: height(p.sets),
          animationDelay: `${120 + i * 70}ms`,
        }}
      />
    ));

  return (
    <div className="barbell" role="img" aria-label={`На грифе ${plates.length} упражнений`}>
      <span className="barbell-shaft" />
      <span className="barbell-side barbell-side-left">
        <span className="barbell-collar" />
        {side('left')}
        <span className="barbell-sleeve" />
      </span>
      <span className="barbell-grip" />
      <span className="barbell-side barbell-side-right">
        <span className="barbell-collar" />
        {side('right')}
        <span className="barbell-sleeve" />
      </span>
    </div>
  );
}
