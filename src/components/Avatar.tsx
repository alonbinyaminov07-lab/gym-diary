import { useState } from 'react';
import { telegramUser } from '../db/profile';
import type { Profile } from '../db/types';

/**
 * Фото профиля: выбранное пользователем → аватар из Telegram → инициалы.
 * Если картинка не загрузилась (нет сети для аватара Telegram), показываются инициалы.
 */
export function Avatar({ profile, size }: { profile?: Profile; size: number }) {
  const [broken, setBroken] = useState(false);
  const tgPhoto = telegramUser()?.photo_url;
  const src = profile?.photo ?? tgPhoto;
  const name = profile?.name || telegramUser()?.first_name || '';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {src && !broken ? (
        <img src={src} alt="" width={size} height={size} onError={() => setBroken(true)} />
      ) : initials ? (
        initials
      ) : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
