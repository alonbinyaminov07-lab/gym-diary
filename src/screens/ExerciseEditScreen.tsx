import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { deleteExercise, exerciseHasHistory, saveExercise } from '../db/repo';
import { useLiveQuery } from 'dexie-react-hooks';
import { normalize } from '../utils/format';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '../db/types';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlateDot } from '../components/PlateMark';
import { useBackGuard, useNav } from '../nav/Nav';
import { alertDialog, confirmDialog, haptic } from '../telegram/telegram';

/**
 * Создание своего упражнения или редактирование существующего.
 * У встроенных упражнений можно менять только заметку.
 */
export function ExerciseEditScreen({ id, onSaved }: { id?: string; onSaved?: (id: string) => void }) {
  const nav = useNav();
  const [original, setOriginal] = useState<Exercise | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    db.exercises.get(id).then((ex) => {
      if (ex) {
        setOriginal(ex);
        setName(ex.name);
        setGroup(ex.muscleGroup);
        setEquipment(ex.equipment);
        setNotes(ex.notes);
      }
      setLoaded(true);
    });
  }, [id]);

  const isBuiltIn = !!original && !original.isCustom;
  // Два упражнения с одинаковым названием путали бы справочник и историю
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);
  const duplicate =
    !isBuiltIn &&
    name.trim() !== '' &&
    !!allExercises?.some((e) => e.id !== id && normalize(e.name) === normalize(name));
  const dirty = original
    ? name !== original.name || group !== original.muscleGroup || equipment !== original.equipment || notes !== original.notes
    : name.trim() !== '' || notes !== '';

  useBackGuard(dirty ? () => confirmDialog('Изменения не сохранены.', { ok: 'Выйти без сохранения', cancel: 'Остаться', danger: true }) : null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || duplicate) return;
    const newId = await saveExercise({
      id,
      name: trimmed,
      muscleGroup: group,
      equipment,
      notes: notes.trim(),
      isCustom: original ? original.isCustom : true,
    });
    haptic.success();
    nav.forcePop();
    onSaved?.(newId);
  };

  const remove = async () => {
    if (!id) return;
    // Сначала проверяем историю, чтобы не спрашивать «Удалить?», а потом отказывать
    if (await exerciseHasHistory(id)) {
      await alertDialog('По этому упражнению уже есть история тренировок — удалить его нельзя, иначе история потеряется.');
      return;
    }
    if (!(await confirmDialog(`Удалить «${name}»?`, { ok: 'Удалить', danger: true }))) return;
    const res = await deleteExercise(id);
    if (!res.ok) {
      await alertDialog(res.reason);
      return;
    }
    // Закрываем редактор и карточку удалённого упражнения
    nav.forcePop();
    nav.forcePop();
  };

  if (!loaded) return <div className="screen" />;

  return (
    <div className="screen">
      <ScreenHeader title={id ? 'Редактирование' : 'Новое упражнение'} />

      <label className="field">
        <span className="field-label">Название</span>
        <input
          className={'input' + (duplicate ? ' input-invalid' : '')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Жим Арнольда"
          disabled={isBuiltIn}
          autoFocus={!id}
          aria-invalid={duplicate || undefined}
        />
        {duplicate && (
          <span className="field-error" role="alert">
            Упражнение с таким названием уже есть в справочнике.
          </span>
        )}
      </label>

      <div className="field">
        <span className="field-label">Группа мышц</span>
        <div className="chips chips-wrap">
          {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((g) => (
            <button
              key={g}
              className={'chip' + (group === g ? ' active' : '')}
              onClick={() => setGroup(g)}
              disabled={isBuiltIn}
            >
              <PlateDot group={g} />
              {MUSCLE_GROUPS[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Оборудование</span>
        <div className="chips chips-wrap">
          {(Object.keys(EQUIPMENT) as Equipment[]).map((eq) => (
            <button
              key={eq}
              className={'chip' + (equipment === eq ? ' active' : '')}
              onClick={() => setEquipment(eq)}
              disabled={isBuiltIn}
            >
              {EQUIPMENT[eq]}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Заметка</span>
        <textarea
          className="input textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Техника, настройки тренажёра, хват…"
          rows={3}
        />
      </label>

      {isBuiltIn && <p className="hint">Это упражнение из встроенного справочника — у него можно менять только заметку.</p>}

      {original?.isCustom && (
        <button className="btn btn-danger btn-block" onClick={remove}>
          Удалить упражнение
        </button>
      )}

      <MainButton text="Сохранить" onClick={save} disabled={!name.trim() || duplicate || (!!id && !dirty)} />
    </div>
  );
}
