import { isTelegram, tg } from './telegram';

// Цвета приложения задаются CSS-переменными (см. styles.css).
// По умолчанию — тёмная тема. Внутри Telegram подхватываем цвета темы пользователя,
// но акцентный (лаймовый) цвет оставляем своим — это «лицо» приложения.

function applyTheme() {
  const root = document.documentElement;
  if (!isTelegram || !tg) {
    root.dataset.scheme = 'dark';
    return;
  }
  const p = tg.themeParams;
  root.dataset.scheme = tg.colorScheme;
  const set = (name: string, value?: string) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };
  set('--bg', p.bg_color);
  set('--text', p.text_color);
  set('--hint', p.hint_color);
  set('--card', p.secondary_bg_color);

  const bg = p.bg_color ?? getComputedStyle(root).getPropertyValue('--bg').trim();
  try {
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);
  } catch {
    /* не поддерживается в старых версиях */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function initTheme() {
  applyTheme();
  if (isTelegram && tg) tg.onEvent('themeChanged', applyTheme);
}
