// Очередь окон подтверждения. Свои окна вместо системных confirm/alert:
// некоторые браузеры и встроенные окна блокируют системные диалоги, и кнопки «Завершить»,
// «Удалить» молча переставали работать.

export interface DialogOptions {
  /** текст кнопки подтверждения */
  ok?: string;
  /** текст кнопки отмены */
  cancel?: string;
  /** действие необратимое — кнопка подтверждения красная */
  danger?: boolean;
}

export interface DialogRequest extends DialogOptions {
  id: number;
  kind: 'confirm' | 'alert';
  message: string;
  resolve: (ok: boolean) => void;
}

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
/** смонтирован ли DialogHost — иначе запасной вариант через системные окна */
let hostMounted = false;

const emit = () => listeners.forEach((l) => l());

export const dialogStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  current: (): DialogRequest | undefined => queue[0],
  setHostMounted(v: boolean) {
    hostMounted = v;
  },
  close(id: number, ok: boolean) {
    const req = queue.find((r) => r.id === id);
    queue = queue.filter((r) => r.id !== id);
    emit();
    req?.resolve(ok);
  },
};

export function openDialog(kind: 'confirm' | 'alert', message: string, options: DialogOptions = {}): Promise<boolean> {
  if (!hostMounted) {
    // запасной путь (например, если окно вызвано до запуска интерфейса)
    if (kind === 'alert') {
      window.alert(message);
      return Promise.resolve(true);
    }
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    queue = [...queue, { id: nextId++, kind, message, resolve, ...options }];
    emit();
  });
}
