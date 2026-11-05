import { useEffect, useState } from 'react';
import { haptic } from '../telegram/telegram';

/** Крупный переключатель «− значение +». */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  format = String,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      haptic.select();
      onChange(next);
    }
  };
  return (
    <div className="stepper">
      <button className="stepper-btn" onClick={() => change(-step)} disabled={value <= min} aria-label="Меньше">
        −
      </button>
      <span className="stepper-value">{format(value)}</span>
      <button className="stepper-btn" onClick={() => change(step)} disabled={value >= max} aria-label="Больше">
        +
      </button>
    </div>
  );
}

/** Поле для ввода целого числа с цифровой клавиатурой. */
export function NumberField({
  value,
  onChange,
  min = 0,
  max = 999,
  ariaLabel,
  invalid = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  /** подсветить поле как ошибочное */
  invalid?: boolean;
}) {
  // Своя строка ввода: поле можно стереть целиком и набрать число заново.
  // Пустое поле при уходе из него возвращается к последнему верному значению.
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <input
      className={'num-field' + (invalid ? ' invalid' : '')}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        setText(String(value));
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, String(max).length);
        setText(digits);
        if (digits !== '') onChange(Math.min(max, Math.max(min, Number(digits))));
      }}
    />
  );
}
