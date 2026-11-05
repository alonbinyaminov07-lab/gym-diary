import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayISO } from '../db/db';
import { deleteMeasurement, saveMeasurement } from '../db/repo';
import { MEASUREMENTS, type BodyMeasurement, type MeasurementKey } from '../db/types';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useBackGuard, useNav } from '../nav/Nav';
import { confirmDialog, haptic } from '../telegram/telegram';

type Draft = Record<MeasurementKey, string>;
const EMPTY: Draft = { weight: '', chest: '', waist: '', hips: '', arm: '', thigh: '' };

/**
 * Явно необычное значение — скорее всего, пропущена запятая (299 вместо 29,9).
 * Сохранить можно, это только подсказка.
 */
function suspicious(key: MeasurementKey, raw: string): boolean {
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return false;
  return key === 'weight' ? n < 30 || n > 250 : n < 15 || n > 200;
}

const toField = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));
const parse = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
};

/** Добавление и редактирование замеров тела. Все поля необязательны. */
export function MeasurementEditScreen({ id }: { id?: string }) {
  const nav = useNav();
  const [loaded, setLoaded] = useState(!id);
  const [date, setDate] = useState(todayISO());
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [initial, setInitial] = useState(() => JSON.stringify({ date: todayISO(), draft: EMPTY }));

  useEffect(() => {
    if (!id) return;
    db.measurements.get(id).then((m) => {
      if (m) {
        const d = Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, toField(m[key])])) as Draft;
        setDate(m.date);
        setDraft(d);
        setInitial(JSON.stringify({ date: m.date, draft: d }));
      }
      setLoaded(true);
    });
  }, [id]);

  // Последний замер — показываем его значения серым внутри пустых полей
  const [last, setLast] = useState<BodyMeasurement | undefined>();
  useEffect(() => {
    db.measurements
      .orderBy('date')
      .reverse()
      .filter((m) => m.id !== id)
      .first()
      .then(setLast);
  }, [id]);

  // Замер на выбранную дату, кроме редактируемого: новые значения будут дописаны в него
  const sameDay = useLiveQuery(
    () => db.measurements.where('date').equals(date).filter((m) => m.id !== id).first(),
    [date, id],
  );

  const dirty = JSON.stringify({ date, draft }) !== initial;
  const hasAny = MEASUREMENTS.some(({ key }) => parse(draft[key]) !== undefined);
  useBackGuard(dirty ? () => confirmDialog('Изменения не сохранены.', { ok: 'Выйти без сохранения', cancel: 'Остаться', danger: true }) : null);

  const save = async () => {
    const values = Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, parse(draft[key])]));
    await saveMeasurement({ id, date, ...values });
    haptic.success();
    nav.forcePop();
  };

  const remove = async () => {
    if (!id || !(await confirmDialog('Удалить этот замер?', { ok: 'Удалить', danger: true }))) return;
    await deleteMeasurement(id);
    nav.forcePop();
  };

  if (!loaded) return <div className="screen" />;

  return (
    <div className="screen">
      <ScreenHeader title={id ? 'Замер' : 'Новый замер'} />

      <label className="field">
        <span className="field-label">Дата</span>
        <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>

      <p className="hint">
        {sameDay
          ? 'На эту дату уже есть замер — заполненные поля дополнят его.'
          : 'Заполните только то, что измеряли. Серым — значения прошлого замера.'}
      </p>

      <div className="card measure-form">
        {MEASUREMENTS.map(({ key, label, unit }) => (
          <label key={key} className={'measure-row' + (suspicious(key, draft[key]) ? ' measure-warn' : '')}>
            <span className="measure-label">
              {label}
              {suspicious(key, draft[key]) && (
                <span className="measure-warn-text">Проверьте: необычно {key === 'weight' ? 'большой или маленький вес' : 'для обхвата'}</span>
              )}
            </span>
            <span className="measure-input-wrap">
              <input
                className="num-field measure-input"
                type="text"
                inputMode="decimal"
                placeholder={toField(last?.[key]) || '—'}
                value={draft[key]}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [key]: e.target.value.replace('.', ',').replace(/[^0-9,]/g, '').slice(0, 6),
                  }))
                }
              />
              <span className="measure-unit">{unit}</span>
            </span>
          </label>
        ))}
      </div>

      {id && (
        <div className="danger-zone">
          <button className="btn btn-danger btn-block" onClick={remove}>
            Удалить замер
          </button>
        </div>
      )}

      <MainButton text="Сохранить" onClick={save} disabled={!hasAny || !date || (!!id && !dirty)} />
    </div>
  );
}
