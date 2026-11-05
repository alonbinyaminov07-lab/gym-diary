import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { dialogStore } from '../ui/dialogStore';
import { haptic } from '../telegram/telegram';

/** Длительность ухода окна (совпадает с .dialog-closing в styles.css) */
const CLOSE_MS = 160;

/** Окно подтверждения в стиле приложения. Показывает по одному запросу из очереди. */
export function DialogHost() {
  const req = useSyncExternalStore(dialogStore.subscribe, dialogStore.current);
  const [closing, setClosing] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogStore.setHostMounted(true);
    return () => dialogStore.setHostMounted(false);
  }, []);

  useEffect(() => {
    if (!req) return;
    setClosing(false);
    okRef.current?.focus();
    if (req.danger) haptic.warning();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
      if (e.key === 'Enter') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req?.id]);

  if (!req) return null;

  const answer = (ok: boolean) => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => dialogStore.close(req.id, ok), CLOSE_MS);
  };

  const isConfirm = req.kind === 'confirm';

  return createPortal(
    <div
      className={'dialog-overlay' + (closing ? ' dialog-closing' : '')}
      onClick={() => answer(false)}
      role="presentation"
    >
      <div
        className="dialog motion-move"
        role={isConfirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-describedby={`dialog-msg-${req.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="dialog-message" id={`dialog-msg-${req.id}`}>
          {req.message}
        </p>
        <div className={'dialog-actions' + (isConfirm ? '' : ' single')}>
          {isConfirm && (
            <button className="btn btn-secondary" onClick={() => answer(false)}>
              {req.cancel ?? 'Отмена'}
            </button>
          )}
          <button
            ref={okRef}
            className={'btn ' + (req.danger ? 'btn-danger-solid' : 'btn-primary')}
            onClick={() => answer(true)}
          >
            {req.ok ?? (isConfirm ? 'Да' : 'Понятно')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
