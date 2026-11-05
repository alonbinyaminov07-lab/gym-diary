import type { ReactNode } from 'react';
import { useNav, useScreen } from '../nav/Nav';
import { isTelegram } from '../telegram/telegram';
import { IconBack } from './icons';

/**
 * Заголовок экрана. Во внутренних экранах в браузере показывает кнопку «Назад»
 * (в Telegram для этого есть нативная BackButton в шапке).
 */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { isRoot } = useScreen();
  const nav = useNav();
  const showBack = !isRoot && !isTelegram;

  return (
    <header className="screen-header">
      {showBack && (
        <button className="icon-btn back-btn" onClick={() => nav.pop()} aria-label="Назад">
          <IconBack />
        </button>
      )}
      <h1 className={'screen-title' + (isRoot ? '' : ' screen-title-sm')}>{title}</h1>
      {right && <div className="screen-header-right">{right}</div>}
    </header>
  );
}
