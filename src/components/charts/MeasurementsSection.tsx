import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { MEASUREMENTS, type MeasurementKey } from '../../db/types';
import { useNav } from '../../nav/Nav';
import { fmtDate, fmtNum } from '../../utils/format';
import { IconChevron, IconPlus } from '../icons';
import { TrendChart } from './TrendChart';

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
};

/** Замеры тела: последние значения с изменением, график выбранного замера и список записей. */
export function MeasurementsSection() {
  const nav = useNav();
  const all = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []);
  const [metric, setMetric] = useState<MeasurementKey>('weight');

  if (!all) return null;

  const add = () => nav.push({ name: 'measurementEdit' });
  const meta = MEASUREMENTS.find((m) => m.key === metric)!;
  const series = all.filter((m) => m[metric] !== undefined);
  const latestFor = (key: MeasurementKey) => {
    const withKey = all.filter((m) => m[key] !== undefined);
    const last = withKey[withKey.length - 1];
    const prev = withKey[withKey.length - 2];
    return { last: last?.[key], delta: last && prev ? last[key]! - prev[key]! : undefined };
  };

  return (
    <section className="measure-section">
      <div className="section-head">
        <h2 className="group-title">Замеры тела</h2>
        <button className="btn btn-ghost" onClick={add}>
          <IconPlus /> Добавить
        </button>
      </div>

      {all.length === 0 ? (
        <div className="card empty-card">
          <p>Записывайте вес и обхваты раз в 1–2 недели — здесь появятся графики изменений.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={add}>
            Добавить первый замер
          </button>
        </div>
      ) : (
        <>
          {/* Выбор замера: плитка — сразу и кнопка, и последнее значение */}
          <div className="measure-tiles">
            {MEASUREMENTS.map(({ key, label, unit }) => {
              const { last, delta } = latestFor(key);
              return (
                <button
                  key={key}
                  className={'measure-tile' + (metric === key ? ' active' : '')}
                  onClick={() => setMetric(key)}
                  aria-pressed={metric === key}
                >
                  <span className="measure-tile-label">{label}</span>
                  <span className="measure-tile-value">{last !== undefined ? `${fmtNum(last)} ${unit}` : '—'}</span>
                  <span className="measure-tile-delta">
                    {delta === undefined || delta === 0
                      ? ' '
                      : `${delta > 0 ? '+' : '−'}${fmtNum(Math.abs(Math.round(delta * 10) / 10))}`}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="card chart-card">
            <h3 className="chart-title">
              {meta.label}, {meta.unit}
            </h3>
            {series.length >= 2 ? (
              <TrendChart
                kind="line"
                unit={meta.unit}
                ariaLabel={`График: ${meta.label}`}
                data={series.map((m) => ({
                  key: m.id,
                  label: shortDate(m.date),
                  value: m[metric]!,
                  tip: fmtDate(m.date),
                }))}
              />
            ) : (
              <p className="hint chart-wait">
                {series.length === 0
                  ? 'Этот замер ещё не записывали.'
                  : 'График появится, когда будет хотя бы два замера.'}
              </p>
            )}
          </section>

          <div className="card list measure-list">
            {[...all].reverse().map((m) => (
              <button key={m.id} className="list-row list-row-btn" onClick={() => nav.push({ name: 'measurementEdit', id: m.id })}>
                <span className="list-row-main">
                  <span className="list-row-title">{fmtDate(m.date)}</span>
                  <span className="list-row-sub measure-values">
                    {MEASUREMENTS.filter(({ key }) => m[key] !== undefined)
                      .map(({ key, label, unit }) => `${label.toLowerCase()} ${fmtNum(m[key]!)} ${unit}`)
                      .join(', ')}
                  </span>
                </span>
                <span className="hint-icon">
                  <IconChevron />
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
