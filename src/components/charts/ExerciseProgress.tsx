import { useLiveQuery } from 'dexie-react-hooks';
import { exercisePoints, exerciseRecords, type ExercisePoint } from '../../db/stats';
import { fmtDate, fmtNum } from '../../utils/format';
import { TrendChart, compactKg, type ChartDatum } from './TrendChart';

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
};

function toData(points: ExercisePoint[], value: (p: ExercisePoint) => number, tip?: (p: ExercisePoint) => string) {
  return points.map(
    (p): ChartDatum => ({
      key: p.sessionId,
      label: shortDate(p.date),
      value: Math.round(value(p) * 10) / 10,
      tip: fmtDate(p.date) + (tip ? `, ${tip(p)}` : ''),
    }),
  );
}

/** Рекорды и графики в карточке упражнения. */
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const points = useLiveQuery(() => exercisePoints(exerciseId), [exerciseId]);
  if (!points) return null;
  if (points.length === 0) return null;

  const rec = exerciseRecords(points);
  const enoughForChart = points.length >= 2;

  return (
    <>
      <dl className="card ledger">
        {rec.bodyweight ? (
          <>
            <RecordTile title="Максимум повторов" value={`${rec.maxReps!.maxReps}`} sub={fmtDate(rec.maxReps!.date)} />
            <RecordTile
              title="Тренировок"
              value={`${points.length}`}
              sub={`с ${shortDate(points[0].date)}`}
            />
          </>
        ) : (
          <>
            <RecordTile
              title="Максимальный вес"
              value={`${fmtNum(rec.maxWeight!.maxWeight)} кг`}
              sub={fmtDate(rec.maxWeight!.date)}
            />
            <RecordTile
              title="Расчётный 1ПМ"
              value={`${fmtNum(Math.round(rec.bestE1rm!.bestE1rm * 10) / 10)} кг`}
              sub={`из ${fmtNum(rec.bestE1rm!.bestSet.weight)} кг × ${rec.bestE1rm!.bestSet.reps}`}
            />
            <RecordTile
              title="Лучший тоннаж"
              value={`${fmtNum(rec.bestTonnage!.tonnage)} кг`}
              sub={fmtDate(rec.bestTonnage!.date)}
            />
            <RecordTile
              title="Тренировок"
              value={`${points.length}`}
              sub={`с ${shortDate(points[0].date)}`}
            />
          </>
        )}
      </dl>

      {!enoughForChart && (
        <p className="hint chart-wait">Графики появятся после второй тренировки с этим упражнением.</p>
      )}

      {enoughForChart &&
        (rec.bodyweight ? (
          <section className="card chart-card">
            <h3 className="chart-title">Максимум повторов за тренировку</h3>
            <TrendChart
              kind="line"
              unit="повт."
              ariaLabel="График максимума повторов по тренировкам"
              data={toData(points, (p) => p.maxReps)}
            />
          </section>
        ) : (
          <>
            <section className="card chart-card">
              <h3 className="chart-title">Максимальный вес</h3>
              <TrendChart
                kind="line"
                unit="кг"
                ariaLabel="График максимального веса по тренировкам"
                data={toData(points, (p) => p.maxWeight)}
              />
            </section>
            <section className="card chart-card">
              <h3 className="chart-title">Тоннаж за тренировку</h3>
              <TrendChart
                kind="bar"
                unit="кг"
                axisFormat={compactKg}
                ariaLabel="График тоннажа по тренировкам"
                data={toData(points, (p) => p.tonnage)}
              />
            </section>
          </>
        ))}
    </>
  );
}

/** Строка ведомости рекордов: что за рекорд слева, значение и откуда оно — справа. */
function RecordTile({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="ledger-row">
      <dt>{title}</dt>
      <dd>
        {value}
        <span className="ledger-sub">{sub}</span>
      </dd>
    </div>
  );
}
