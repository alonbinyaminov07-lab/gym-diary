import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { activity, ageFrom, bmi, loadProfile, prepareAvatar, saveProfile, weightInfo } from '../db/profile';
import { GOALS } from '../db/types';
import { Avatar } from '../components/Avatar';
import { IconSettings } from '../components/icons';
import { useNav } from '../nav/Nav';
import { alertDialog, haptic } from '../telegram/telegram';
import { fmtNum } from '../utils/format';
import { plural } from '../utils/plural';
import { compactKgText } from '../utils/units';

/** Вкладка «Профиль» — открывается первой: фото, данные тела и активность. */
export function ProfileScreen() {
  const nav = useNav();
  const profile = useLiveQuery(() => loadProfile(), []);
  const weight = useLiveQuery(() => weightInfo(), []);
  const act = useLiveQuery(() => activity(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!profile || !weight || !act) return <div className="screen" />;

  const age = ageFrom(profile.birthDate);
  const index = bmi(weight.current, profile.heightCm);
  const filled = !!(profile.heightCm || profile.birthDate || weight.current || profile.targetWeight);
  const edit = () => nav.push({ name: 'profileEdit' });

  const onPhoto = async (file?: File) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const photo = await prepareAvatar(file);
      await saveProfile({ ...profile, photo });
      haptic.success();
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : 'Не удалось загрузить фото.');
    } finally {
      setBusy(false);
    }
  };

  // Сколько осталось до целевого веса и как вес изменился с прошлого замера
  const target = profile.targetWeight;
  const delta = weight.current !== undefined && weight.previous !== undefined ? weight.current - weight.previous : null;
  const left = target && weight.current ? Math.round((weight.current - target) * 10) / 10 : null;

  const subtitle = [
    profile.goal ? GOALS[profile.goal] : null,
    act.streakWeeks >= 2 ? `${act.streakWeeks} ${plural(act.streakWeeks, ['неделя', 'недели', 'недель'])} подряд в зале` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <div className="screen profile">
      <div className="profile-top">
        <button className="icon-btn header-action" onClick={() => nav.push({ name: 'data' })} aria-label="Настройки: напоминания и резервная копия">
          <IconSettings />
        </button>
      </div>

      <section className="profile-hero">
        <label className={'avatar-btn' + (busy ? ' busy' : '')} aria-label="Выбрать фото профиля">
          <Avatar profile={profile} size={104} />
          <span className="avatar-badge" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        <h1 className="profile-name">{profile.name || 'Ваш профиль'}</h1>
        {subtitle && <p className="profile-sub">{subtitle}</p>}
        {filled && (
          <button className="btn btn-ghost profile-edit-link" onClick={edit}>
            Изменить данные
          </button>
        )}
      </section>

      {!filled ? (
        <div className="card empty-card profile-empty">
          <p>Добавьте рост, вес и дату рождения — дневник посчитает индекс массы тела и будет показывать путь к цели.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={edit}>
            Заполнить профиль
          </button>
        </div>
      ) : (
        /* Данные тела — компактная «анкета» в две колонки */
        <dl className="card spec">
          <div className="spec-cell">
            <dt>Вес</dt>
            <dd>{weight.current !== undefined ? `${fmtNum(weight.current)} кг` : '—'}</dd>
            {delta !== null && delta !== 0 && (
              <span className="spec-sub">
                {delta > 0 ? '+' : '−'}
                {fmtNum(Math.abs(Math.round(delta * 10) / 10))} с прошлого
              </span>
            )}
          </div>
          <div className="spec-cell">
            <dt>Цель</dt>
            <dd>{target ? `${fmtNum(target)} кг` : '—'}</dd>
            {target && (
              <span className="spec-sub">
                {left === null ? 'нет текущего веса' : left === 0 ? 'достигнута' : `осталось ${fmtNum(Math.abs(left))} кг`}
              </span>
            )}
          </div>
          <div className="spec-cell">
            <dt>Рост</dt>
            <dd>{profile.heightCm ? `${fmtNum(profile.heightCm)} см` : '—'}</dd>
          </div>
          <div className="spec-cell">
            <dt>Возраст</dt>
            <dd>{age !== null ? `${age} ${plural(age, ['год', 'года', 'лет'])}` : '—'}</dd>
          </div>
          <div className="spec-cell">
            <dt>Индекс массы тела</dt>
            <dd>{index ? fmtNum(index.value) : '—'}</dd>
            {index && <span className="spec-sub">{index.label}</span>}
          </div>
          <div className="spec-cell">
            <dt>Тренировок</dt>
            <dd>{act.total}</dd>
          </div>
        </dl>
      )}

      <dl className="card ledger profile-activity">
        {!filled && (
          <div className="ledger-row">
            <dt>Тренировок</dt>
            <dd>{act.total}</dd>
          </div>
        )}
        <div className="ledger-row">
          <dt>Поднято за всё время</dt>
          <dd>{compactKgText(act.tonnage)}</dd>
        </div>
        <div className="ledger-row">
          <dt>Последняя тренировка</dt>
          <dd>
            {act.daysSinceLast === null
              ? '—'
              : act.daysSinceLast === 0
                ? 'сегодня'
                : act.daysSinceLast === 1
                  ? 'вчера'
                  : `${act.daysSinceLast} ${plural(act.daysSinceLast, ['день', 'дня', 'дней'])} назад`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
