import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScreen } from '../nav/Nav';
import { isTelegram, tg } from '../telegram/telegram';

/**
 * Главная кнопка экрана («Сохранить», «Завершить тренировку»…).
 * В Telegram — это нативная MainButton внизу окна, в браузере — наша кнопка внизу экрана.
 */
export function MainButton({
  text,
  onClick,
  disabled = false,
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { isTop } = useScreen();
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!isTelegram || !tg || !isTop) return;
    const mb = tg.MainButton;
    const handler = () => clickRef.current();
    mb.setParams({
      text,
      color: '#e11d48',
      text_color: '#ffffff',
      is_active: !disabled,
      is_visible: true,
    });
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [isTop, text, disabled]);

  if (isTelegram || !isTop) return null;
  return (
    <>
      <div className="main-button-spacer" />
      {createPortal(
        <div className="main-button-wrap">
          <button className="btn btn-primary btn-block btn-lg" disabled={disabled} onClick={() => clickRef.current()}>
            {text}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
