import type { ReactNode } from 'react';
import { haptic } from '../telegram/telegram';
import { IconCalendar, IconChart, IconDumbbell, IconList } from './icons';

export type TabId = 'calendar' | 'templates' | 'exercises' | 'progress';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'calendar', label: 'Календарь', icon: <IconCalendar /> },
  { id: 'templates', label: 'Тренировки', icon: <IconList /> },
  { id: 'exercises', label: 'Упражнения', icon: <IconDumbbell /> },
  { id: 'progress', label: 'Прогресс', icon: <IconChart /> },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={'tabbar-item' + (t.id === active ? ' active' : '')}
          onClick={() => {
            if (t.id !== active) haptic.select();
            onChange(t.id);
          }}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
