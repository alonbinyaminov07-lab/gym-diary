import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { NavProvider, ScreenContext, lastActiveIndex, useNav } from './nav/Nav';
import type { StackEntry } from './nav/routes';
import { CalendarScreen } from './screens/CalendarScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExerciseEditScreen } from './screens/ExerciseEditScreen';
import { TemplateEditScreen } from './screens/TemplateEditScreen';
import { ExercisePickerScreen } from './screens/ExercisePickerScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { MeasurementEditScreen } from './screens/MeasurementEditScreen';
import { DataScreen } from './screens/DataScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { WorkoutSummaryScreen } from './screens/WorkoutSummaryScreen';
import { ActiveWorkoutBanner } from './components/workout/ActiveWorkoutBanner';
import { getActiveSession } from './db/workout';
import { DialogHost } from './components/DialogHost';
import { isTelegram, tg } from './telegram/telegram';
import { syncBot } from './bot/botSync';

// Экран с графиками грузится отдельно, только когда его открывают (библиотека графиков тяжёлая)
const ProgressScreen = lazy(() => import('./screens/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));

export function App() {
  return (
    <NavProvider>
      <Shell />
      <DialogHost />
    </NavProvider>
  );
}

function Shell() {
  const { stack, push } = useNav();
  // Приложение открывается на профиле
  const [tab, setTab] = useState<TabId>('profile');
  const rootRef = useRef<HTMLDivElement>(null);

  // Если приложение закрыли посреди тренировки — сразу возвращаем на неё
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    getActiveSession().then((s) => {
      if (s) push({ name: 'workout', sessionId: s.id });
    });
  }, [push]);

  // При запуске сообщаем боту часовой пояс, настройки и дату последней тренировки
  useEffect(() => {
    void syncBot();
  }, []);

  // Пункт «Настройки» в меню «⋯» Telegram открывает экран «Данные» (резервная копия)
  useEffect(() => {
    const settings = tg?.SettingsButton;
    if (!isTelegram || !settings || !tg?.isVersionAtLeast('6.10')) return;
    const open = () => push({ name: 'data' });
    settings.show();
    settings.onClick(open);
    return () => settings.offClick(open);
  }, [push]);

  // При смене вкладки — прокрутка в начало
  useEffect(() => {
    rootRef.current?.scrollTo(0, 0);
  }, [tab]);

  const top = lastActiveIndex(stack);

  return (
    <>
      <Layer layerKey="root" state={top < 0 ? 'top' : 'behind'} isRoot innerRef={rootRef}>
        <main className="app-content">
          {tab === 'profile' && <ProfileScreen />}
          {tab === 'calendar' && <CalendarScreen />}
          {tab === 'templates' && <TemplatesScreen />}
          {tab === 'exercises' && <ExercisesScreen />}
          {tab === 'progress' && (
            <Suspense fallback={<div className="screen" />}>
              <ProgressScreen />
            </Suspense>
          )}
        </main>
        <ActiveWorkoutBanner />
        <TabBar active={tab} onChange={setTab} />
      </Layer>
      {stack.map((entry, i) => (
        <Layer
          key={entry.key}
          layerKey={entry.key}
          state={entry.leaving ? 'leaving' : i === top ? 'top' : 'behind'}
          enter={entry.enter ?? 'slide'}
          isRoot={false}
        >
          <RouteView route={entry} />
        </Layer>
      ))}
    </>
  );
}

type LayerState = 'top' | 'behind' | 'leaving';

/**
 * Слой-экран. Нижние слои остаются под верхним (с сохранённым состоянием и прокруткой).
 * top — активный; behind — под активным, слегка сдвинут влево; leaving — уезжает вправо.
 */
function Layer({
  layerKey,
  state,
  enter,
  isRoot,
  innerRef,
  children,
}: {
  layerKey: string;
  state: LayerState;
  enter?: 'slide' | 'fade';
  isRoot: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const isTop = state === 'top';
  // Экраны под верхним недоступны и с клавиатуры (Tab), и для программ чтения экрана
  const outerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (outerRef.current) outerRef.current.inert = !isTop;
  }, [isTop]);
  const cls =
    'layer' +
    (enter ? ` layer-enter-${enter} motion-move` : '') +
    (state === 'behind' ? ' layer-hidden layer-behind' : '') +
    (state === 'leaving' ? ' layer-hidden layer-leave motion-move-out' : '');
  return (
    <ScreenContext.Provider value={{ key: layerKey, isTop, isRoot }}>
      {/* Внешний блок двигается при переходах, внутренний — прокручивается.
          Так закреплённые элементы (нижнее меню, таймер) не уезжают вместе с прокруткой. */}
      <div ref={outerRef} className={cls} aria-hidden={!isTop}>
        <div ref={innerRef} className="layer-scroll">
          {children}
        </div>
      </div>
    </ScreenContext.Provider>
  );
}

function RouteView({ route }: { route: StackEntry }) {
  switch (route.name) {
    case 'exercise':
      return <ExerciseDetailScreen id={route.id} />;
    case 'exerciseEdit':
      return <ExerciseEditScreen id={route.id} onSaved={route.onSaved} />;
    case 'templateEdit':
      return <TemplateEditScreen id={route.id} />;
    case 'measurementEdit':
      return <MeasurementEditScreen id={route.id} />;
    case 'data':
      return <DataScreen />;
    case 'profileEdit':
      return <ProfileEditScreen />;
    case 'workout':
      return <WorkoutScreen sessionId={route.sessionId} />;
    case 'workoutSummary':
      return <WorkoutSummaryScreen sessionId={route.sessionId} />;
    case 'pickExercises':
      return (
        <ExercisePickerScreen
          title={route.title}
          exclude={route.exclude}
          single={route.single}
          initialGroup={route.initialGroup}
          onPick={route.onPick}
        />
      );
  }
}
