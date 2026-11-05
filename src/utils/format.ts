/** 62.5 → «62,5» */
export function fmtNum(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

/** 90 → «1:30» */
export function fmtRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Длительность: 754000 → «12:34», 3 725 000 → «1:02:05» */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Длительность словами: «1 ч 05 мин», «42 мин» */
export function fmtDurationWords(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  // Коротко, чтобы помещалось в одну строку и в итоге тренировки, и в карточке истории
  if (min < 1) return '< 1 мин';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${m} мин`;
}

/** «2026-11-04» → «4 ноября, среда» (год — только если не текущий) */
export function fmtDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'long' });
  // Год показываем, только если он не текущий
  const year = withYear && y !== new Date().getFullYear() ? ` ${y}` : '';
  return `${dayMonth}${year}, ${weekday}`;
}

/** Нормализация для поиска: регистр и ё → е */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim();
}
