import type { MuscleGroup } from '../db/types';

/**
 * «Торец блина» — цветная полоска группы мышц.
 * Цвета взяты у соревновательных блинов: красный, синий, жёлтый, зелёный, белый…
 */
export function PlateMark({ group, size = 'md' }: { group: MuscleGroup; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`plate plate-${size}`} style={{ background: `var(--mg-${group})` }} aria-hidden />;
}

/** Кружок цвета группы — для фильтров и меток. */
export function PlateDot({ group }: { group: MuscleGroup }) {
  return <span className="plate-dot" style={{ background: `var(--mg-${group})` }} aria-hidden />;
}
