import { isTelegram, tg } from './telegram';

// Цвета приложения задаются CSS-переменными (см. styles.css): тёмная и светлая палитры.
// Внутри Telegram берём только то, какая тема включена (тёмная или светлая), а сами цвета — свои.
// Раньше подхватывались цвета темы Telegram, но в тёмной теме iPhone фон карточек там
// совпадает с фоном экрана — поля ввода и карточки сливались с чёрным фоном,
// и приложение выглядело не так, как в браузере.

function applyTheme() {
  const root = document.documentElement;
  if (!isTelegram || !tg) {
    root.dataset.scheme = 'dark';
    return;
  }
  root.dataset.scheme = tg.colorScheme;
  // Убираем цвета, которые могли остаться от прошлых версий
  for (const name of ['--bg', '--text', '--hint', '--card']) root.style.removeProperty(name);

  // Шапка, фон под приложением и полоса под главной кнопкой Telegram — в цвет фона приложения
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  try {
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);
    if (tg.isVersionAtLeast('7.10')) tg.setBottomBarColor?.(bg);
  } catch {
    /* не поддерживается в старых версиях */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function initTheme() {
  applyTheme();
  if (isTelegram && tg) tg.onEvent('themeChanged', applyTheme);
}
