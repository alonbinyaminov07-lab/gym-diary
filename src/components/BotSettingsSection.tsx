import { useEffect, useRef, useState } from 'react';
import {
  botAvailable,
  loadBotSettings,
  saveBotSettings,
  sendTestMessage,
  BOT_API_URL,
  type BotSettings,
} from '../bot/botSync';
import { haptic } from '../telegram/telegram';
import { WEEKDAYS } from '../utils/dates';
import { plural } from '../utils/plural';
import { Stepper } from './Stepper';

/** Переключатель «вкл/выкл» с подписью и пояснением. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="toggle-row">
      <button
        className="toggle-main"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          haptic.select();
          onChange(!checked);
        }}
      >
        <span className="toggle-text">
          <span className="toggle-label">{label}</span>
          <span className="toggle-hint">{hint}</span>
        </span>
        <span className={'switch' + (checked ? ' on' : '')} aria-hidden />
      </button>
      {checked && children && <div className="toggle-extra">{children}</div>}
    </div>
  );
}

/** Раздел «Напоминания бота» на экране настроек. */
export function BotSettingsSection() {
  const [s, setS] = useState<BotSettings>(loadBotSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const available = botAvailable();
  const first = useRef(true);

  // Сохраняем через полсекунды после последнего изменения — не на каждое нажатие
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(async () => {
      const ok = await saveBotSettings(s);
      setStatus(available ? (ok ? 'Настройки сохранены.' : 'Не удалось связаться с ботом. Проверьте интернет.') : null);
    }, 500);
    return () => window.clearTimeout(t);
  }, [s, available]);

  const set = (patch: Partial<BotSettings>) => setS((prev) => ({ ...prev, ...patch }));

  const toggleDay = (day: number) => {
    haptic.select();
    const days = s.plannedDays.includes(day) ? s.plannedDays.filter((d) => d !== day) : [...s.plannedDays, day].sort();
    set({ plannedDays: days });
  };

  const test = async () => {
    setTesting(true);
    const res = await sendTestMessage();
    setTesting(false);
    if (res === 'ok') {
      haptic.success();
      setStatus('Сообщение отправлено — проверьте чат с ботом.');
    } else {
      haptic.warning();
      setStatus(
        res === 'blocked'
          ? 'Бот не может вам написать: откройте чат с ботом и нажмите «Старт».'
          : 'Не удалось связаться с ботом. Проверьте интернет и попробуйте ещё раз.',
      );
    }
  };

  return (
    <section className="data-section bot-section">
      <h2 className="group-title">Напоминания бота</h2>
      {!available && (
        <p className="hint">
          {BOT_API_URL
            ? 'Бот присылает сообщения, когда дневник открыт из Telegram. Настройки ниже сохранятся и применятся там.'
            : 'Сервер бота ещё не подключён. Настройки сохранятся и заработают после подключения.'}
        </p>
      )}

      <div className="card toggles">
        <Toggle
          label="Итоги после тренировки"
          hint="Время, тоннаж, рекорды и мотивация сразу после завершения"
          checked={s.afterWorkout}
          onChange={(v) => set({ afterWorkout: v })}
        />
        <Toggle
          label="Давно не было тренировки"
          hint={`Напомнить, если не было тренировок ${s.inactivityDays} ${plural(s.inactivityDays, ['день', 'дня', 'дней'])}`}
          checked={s.inactivity}
          onChange={(v) => set({ inactivity: v })}
        >
          <div className="extra-row">
            <span className="te-label">Через сколько дней</span>
            <Stepper value={s.inactivityDays} min={1} max={14} onChange={(v) => set({ inactivityDays: v })} />
          </div>
        </Toggle>
        <Toggle
          label="Дни тренировок"
          hint="Напомнить в выбранные дни, если ещё не тренировались"
          checked={s.planned}
          onChange={(v) => set({ planned: v })}
        >
          <div className="weekday-picker" role="group" aria-label="Дни тренировок">
            {WEEKDAYS.map((name, i) => {
              const day = i + 1;
              const on = s.plannedDays.includes(day);
              return (
                <button key={day} className={'weekday' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggleDay(day)}>
                  {name}
                </button>
              );
            })}
          </div>
        </Toggle>
        <Toggle
          label="Итоги недели"
          hint="В воскресенье: тренировки, тоннаж и рекорды за неделю"
          checked={s.weekly}
          onChange={(v) => set({ weekly: v })}
        />
      </div>

      <label className="field time-field">
        <span className="field-label">Время напоминаний и итогов недели</span>
        <input
          className="input"
          type="time"
          step={1800}
          value={s.time}
          onChange={(e) => e.target.value && set({ time: e.target.value })}
        />
      </label>

      {available && (
        <button className="btn btn-secondary btn-block" onClick={test} disabled={testing}>
          {testing ? 'Отправляю…' : 'Прислать тестовое сообщение'}
        </button>
      )}

      <p className="data-status" role="status" aria-live="polite">
        {status ?? ''}
      </p>
    </section>
  );
}
