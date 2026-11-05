import { useEffect, useRef, useState } from 'react';
import { loadProfile, prepareAvatar, saveCurrentWeight, saveProfile, telegramUser, weightInfo } from '../db/profile';
import { todayISO } from '../db/db';
import { GOALS, goalsOf, type Goal, type Profile, type Sex } from '../db/types';
import { Avatar } from '../components/Avatar';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useBackGuard, useNav } from '../nav/Nav';
import { alertDialog, confirmDialog, haptic } from '../telegram/telegram';

const toField = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));
const parse = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
};
const decimal = (raw: string) => raw.replace('.', ',').replace(/[^0-9,]/g, '').slice(0, 5);

interface Draft {
  name: string;
  photo?: string;
  sex?: Sex;
  birthDate: string;
  height: string;
  weight: string;
  target: string;
  goals: Goal[];
}

/** Редактирование профиля. Текущий вес сохраняется как сегодняшний замер тела. */
export function ProfileEditScreen() {
  const nav = useNav();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initial, setInitial] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const tgPhoto = telegramUser()?.photo_url;

  useEffect(() => {
    Promise.all([loadProfile(), weightInfo()]).then(([p, w]) => {
      const d: Draft = {
        name: p.name,
        photo: p.photo,
        sex: p.sex,
        birthDate: p.birthDate ?? '',
        height: toField(p.heightCm),
        weight: toField(w.current),
        target: toField(p.targetWeight),
        goals: goalsOf(p),
      };
      setDraft(d);
      setInitial(JSON.stringify(d));
    });
  }, []);

  const dirty = !!draft && JSON.stringify(draft) !== initial;
  useBackGuard(dirty ? () => confirmDialog('Изменения не сохранены.', { ok: 'Выйти без сохранения', cancel: 'Остаться', danger: true }) : null);

  if (!draft) return <div className="screen" />;
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const pickPhoto = async (file?: File) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setBusy(true);
    try {
      set({ photo: await prepareAvatar(file) });
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : 'Не удалось загрузить фото.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const profile: Omit<Profile, 'id' | 'updatedAt'> = {
      name: draft.name.trim(),
      photo: draft.photo,
      sex: draft.sex,
      birthDate: draft.birthDate || undefined,
      heightCm: parse(draft.height),
      targetWeight: parse(draft.target),
      goals: draft.goals.length ? draft.goals : undefined,
    };
    await saveProfile(profile);
    const weight = parse(draft.weight);
    const before = parse(JSON.parse(initial).weight as string);
    if (weight !== undefined && weight !== before) await saveCurrentWeight(weight);
    haptic.success();
    nav.forcePop();
  };

  const preview: Profile = { id: 'me', name: draft.name, photo: draft.photo, updatedAt: 0 };
  const heightOdd = (() => {
    const h = parse(draft.height);
    return h !== undefined && (h < 100 || h > 250);
  })();
  const weightOdd = (v: string) => {
    const w = parse(v);
    return w !== undefined && (w < 30 || w > 250);
  };

  return (
    <div className="screen">
      <ScreenHeader title="Профиль" />

      <div className="photo-edit">
        <Avatar profile={preview} size={88} />
        <div className="photo-actions">
          <label className={'btn btn-secondary' + (busy ? ' busy' : '')}>
            {draft.photo ? 'Сменить фото' : 'Выбрать фото'}
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          {draft.photo && (
            <button className="btn btn-ghost" onClick={() => set({ photo: undefined })}>
              {tgPhoto ? 'Взять из Telegram' : 'Убрать фото'}
            </button>
          )}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Имя</span>
        <input className="input" value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="Как к вам обращаться" />
      </label>

      <div className="field">
        <span className="field-label">Пол</span>
        <div className="chips chips-wrap">
          {(
            [
              ['m', 'Мужской'],
              ['f', 'Женский'],
            ] as [Sex, string][]
          ).map(([v, label]) => (
            <button key={v} className={'chip' + (draft.sex === v ? ' active' : '')} onClick={() => set({ sex: draft.sex === v ? undefined : v })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Дата рождения</span>
        <input className="input" type="date" value={draft.birthDate} max={todayISO()} min="1920-01-01" onChange={(e) => set({ birthDate: e.target.value })} />
      </label>

      <div className="card measure-form">
        <label className={'measure-row' + (heightOdd ? ' measure-warn' : '')}>
          <span className="measure-label">
            Рост
            {heightOdd && <span className="measure-warn-text">Проверьте значение</span>}
          </span>
          <span className="measure-input-wrap">
            <input className="num-field measure-input" inputMode="decimal" value={draft.height} placeholder="—" onFocus={(e) => e.target.select()} onChange={(e) => set({ height: decimal(e.target.value) })} />
            <span className="measure-unit">см</span>
          </span>
        </label>
        <label className={'measure-row' + (weightOdd(draft.weight) ? ' measure-warn' : '')}>
          <span className="measure-label">
            Текущий вес
            <span className={weightOdd(draft.weight) ? 'measure-warn-text' : 'measure-note'}>
              {weightOdd(draft.weight) ? 'Проверьте значение' : 'Запишется в замеры тела'}
            </span>
          </span>
          <span className="measure-input-wrap">
            <input className="num-field measure-input" inputMode="decimal" value={draft.weight} placeholder="—" onFocus={(e) => e.target.select()} onChange={(e) => set({ weight: decimal(e.target.value) })} />
            <span className="measure-unit">кг</span>
          </span>
        </label>
        <label className={'measure-row' + (weightOdd(draft.target) ? ' measure-warn' : '')}>
          <span className="measure-label">
            Целевой вес
            {weightOdd(draft.target) && <span className="measure-warn-text">Проверьте значение</span>}
          </span>
          <span className="measure-input-wrap">
            <input className="num-field measure-input" inputMode="decimal" value={draft.target} placeholder="—" onFocus={(e) => e.target.select()} onChange={(e) => set({ target: decimal(e.target.value) })} />
            <span className="measure-unit">кг</span>
          </span>
        </label>
      </div>

      <div className="field goal-field">
        <span className="field-label">Цели — можно выбрать несколько</span>
        <div className="chips chips-wrap">
          {(Object.keys(GOALS) as Goal[]).map((g) => (
            <button
              key={g}
              className={'chip' + (draft.goals.includes(g) ? ' active' : '')}
              aria-pressed={draft.goals.includes(g)}
              onClick={() => {
                haptic.select();
                const next = draft.goals.includes(g) ? draft.goals.filter((x) => x !== g) : [...draft.goals, g];
                set({ goals: goalsOf({ goals: next }) });
              }}
            >
              {GOALS[g]}
            </button>
          ))}
        </div>
      </div>

      <MainButton text="Сохранить" onClick={save} disabled={!dirty || busy} />
    </div>
  );
}
