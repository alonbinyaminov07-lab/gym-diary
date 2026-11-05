import { useState } from 'react';
import { createPortal } from 'react-dom';

export interface SheetAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  selected?: boolean;
}

/** Длительность ухода шторки (совпадает с .sheet-closing в styles.css) */
const CLOSE_MS = 200;

/**
 * Меню снизу (крупные кнопки, удобно большим пальцем).
 * Выезжает шторкой снизу и уходит туда же; затемнение фона проявляется вместе с ней.
 */
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);

  const close = (after?: () => void) => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      onClose();
      after?.();
    }, CLOSE_MS);
  };

  return createPortal(
    <div className={'sheet-overlay' + (closing ? ' sheet-closing' : '')} onClick={() => close()}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <div className="sheet-title">{title}</div>}
        {actions.map((a, i) => (
          <button
            key={i}
            className={'sheet-action' + (a.danger ? ' danger' : '') + (a.selected ? ' selected' : '')}
            onClick={() => close(a.onClick)}
          >
            {a.label}
          </button>
        ))}
        <button className="sheet-action sheet-cancel" onClick={() => close()}>
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  );
}
