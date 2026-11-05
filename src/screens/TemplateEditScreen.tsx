import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { db } from '../db/db';
import { defaultTemplateExercise, deleteTemplate, duplicateTemplate, saveTemplate } from '../db/repo';
import type { TemplateExercise } from '../db/types';
import { MainButton } from '../components/MainButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TemplateExerciseCard } from '../components/TemplateExerciseCard';
import { IconPlus } from '../components/icons';
import { useBackGuard, useNav } from '../nav/Nav';
import { confirmDialog, haptic, setSwipeLock } from '../telegram/telegram';

/** Создание и редактирование шаблона тренировки. */
export function TemplateEditScreen({ id }: { id?: string }) {
  const nav = useNav();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const byId = new Map(exercises?.map((e) => [e.id, e]));

  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [initial, setInitial] = useState(() => JSON.stringify({ name: '', items: [] }));

  useEffect(() => {
    if (!id) return;
    db.templates.get(id).then((t) => {
      if (t) {
        setName(t.name);
        setItems(t.exercises);
        setInitial(JSON.stringify({ name: t.name, items: t.exercises }));
      }
      setLoaded(true);
    });
  }, [id]);

  const dirty = loaded && JSON.stringify({ name, items }) !== initial;
  useBackGuard(dirty ? () => confirmDialog('Изменения не сохранены.', { ok: 'Выйти без сохранения', cancel: 'Остаться', danger: true }) : null);

  const update = (index: number, patch: Partial<TemplateExercise>) =>
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  // Перетаскивание: мышью/пальцем (сдвиг от 5px) и с клавиатуры
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = () => {
    haptic.medium();
    // Чтобы Telegram не свернул приложение, когда тянешь карточку вниз
    setSwipeLock(true);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setSwipeLock(false);
    if (!over || active.id === over.id) return;
    setItems((list) => {
      const from = list.findIndex((i) => i.exerciseId === active.id);
      const to = list.findIndex((i) => i.exerciseId === over.id);
      return arrayMove(list, from, to);
    });
    haptic.light();
  };

  const remove = (index: number) => {
    haptic.light();
    setItems((list) => list.filter((_, i) => i !== index));
  };

  const addExercises = () =>
    nav.push({
      name: 'pickExercises',
      exclude: items.map((i) => i.exerciseId),
      onPick: async (ids) => {
        const picked = await db.exercises.bulkGet(ids);
        setItems((list) => [...list, ...picked.filter((e) => !!e).map((e) => defaultTemplateExercise(e!))]);
      },
    });

  const save = async () => {
    await saveTemplate({ id, name: name.trim(), exercises: items });
    haptic.success();
    nav.forcePop();
  };

  const removeTemplate = async () => {
    if (!id || !(await confirmDialog(`Удалить тренировку «${name}»? Проведённые тренировки в истории останутся.`, { ok: 'Удалить', danger: true }))) return;
    await deleteTemplate(id);
    nav.forcePop();
  };

  const copyTemplate = async () => {
    if (!id) return;
    if (dirty) await saveTemplate({ id, name: name.trim(), exercises: items });
    await duplicateTemplate(id);
    haptic.success();
    nav.forcePop();
  };

  if (!loaded) return <div className="screen" />;

  return (
    <div className="screen">
      <ScreenHeader title={id ? 'Редактирование' : 'Новая тренировка'} />

      <label className="field">
        <span className="field-label">Название</span>
        <input
          className="input input-lg"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Грудь + трицепс"
          autoFocus={!id}
        />
      </label>

      <h2 className="group-title">Упражнения</h2>

      {items.length === 0 && <p className="empty">Добавьте упражнения, которые входят в эту тренировку.</p>}

      {items.length > 1 && <p className="hint">Порядок меняется перетаскиванием за ⠿</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={onDragStart}
        onDragOver={() => haptic.select()}
        onDragEnd={onDragEnd}
        onDragCancel={() => setSwipeLock(false)}
      >
        <SortableContext items={items.map((i) => i.exerciseId)} strategy={verticalListSortingStrategy}>
          {items.map((it, index) => (
            <TemplateExerciseCard
              key={it.exerciseId}
              item={it}
              index={index}
              name={byId.get(it.exerciseId)?.name ?? 'Удалённое упражнение'}
              group={byId.get(it.exerciseId)?.muscleGroup}
              onChange={(patch) => update(index, patch)}
              onRemove={() => remove(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button className="btn btn-secondary btn-block btn-lg add-btn" onClick={addExercises}>
        <IconPlus /> Добавить упражнения
      </button>

      {id && (
        <div className="danger-zone">
          <button className="btn btn-ghost btn-block" onClick={copyTemplate}>
            Сделать копию
          </button>
          <button className="btn btn-danger btn-block" onClick={removeTemplate}>
            Удалить тренировку
          </button>
        </div>
      )}

      <MainButton
        text="Сохранить"
        onClick={save}
        disabled={!name.trim() || items.some((i) => i.repsMax < i.repsMin) || (!!id && !dirty)}
      />
    </div>
  );
}
