import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Таймер отдыха. Хранит момент окончания (а не «сколько осталось»), поэтому
 * правильно считает время даже после сворачивания или перезапуска приложения.
 */
export interface RestState {
  endsAt: number;
  total: number;
}

const KEY = 'gym-diary:rest';
let state: RestState | null = load();
const listeners = new Set<() => void>();

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}

function set(next: RestState | null) {
  state = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* хранилище недоступно — таймер просто не переживёт перезапуск */
  }
  listeners.forEach((l) => l());
}

export const restTimer = {
  start(sec: number) {
    if (sec <= 0) return set(null);
    set({ endsAt: Date.now() + sec * 1000, total: sec });
  },
  add(sec: number) {
    if (!state) return;
    const endsAt = Math.max(Date.now(), state.endsAt + sec * 1000);
    set({ endsAt, total: Math.max(1, state.total + sec) });
  },
  stop() {
    set(null);
  },
};

export function useRestTimer() {
  const rest = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  const now = useNow(rest ? 250 : null);
  const remainingMs = rest ? Math.max(0, rest.endsAt - now) : 0;
  return { rest, remainingMs };
}

/** Текущее время, обновляемое каждые `interval` мс (null — не обновлять). */
export function useNow(interval: number | null = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (interval === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}
