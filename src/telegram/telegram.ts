// Тонкая обёртка над Telegram WebApp SDK.
// Все функции безопасно работают и в обычном браузере (там они просто ничего не делают
// или используют запасной вариант), поэтому приложение можно отлаживать без Telegram.
import { openDialog, type DialogOptions } from '../ui/dialogStore';

interface TgButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TgMainButton extends TgButton {
  setText(text: string): void;
  enable(): void;
  disable(): void;
  setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
}

export interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface TgWebApp {
  initData: string;
  /** Данные пользователя без проверки подписи — только для отображения (имя, аватар) */
  initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string; photo_url?: string } };
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  themeParams: TgThemeParams;
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  setBottomBarColor?(c: string): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  onEvent(event: string, cb: () => void): void;
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  showAlert?(message: string, cb?: () => void): void;
  showPopup?(
    params: {
      title?: string;
      message: string;
      buttons: { id: string; type: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'; text?: string }[];
    },
    cb: (buttonId: string) => void,
  ): void;
  BackButton: TgButton;
  /** Пункт «Настройки» в меню «⋯» Telegram (Bot API 6.10+) */
  SettingsButton?: TgButton;
  MainButton: TgMainButton;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage: {
    setItem(key: string, value: string, cb?: (err: string | null, ok?: boolean) => void): void;
    getItem(key: string, cb: (err: string | null, value?: string) => void): void;
    getItems(keys: string[], cb: (err: string | null, values?: Record<string, string>) => void): void;
    removeItems(keys: string[], cb?: (err: string | null, ok?: boolean) => void): void;
    getKeys(cb: (err: string | null, keys?: string[]) => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

export const tg: TgWebApp | undefined = window.Telegram?.WebApp;

/** true — приложение открыто внутри Telegram, false — в обычном браузере. */
export const isTelegram = !!tg && !!tg.initData;

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* старые версии Telegram могут не поддерживать метод — просто пропускаем */
  }
}

/** Вызывается один раз при запуске. */
export function initTelegram() {
  if (!isTelegram || !tg) return;
  safe(() => tg.ready());
  safe(() => tg.expand());
}

/** Запретить/разрешить закрытие приложения свайпом вниз (нужно во время тренировки). */
export function setSwipeLock(locked: boolean) {
  if (!isTelegram || !tg) return;
  safe(() => (locked ? tg.disableVerticalSwipes?.() : tg.enableVerticalSwipes?.()));
}

/**
 * Окно подтверждения. В Telegram — родное окно Telegram (с нашими подписями кнопок),
 * в браузере — своё окно приложения. Системный confirm() не используем: некоторые браузеры
 * и встроенные окна его блокируют, и кнопки молча переставали работать.
 */
export function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  if (isTelegram && tg?.showPopup && tg.isVersionAtLeast('6.2')) {
    return new Promise((resolve) =>
      tg.showPopup!(
        {
          message,
          buttons: [
            { id: 'cancel', type: 'default', text: options.cancel ?? 'Отмена' },
            { id: 'ok', type: options.danger ? 'destructive' : 'default', text: options.ok ?? 'Да' },
          ],
        },
        (id) => resolve(id === 'ok'),
      ),
    );
  }
  return openDialog('confirm', message, options);
}

/** Уведомление с одной кнопкой. */
export async function alertDialog(message: string): Promise<void> {
  if (isTelegram && tg?.showAlert && tg.isVersionAtLeast('6.2')) {
    return new Promise((resolve) => tg.showAlert!(message, () => resolve()));
  }
  await openDialog('alert', message);
}

/** Вибрация. В браузере используется navigator.vibrate (работает на Android). */
export const haptic = {
  light() {
    if (isTelegram) safe(() => tg!.HapticFeedback.impactOccurred('light'));
  },
  medium() {
    if (isTelegram) safe(() => tg!.HapticFeedback.impactOccurred('medium'));
  },
  success() {
    if (isTelegram) safe(() => tg!.HapticFeedback.notificationOccurred('success'));
    else navigator.vibrate?.([200, 100, 200]);
  },
  warning() {
    if (isTelegram) safe(() => tg!.HapticFeedback.notificationOccurred('warning'));
    else navigator.vibrate?.(300);
  },
  select() {
    if (isTelegram) safe(() => tg!.HapticFeedback.selectionChanged());
  },
};
