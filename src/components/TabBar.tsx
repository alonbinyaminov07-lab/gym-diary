import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadProfile, telegramUser } from '../db/profile';
import { haptic } from '../telegram/telegram';
import { Avatar } from './Avatar';
import { IconCalendar, IconChart, IconDumbbell, IconList, IconUser } from './icons';

export type TabId = 'calendar' | 'templates' | 'profile' | 'exercises' | 'progress';

/** Нижнее меню. «Профиль» — по центру, с маленьким фото пользователя вместо иконки. */
export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const profile = useLiveQuery(() => loadProfile(), []);
  // Есть фото — показываем его кружком; нет — обычная иконка в стиле остальных вкладок
  const hasPhoto = !!(profile?.photo ?? telegramUser()?.photo_url);

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'calendar', label: 'Календарь', icon: <IconCalendar /> },
    { id: 'templates', label: 'Тренировки', icon: <IconList /> },
    { id: 'profile', label: 'Профиль', icon: hasPhoto ? <Avatar profile={profile} size={24} /> : <IconUser /> },
    { id: 'exercises', label: 'Упражнения', icon: <IconDumbbell /> },
    { id: 'progress', label: 'Прогресс', icon: <IconChart /> },
  ];

  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={'tabbar-item' + (t.id === active ? ' active' : '') + (t.id === 'profile' ? ' tabbar-profile' : '')}
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => {
            if (t.id !== active) haptic.select();
            onChange(t.id);
          }}
        >
          <span className="tabbar-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
