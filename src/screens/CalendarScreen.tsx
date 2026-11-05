import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayISO } from '../db/db';
import { discardWorkout } from '../db/workout';
import type { MuscleGroup, Session } from '../db/types';
import { ActionSheet, type SheetAction } from '../components/ActionSheet';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { SessionCard } from '../components/calendar/SessionCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { IconBack, IconChevron } from '../components/icons';
import { useNav } from '../nav/Nav';
import { confirmDialog, haptic } from '../telegram/telegram';
import { useStartWorkout } from '../workout/useStartWorkout';
import { isoOf, monthTitle } from '../utils/dates';
import { fmtDate } from '../utils/format';
import { plural } from '../utils/plural';

const finished = (s: Session) => s.finishedAt !== null;

/** Вкладка «Календарь»: месяц с днями тренировок и история выбранного дня. */
export function CalendarScreen() {
  const nav = useNav();
  const startWorkout = useStartWorkout();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);
  // Откуда въезжает новый месяц: стрелка «вперёд» — справа, «назад» — слева
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const [sheet, setSheet] = useState<{ title: string; actions: SheetAction[] } | null>(null);

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const templates = useLiveQuery(() => db.templates.orderBy('updatedAt').reverse().toArray(), []);
  const exercisesById = useMemo(() => new Map(exercises?.map((e) => [e.id, e])), [exercises]);

  // Тренировки текущего месяца — для подсветки дней и итога месяца
  const month = useLiveQuery(async () => {
    const from = isoOf(cursor.y, cursor.m, 1);
    const to = isoOf(cursor.y, cursor.m + 1, 0);
    const sessions = await db.sessions.where('date').between(from, to, true, true).filter(finished).toArray();
    const sets = sessions.length ? await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray() : [];
    return { sessions, sets: sets.filter((s) => s.isDone) };
  }, [cursor.y, cursor.m]);

  // Тренировки выбранного дня
  const day = useLiveQuery(async () => {
    const sessions = (await db.sessions.where('date').equals(selected).filter(finished).toArray()).sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    const sets = sessions.length ? await db.sets.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray() : [];
    return { sessions, sets };
  }, [selected]);

  // Для каждого дня — группы мышц по убыванию числа подходов
  const dayGroups = useMemo(() => {
    const result = new Map<string, MuscleGroup[]>();
    if (!month || !exercises) return result;
    const dateOf = new Map(month.sessions.map((s) => [s.id, s.date]));
    const counts = new Map<string, Map<MuscleGroup, number>>();
    for (const s of month.sessions) counts.set(s.date, new Map());
    for (const set of month.sets) {
      const date = dateOf.get(set.sessionId);
      const g = exercisesById.get(set.exerciseId)?.muscleGroup;
      if (!date || !g) continue;
      const c = counts.get(date)!;
      c.set(g, (c.get(g) ?? 0) + 1);
    }
    for (const [date, c] of counts) {
      result.set(
        date,
        [...c.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g),
      );
    }
    return result;
  }, [month, exercises, exercisesById]);

  const shiftMonth = (delta: number) => {
    haptic.select();
    setDir(delta > 0 ? 'next' : 'prev');
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const goToday = () => {
    const d = new Date();
    setDir(cursor.y * 12 + cursor.m > d.getFullYear() * 12 + d.getMonth() ? 'prev' : 'next');
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  const chooseWorkout = () =>
    setSheet({
      title: 'Какую тренировку начать?',
      actions: [
        ...(templates ?? []).map((t) => ({ label: t.name, onClick: () => startWorkout(t.id) })),
        { label: 'Без шаблона', onClick: () => startWorkout(null) },
      ],
    });

  const sessionMenu = (s: Session) =>
    setSheet({
      title: s.name,
      actions: [
        {
          label: 'Удалить тренировку',
          danger: true,
          onClick: async () => {
            if (await confirmDialog(`Удалить тренировку «${s.name}» от ${fmtDate(s.date, false)}? Это нельзя отменить.`, { ok: 'Удалить', danger: true })) {
              await discardWorkout(s.id);
              haptic.warning();
            }
          },
        },
      ],
    });

  const monthCount = month?.sessions.length ?? 0;
  const isCurrentMonth = cursor.y === new Date().getFullYear() && cursor.m === new Date().getMonth();

  return (
    <div className="screen">
      <ScreenHeader
        title="Календарь"
        right={
          !isCurrentMonth || selected !== today ? (
            <button className="btn btn-ghost" onClick={goToday}>
              Сегодня
            </button>
          ) : undefined
        }
      />

      <div className="card calendar-card">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
            <IconBack />
          </button>
          <span className="month-title">{monthTitle(cursor.y, cursor.m)}</span>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
            <IconChevron />
          </button>
        </div>

        <div key={`${cursor.y}-${cursor.m}`} className={dir ? `month-slide month-from-${dir} motion-move` : undefined}>
          <MonthGrid
            year={cursor.y}
            month={cursor.m}
            today={today}
            selected={selected}
            dayGroups={dayGroups}
            onSelect={setSelected}
          />
        </div>

        <p className="month-summary">
          {monthCount
            ? `${monthCount} ${plural(monthCount, ['тренировка', 'тренировки', 'тренировок'])} за месяц`
            : 'В этом месяце тренировок нет'}
        </p>
      </div>

      <button className="btn btn-primary btn-block btn-lg start-btn" onClick={chooseWorkout}>
        Начать тренировку
      </button>

      <h2 className="group-title day-title">
        {selected === today ? 'Сегодня' : fmtDate(selected)}
        {day && day.sessions.length > 0 && <span className="group-count">{day.sessions.length}</span>}
      </h2>

      {day && day.sessions.length === 0 && (
        <p className="empty">{selected > today ? 'Этот день ещё впереди.' : 'В этот день тренировок не было.'}</p>
      )}

      {day?.sessions.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          sets={day.sets.filter((x) => x.sessionId === s.id)}
          exercisesById={exercisesById}
          onOpenExercise={(id) => nav.push({ name: 'exercise', id })}
          onMenu={() => sessionMenu(s)}
        />
      ))}

      {sheet && <ActionSheet key={sheet.title} {...sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
