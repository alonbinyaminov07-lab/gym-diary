import { useEffect, type RefObject } from 'react';
import { haptic } from '../telegram/telegram';

/** Экран под верхним сдвинут влево на столько (как .layer-behind в styles.css) */
const BEHIND_SHIFT = 0.22;
/** Сколько ширины экрана нужно протащить, чтобы отпустить и уйти назад */
const COMMIT_SHARE = 0.33;
/** Или быстрый «щелчок» вправо: скорость в px/мс и минимальный сдвиг */
const FLICK_SPEED = 0.5;
const FLICK_MIN = 48;
const RETURN_MS = 260;

/**
 * Жест «смахнуть вправо — назад», как в приложениях iPhone.
 * Экран едет за пальцем, из-под него выезжает предыдущий. Отпустили дальше трети
 * экрана или резко смахнули — экран уходит; иначе возвращается на место.
 * Не мешает: прокрутке вверх-вниз, свайпу подхода влево (удаление), полям ввода,
 * перетаскиванию упражнений, горизонтальным лентам (фильтры по группам мышц).
 */
export function useSwipeBack(layerRef: RefObject<HTMLDivElement>, enabled: boolean, goBack: () => Promise<boolean>) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!enabled || !layer) return;

    let start: { x: number; y: number; t: number } | null = null;
    let dir: 'h' | 'v' | null = null;
    let dx = 0;
    let below: HTMLElement | null = null;
    let busy = false;

    const width = () => layer.clientWidth || window.innerWidth;

    const paint = (x: number) => {
      layer.style.transform = x ? `translateX(${x}px)` : '';
      if (below) {
        const shift = -BEHIND_SHIFT * width() * (1 - x / width());
        below.style.transform = `translateX(${shift}px)`;
      }
    };
    const setTransition = (on: boolean) => {
      const value = on ? `transform ${RETURN_MS}ms cubic-bezier(0.32, 0.72, 0, 1)` : 'none';
      layer.style.transition = value;
      if (below) below.style.transition = value;
    };
    const clear = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.transform = '';
      el.style.transition = '';
      el.style.boxShadow = '';
    };

    /** Касание начато там, где горизонтальное движение уже что-то значит */
    const blocked = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      if (target.closest('input, textarea, select, [contenteditable], .drag-handle, .sheet, .dialog, [data-no-swipe-back]')) return true;
      // Лента, прокрученная вправо: сначала листаем её обратно
      for (let el: Element | null = target; el && el !== layer; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft > 0) {
          const ox = getComputedStyle(el).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || blocked(e.target)) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
      dir = null;
      dx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const t = e.touches[0];
      const mx = t.clientX - start.x;
      const my = t.clientY - start.y;
      if (!dir) {
        if (Math.hypot(mx, my) < 10) return;
        // Вправо и заметно больше по горизонтали, чем по вертикали
        dir = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v';
        if (dir === 'v') {
          start = null;
          return;
        }
        below = findBelow(layer);
        setTransition(false);
        layer.style.boxShadow = '-12px 0 32px rgba(0, 0, 0, 0.35)';
      }
      if (e.cancelable) e.preventDefault();
      dx = Math.max(0, mx);
      paint(dx);
    };

    const settleBack = () => {
      setTransition(true);
      paint(0);
      const b = below;
      window.setTimeout(() => {
        clear(layer);
        clear(b);
      }, RETURN_MS);
    };

    const onEnd = async () => {
      const s = start;
      start = null;
      if (!s || dir !== 'h') return;
      dir = null;
      const speed = dx / Math.max(1, Date.now() - s.t);
      const commit = dx > width() * COMMIT_SHARE || (dx > FLICK_MIN && speed > FLICK_SPEED);
      if (!commit) {
        settleBack();
        return;
      }
      busy = true;
      haptic.select();
      const leaving = goBack();
      // Если экран сначала спрашивает «Выйти без сохранения?» — возвращаем его на место, пока висит вопрос
      const asked = await Promise.race([leaving.then(() => false), wait(80).then(() => true)]);
      if (asked) settleBack();
      const left = await leaving;
      busy = false;
      const b = below;
      below = null;
      if (!left) {
        if (!asked) {
          below = b;
          settleBack();
          below = null;
        }
        return;
      }
      // Дальше экран уезжает своей анимацией ухода с текущего места,
      // а нижний плавно встаёт на место: снимаем ручной сдвиг после перерисовки
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (b) {
            b.style.transition = '';
            b.style.transform = '';
          }
          layer.style.transition = '';
        }),
      );
    };

    layer.addEventListener('touchstart', onStart, { passive: true });
    layer.addEventListener('touchmove', onMove, { passive: false });
    layer.addEventListener('touchend', onEnd);
    layer.addEventListener('touchcancel', onEnd);
    return () => {
      layer.removeEventListener('touchstart', onStart);
      layer.removeEventListener('touchmove', onMove);
      layer.removeEventListener('touchend', onEnd);
      layer.removeEventListener('touchcancel', onEnd);
    };
  }, [layerRef, enabled, goBack]);
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Ближайший экран под этим (он стоит перед ним в разметке) */
function findBelow(layer: HTMLElement): HTMLElement | null {
  for (let el = layer.previousElementSibling; el; el = el.previousElementSibling) {
    if (el instanceof HTMLElement && el.classList.contains('layer-behind')) return el;
  }
  return null;
}
