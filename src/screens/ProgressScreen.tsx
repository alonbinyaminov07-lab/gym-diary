import { useLiveQuery } from 'dexie-react-hooks';
import { currentWeek, muscleGroupSets, overallStats, weeklyStats } from '../db/stats';
import { todayISO } from '../db/db';
import { WEEKDAYS } from '../utils/dates';
import { MUSCLE_GROUPS } from '../db/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlateMark } from '../components/PlateMark';
import { TrendChart, compactKg } from '../components/charts/TrendChart';
import { MeasurementsSection } from '../components/charts/MeasurementsSection';
import { IconSettings } from '../components/icons';
import { useNav } from '../nav/Nav';
import { fmtNum } from '../utils/format';
import { plural } from '../utils/plural';

/** Вкладка «Прогресс»: общая статистика, недели, группы мышц, замеры тела. */
export function ProgressScreen() {
  const nav = useNav();
  const stats = useLiveQuery(() => overallStats(), []);
  const weeks = useLiveQuery(() => weeklyStats(12), []);
  const groups = useLiveQuery(() => muscleGroupSets(30), []);
  const week = useLiveQuery(() => currentWeek(), []);
  const today = todayISO();

  const weekTip = (label: string) => `Неделя с ${label}`;
  const maxGroup = Math.max(1, ...(groups ?? []).map((g) => g.sets));

  return (
    <div className="screen">
      <ScreenHeader
        title="Прогресс"
        right={
          <button className="icon-btn header-action" onClick={() => nav.push({ name: 'data' })} aria-label="Настройки: напоминания и резервная копия">
            <IconSettings />
          </button>
        }
      />

      {stats && week && (
        <section className="week">
          <div className="week-strip" aria-label="Тренировки на этой неделе">
            {week.map((d, i) => (
              <div
                key={d.date}
                className={
                  'week-day' +
                  (d.groups.length ? ' has-workout' : '') +
                  (d.date === today ? ' today' : '') +
                  (d.date > today ? ' future' : '')
                }
              >
                <span className="week-day-wd">{WEEKDAYS[i]}</span>
                <span className="week-day-num">{Number(d.date.slice(8))}</span>
                <span className="day-plates" aria-hidden>
                  {d.groups.slice(0, 4).map((g) => (
                    <span key={g} className="day-plate" style={{ background: `var(--mg-${g})` }} />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="week-headline">
            {stats.thisWeek ? (
              <>
                <b>{stats.thisWeek}</b> {plural(stats.thisWeek, ['тренировка', 'тренировки', 'тренировок'])} на этой
                неделе
              </>
            ) : (
              'На этой неделе тренировок пока нет'
            )}
          </p>
          <p className="week-sub">
            {`В этом месяце ${stats.thisMonth} ${plural(stats.thisMonth, ['тренировка', 'тренировки', 'тренировок'])}`}
            {stats.monthTonnage > 0 && `, тоннаж ${compactKg(stats.monthTonnage)}${stats.monthTonnage >= 1000 ? '' : ' кг'}`}
            {`. Всего ${stats.total}.`}
          </p>
        </section>
      )}

      {stats && stats.total === 0 ? (
        <p className="hint">Проведите первую тренировку — здесь появятся графики по неделям и группам мышц.</p>
      ) : (
        weeks && (
          <>
            <section className="card chart-card">
              <h3 className="chart-title">Тренировки по неделям</h3>
              <TrendChart
                kind="bar"
                unit="трен."
                height={160}
                ariaLabel="Количество тренировок по неделям за 12 недель"
                data={weeks.map((w) => ({ key: w.weekStart, label: w.label, value: w.count, tip: weekTip(w.label) }))}
              />
            </section>

            <section className="card chart-card">
              <h3 className="chart-title">Тоннаж по неделям</h3>
              <TrendChart
                kind="bar"
                unit="кг"
                height={160}
                axisFormat={compactKg}
                ariaLabel="Тоннаж по неделям за 12 недель"
                data={weeks.map((w) => ({ key: w.weekStart, label: w.label, value: w.tonnage, tip: weekTip(w.label) }))}
              />
            </section>
          </>
        )
      )}

      {groups && groups.length > 0 && (
        <section className="card chart-card">
          <h3 className="chart-title">Подходы по группам мышц за 30 дней</h3>
          <div className="group-bars">
            {groups.map(({ group, sets }) => (
              <div key={group} className="group-bar">
                <PlateMark group={group} size="sm" />
                <span className="group-bar-name">{MUSCLE_GROUPS[group]}</span>
                <span className="group-bar-track">
                  <span
                    className="group-bar-fill"
                    style={{ width: `${(sets / maxGroup) * 100}%`, background: `var(--mg-${group})` }}
                  />
                </span>
                <span className="group-bar-value">{fmtNum(sets)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <MeasurementsSection />
    </div>
  );
}

