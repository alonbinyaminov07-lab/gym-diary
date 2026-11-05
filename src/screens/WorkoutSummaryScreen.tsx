import { useEffect, useState } from 'react';
import { computeSummary, type WorkoutSummary } from '../db/workout';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlateMark } from '../components/PlateMark';
import { BarbellLoad } from '../components/workout/BarbellLoad';
import { useNav } from '../nav/Nav';
import { fmtDurationWords, fmtNum } from '../utils/format';

/**
 * Итог завершённой тренировки. Это редкий момент, поэтому у него своя постановка:
 * на гриф надеваются блины выполненных упражнений, затем появляются рекорды.
 */
export function WorkoutSummaryScreen({ sessionId }: { sessionId: string }) {
  const nav = useNav();
  const [summary, setSummary] = useState<WorkoutSummary | null | undefined>(undefined);

  useEffect(() => {
    computeSummary(sessionId).then(setSummary);
  }, [sessionId]);

  if (summary === undefined) return <div className="screen" />;
  if (summary === null) return <div className="screen">Тренировка не найдена</div>;

  // Рекорды появляются после того, как гриф собран
  const recordsDelay = 120 + Math.min(summary.plates.length, 6) * 70 + 200;

  return (
    <div className="screen">
      <ScreenHeader title="Тренировка сохранена" />

      <div className="summary-hero">
        <BarbellLoad plates={summary.plates} />
        <span className="summary-duration">{fmtDurationWords(summary.durationMs)}</span>
        <span className="summary-name">{summary.session.name}</span>
      </div>

      <dl className="card ledger">
        <div className="ledger-row">
          <dt>Тоннаж</dt>
          <dd>{fmtNum(summary.tonnage)} кг</dd>
        </div>
        <div className="ledger-row">
          <dt>Рабочих подходов</dt>
          <dd>{summary.setsDone}</dd>
        </div>
        <div className="ledger-row">
          <dt>Упражнений</dt>
          <dd>{summary.exercisesDone}</dd>
        </div>
      </dl>

      <h2 className="group-title summary-records-title">
        Новые рекорды
        {summary.records.length > 0 && <span className="group-count">{summary.records.length}</span>}
      </h2>
      {summary.records.length === 0 ? (
        <p className="hint">Рекорд засчитывается, когда вы превышаете свой прошлый максимум. В этот раз без них.</p>
      ) : (
        <div className="card list">
          {summary.records.map((r, i) => (
            <div
              key={r.exercise.id + r.kind}
              className="list-row record-row motion-move"
              style={{ animationDelay: `${recordsDelay + i * 60}ms` }}
            >
              <PlateMark group={r.exercise.muscleGroup} />
              <span className="list-row-main">
                <span className="list-row-title">{r.exercise.name}</span>
                <span className="list-row-sub">
                  {r.kind === 'weight' ? 'Максимальный вес' : 'Расчётный 1ПМ'}, было {fmtNum(r.previous)} кг
                </span>
              </span>
              <span className="record-value">{fmtNum(Math.round(r.value * 10) / 10)} кг</span>
            </div>
          ))}
        </div>
      )}

      <MainButton text="Готово" onClick={() => nav.forcePop()} />
    </div>
  );
}
