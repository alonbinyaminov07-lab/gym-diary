import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { uid } from '../db/db';
import { isTelegram, tg } from '../telegram/telegram';
import type { Route, StackEntry } from './routes';

/**
 * Простая навигация «стопкой»: вкладки внизу — это корень, а экраны вроде
 * «Карточка упражнения» или «Редактор тренировки» кладутся сверху и снимаются кнопкой «Назад».
 * Нижние экраны не уничтожаются, а остаются под верхним — поэтому введённые данные не теряются,
 * когда открываешь, например, выбор упражнений поверх редактора. Экраны въезжают справа
 * и уезжают обратно, нижний при этом слегка сдвигается (как в iOS).
 */

type Guard = () => boolean | Promise<boolean>;

/** Длительность анимации ухода экрана (совпадает с .layer-leave в styles.css) */
const LEAVE_MS = 240;

/** Индекс верхнего экрана, который не уходит; -1 — открыты только вкладки. */
export function lastActiveIndex(stack: StackEntry[]): number {
  for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].leaving) return i;
  return -1;
}

interface NavApi {
  stack: StackEntry[];
  push(route: Route): void;
  /** Заменить верхний экран другим (например, тренировку — её итогом) */
  replace(route: Route): void;
  /** Назад с учётом вопроса «Выйти без сохранения?»; true — экран ушёл */
  pop(): Promise<boolean>;
  /** Снять экран без проверки (например, после сохранения) */
  forcePop(): void;
  setGuard(key: string, guard: Guard | null): void;
}

const NavContext = createContext<NavApi | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const guards = useRef(new Map<string, Guard>());
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // Экран сначала помечается «уходит» (играет анимацию), а через LEAVE_MS убирается совсем
  const forcePop = useCallback(() => {
    setStack((s) => {
      const i = lastActiveIndex(s);
      if (i < 0) return s;
      const key = s[i].key;
      window.setTimeout(() => setStack((cur) => cur.filter((e) => e.key !== key)), LEAVE_MS);
      return s.map((e, j) => (j === i ? { ...e, leaving: true } : e));
    });
  }, []);

  const pop = useCallback(async () => {
    const s = stackRef.current;
    const top = s[lastActiveIndex(s)];
    if (!top) return false;
    const guard = guards.current.get(top.key);
    if (guard && !(await guard())) return false;
    forcePop();
    return true;
  }, [forcePop]);

  const api = useMemo<NavApi>(
    () => ({
      stack,
      push: (route) => setStack((s) => [...s, { ...route, key: uid() }]),
      replace: (route) =>
        setStack((s) => {
          const i = lastActiveIndex(s);
          const rest = i < 0 ? s : [...s.slice(0, i), ...s.slice(i + 1)];
          return [...rest, { ...route, key: uid(), enter: 'fade' }];
        }),
      pop,
      forcePop,
      setGuard: (key, guard) => {
        if (guard) guards.current.set(key, guard);
        else guards.current.delete(key);
      },
    }),
    [stack, pop, forcePop],
  );

  // Кнопка «Назад» в шапке Telegram: видна, когда открыт хотя бы один внутренний экран.
  const popRef = useRef(pop);
  popRef.current = pop;
  useEffect(() => {
    if (!isTelegram || !tg) return;
    const back = tg.BackButton;
    const handler = () => popRef.current();
    back.onClick(handler);
    return () => back.offClick(handler);
  }, []);
  useEffect(() => {
    if (!isTelegram || !tg) return;
    if (lastActiveIndex(stack) >= 0) tg.BackButton.show();
    else tg.BackButton.hide();
  }, [stack]);

  return <NavContext.Provider value={api}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav вне NavProvider');
  return ctx;
}

/** Сведения о слое, в котором отрисован экран. */
interface ScreenInfo {
  key: string;
  isTop: boolean;
  isRoot: boolean;
}

export const ScreenContext = createContext<ScreenInfo>({ key: 'root', isTop: true, isRoot: true });

export function useScreen() {
  return useContext(ScreenContext);
}

/** Спросить перед уходом с экрана (например, «Выйти без сохранения?»). */
export function useBackGuard(guard: Guard | null) {
  const { setGuard } = useNav();
  const { key } = useScreen();
  const ref = useRef(guard);
  ref.current = guard;
  const active = guard !== null;
  useEffect(() => {
    if (!active) return;
    setGuard(key, () => (ref.current ? ref.current() : true));
    return () => setGuard(key, null);
  }, [key, active, setGuard]);
}
