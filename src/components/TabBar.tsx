import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadProfile, telegramUser } from '../db/profile';
import { haptic } from '../telegram/telegram';
import { Avatar } from './Avatar';
import { IconCalendar, IconChart, IconDumbbell, IconList, IconUser } from './icons';

export type TabId = 'calendar' | 'templates' | 'profile' | 'exercises' | 'progress';

/** Насколько палец должен сдвинуться, чтобы это считалось перетаскиванием, а не нажатием */
const DRAG_START_PX = 6;

interface Lens {
  x: number;
  w: number;
}

/**
 * Нижнее меню. «Профиль» — по центру, с маленьким фото пользователя вместо иконки.
 * Выбранную вкладку накрывает стеклянная линза. Её можно зажать и вести пальцем
 * вдоль меню: линза чуть увеличивается и едет за пальцем, а когда отпускаешь,
 * открывается вкладка под ней. Обычное нажатие тоже работает.
 */
export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const profile = useLiveQuery(() => loadProfile(), []);
  // Есть фото — показываем его кружком; нет — обычная иконка в стиле остальных вкладок
  const hasPhoto = !!(profile?.photo ?? telegramUser()?.photo_url);

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'calendar', label: 'Календарь', icon: <IconCalendar /> },
    { id: 'templates', label: 'Тренировки', icon: <IconList /> },
    { id: 'profile', label: 'Профиль', icon: hasPhoto ? <Avatar profile={profile} size={21} /> : <IconUser /> },
    { id: 'exercises', label: 'Упражнения', icon: <IconDumbbell /> },
    { id: 'progress', label: 'Прогресс', icon: <IconChart /> },
  ];

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const [lens, setLens] = useState<Lens | null>(null);
  /** Вкладка под пальцем во время нажатия или перетаскивания */
  const [hover, setHover] = useState<TabId | null>(null);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; startX: number; moved: boolean; hover: TabId } | null>(null);

  /** Где стоит вкладка внутри меню */
  const boxOf = useCallback((id: TabId): Lens | null => {
    const nav = navRef.current;
    const el = itemRefs.current.get(id);
    if (!nav || !el) return null;
    return { x: el.offsetLeft, w: el.offsetWidth };
  }, []);

  // Линза стоит на выбранной вкладке; пересчитываем при смене вкладки и размера экрана
  useLayoutEffect(() => {
    if (drag.current) return;
    const place = () => setLens(boxOf(active));
    place();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active, boxOf, hasPhoto]);

  /** Вкладка, над которой сейчас палец */
  const tabAt = (clientX: number): TabId => {
    let best: TabId = active;
    let bestDist = Infinity;
    for (const t of tabs) {
      const el = itemRefs.current.get(t.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const d = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
      if (d < bestDist) {
        bestDist = d;
        best = t.id;
      }
    }
    return best;
  };

  /** Линза по центру под пальцем, шириной как вкладка под ним, не выходя за края меню */
  const lensAtFinger = (clientX: number, under: TabId): Lens | null => {
    const nav = navRef.current;
    const box = boxOf(under);
    if (!nav || !box) return null;
    const navRect = nav.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(nav).paddingLeft) || 0;
    const min = pad;
    const max = nav.clientWidth - pad - box.w;
    const x = Math.min(max, Math.max(min, clientX - navRect.left - box.w / 2));
    return { x, w: box.w };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag.current) return;
    const under = tabAt(e.clientX);
    drag.current = { id: e.pointerId, startX: e.clientX, moved: false, hover: under };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* без «захвата» пальца перетаскивание всё равно работает, пока палец над меню */
    }
    setPressed(true);
    setHover(under);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_START_PX) return;
      d.moved = true;
      setDragging(true);
    }
    const under = tabAt(e.clientX);
    if (under !== d.hover) {
      d.hover = under;
      haptic.select();
      setHover(under);
    }
    setLens(lensAtFinger(e.clientX, under));
  };

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setPressed(false);
    setDragging(false);
    setHover(null);
    const target = cancelled && !d.moved ? active : d.hover;
    if (target !== active) {
      if (!d.moved) haptic.select();
      onChange(target);
    } else {
      // Остались на той же вкладке — линза возвращается на место
      setLens(boxOf(active));
      if (!cancelled && !d.moved) onChange(target); // повторное нажатие: прокрутка вкладки наверх
    }
  };

  // Подсвечена вкладка под пальцем, а когда пальца нет — выбранная
  const lit = hover ?? active;

  return (
    <nav
      ref={navRef}
      className={'tabbar' + (pressed ? ' pressed' : '') + (dragging ? ' dragging' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
    >
      {lens && (
        <span
          className="tabbar-lens"
          aria-hidden
          style={{ width: lens.w, transform: `translateX(${lens.x}px)` }}
        />
      )}
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) itemRefs.current.set(t.id, el);
            else itemRefs.current.delete(t.id);
          }}
          className={'tabbar-item' + (t.id === lit ? ' active' : '') + (t.id === 'profile' ? ' tabbar-profile' : '')}
          aria-current={t.id === active ? 'page' : undefined}
          // Нажатия пальцем и мышью обрабатывает само меню (см. выше); здесь — только клавиатура
          onClick={(e) => {
            if (e.detail !== 0) return;
            if (t.id !== active) haptic.select();
            onChange(t.id);
          }}
        >
          <span className="tabbar-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
