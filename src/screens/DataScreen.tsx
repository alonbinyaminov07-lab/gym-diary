import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  backupFileName,
  buildBackup,
  countsOf,
  currentCounts,
  parseBackup,
  restoreBackup,
  type BackupCounts,
  type BackupFile,
} from '../backup/backupData';
import { cloudInfo, cloudMode, loadFromCloud, saveToCloud, type CloudMeta } from '../backup/cloudBackup';
import { copyText, readFile, saveFile } from '../backup/fileBackup';
import { ActionSheet, type SheetAction } from '../components/ActionSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { alertDialog, confirmDialog, haptic } from '../telegram/telegram';
import { plural } from '../utils/plural';

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const fmtSize = (chars: number) => (chars < 1024 ? `${chars} Б` : `${Math.round(chars / 1024)} КБ`);

/** «12 тренировок, 340 подходов, 3 шаблона, 5 замеров» */
function describe(c: BackupCounts): string {
  const parts = [
    `${c.sessions} ${plural(c.sessions, ['тренировка', 'тренировки', 'тренировок'])}`,
    `${c.sets} ${plural(c.sets, ['подход', 'подхода', 'подходов'])}`,
    `${c.templates} ${plural(c.templates, ['шаблон', 'шаблона', 'шаблонов'])}`,
    `${c.measurements} ${plural(c.measurements, ['замер', 'замера', 'замеров'])}`,
  ];
  if (c.customExercises) parts.push(`${c.customExercises} ${plural(c.customExercises, ['своё упражнение', 'своих упражнения', 'своих упражнений'])}`);
  return parts.join(', ');
}

/** Экран «Данные»: что хранится, копия в облаке Telegram и в файле. */
export function DataScreen() {
  // Пересчитывается автоматически при любом изменении данных (например, после восстановления)
  const counts = useLiveQuery(() => currentCounts(), []);
  const mode = cloudMode();
  const [meta, setMeta] = useState<CloudMeta | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [restoreSheet, setRestoreSheet] = useState<{ backup: BackupFile; source: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'unavailable') return setMeta(null);
    cloudInfo()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [mode]);

  const run = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      haptic.warning();
      await alertDialog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // ----- Облако -----
  const cloudSave = () =>
    run('Сохраняю в облако…', async () => {
      const m = await saveToCloud();
      setMeta(m);
      haptic.success();
      setStatus(`Копия сохранена в облако Telegram (${fmtSize(m.size)}).`);
    });

  const cloudRestore = () =>
    run('Загружаю из облака…', async () => {
      const backup = await loadFromCloud();
      setRestoreSheet({ backup, source: `Копия из облака от ${fmtWhen(backup.exportedAt)}` });
    });

  // ----- Файл -----
  const fileSave = () =>
    run('Готовлю файл…', async () => {
      const text = JSON.stringify(await buildBackup());
      const res = await saveFile(backupFileName(), text);
      if (res === 'cancelled') return;
      haptic.success();
      setStatus(res === 'shared' ? 'Файл копии передан.' : `Файл ${backupFileName()} скачан.`);
    });

  const copyAsText = () =>
    run('Копирую…', async () => {
      const ok = await copyText(JSON.stringify(await buildBackup()));
      if (!ok) throw new Error('Не удалось скопировать: устройство не дало доступ к буферу обмена.');
      haptic.success();
      setStatus('Копия скопирована как текст. Вставьте её в «Избранное» Telegram или в заметки.');
    });

  const onFilePicked = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    run('Читаю файл…', async () => {
      const parsed = parseBackup(await readFile(file));
      if (!parsed.ok) throw new Error(parsed.error);
      setRestoreSheet({ backup: parsed.backup, source: `Файл «${file.name}»` });
    });
  };

  // ----- Восстановление -----
  const restore = async (backup: BackupFile, mode: 'merge' | 'replace') => {
    if (
      mode === 'replace' &&
      !(await confirmDialog('Все текущие данные на этом устройстве будут заменены данными из копии.', {
        ok: 'Заменить всё',
        danger: true,
      }))
    ) {
      return;
    }
    await run('Восстанавливаю…', async () => {
      await restoreBackup(backup, mode);
      haptic.success();
      setStatus(mode === 'replace' ? 'Данные заменены данными из копии.' : 'Данные из копии добавлены.');
    });
  };

  let sheet: { title: string; actions: SheetAction[] } | null = null;
  if (restoreSheet) {
    const { backup, source } = restoreSheet;
    sheet = {
      title: `${source}: ${describe(countsOf(backup.data))}`,
      actions: [
        { label: 'Добавить к текущим данным', onClick: () => restore(backup, 'merge') },
        { label: 'Заменить все данные', danger: true, onClick: () => restore(backup, 'replace') },
      ],
    };
  }

  return (
    <div className="screen">
      <ScreenHeader title="Данные" />

      <p className="hint data-intro">
        Всё хранится в памяти этого устройства. Делайте копию, чтобы не потерять историю при смене телефона.
      </p>

      {counts && (
        <dl className="card ledger">
          <div className="ledger-row">
            <dt>Тренировок</dt>
            <dd>{counts.sessions}</dd>
          </div>
          <div className="ledger-row">
            <dt>Выполненных подходов</dt>
            <dd>{counts.sets}</dd>
          </div>
          <div className="ledger-row">
            <dt>Шаблонов</dt>
            <dd>{counts.templates}</dd>
          </div>
          <div className="ledger-row">
            <dt>Замеров</dt>
            <dd>{counts.measurements}</dd>
          </div>
          <div className="ledger-row">
            <dt>Своих упражнений</dt>
            <dd>{counts.customExercises}</dd>
          </div>
        </dl>
      )}

      <section className="data-section">
        <h2 className="group-title">Облако Telegram</h2>
        {mode === 'unavailable' ? (
          <p className="hint">
            Копия в облаке доступна, когда дневник открыт внутри Telegram. Здесь можно сохранить копию в файл.
          </p>
        ) : (
          <>
            <p className="data-status-line">
              {meta === undefined
                ? 'Проверяю облако…'
                : meta
                  ? `Последняя копия: ${fmtWhen(meta.savedAt)}, ${fmtSize(meta.size)}`
                  : 'Копий в облаке пока нет'}
            </p>
            <p className="hint">
              {mode === 'dev'
                ? 'Режим отладки в браузере: «облако» имитируется в памяти этого браузера.'
                : 'Копия сохраняется автоматически после каждой тренировки и хранится в вашем аккаунте Telegram — её можно восстановить на другом телефоне.'}
            </p>
            <div className="data-actions">
              <button className="btn btn-primary btn-block btn-lg" onClick={cloudSave} disabled={!!busy}>
                Сохранить в облако сейчас
              </button>
              <button className="btn btn-secondary btn-block" onClick={cloudRestore} disabled={!!busy || !meta}>
                Восстановить из облака
              </button>
            </div>
          </>
        )}
      </section>

      <section className="data-section">
        <h2 className="group-title">Файл копии</h2>
        <p className="hint">Все данные одним файлом. Удобно хранить в «Избранном» Telegram или на диске.</p>
        <div className="data-actions">
          <button className="btn btn-secondary btn-block" onClick={fileSave} disabled={!!busy}>
            Скачать файл копии
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => fileInput.current?.click()} disabled={!!busy}>
            Восстановить из файла
          </button>
          <button className="btn btn-ghost btn-block" onClick={copyAsText} disabled={!!busy}>
            Скопировать копию как текст
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFilePicked(e.target.files?.[0])}
        />
      </section>

      <p className="data-status" role="status" aria-live="polite">
        {busy ?? status ?? ''}
      </p>

      {sheet && <ActionSheet key={sheet.title} {...sheet} onClose={() => setRestoreSheet(null)} />}
    </div>
  );
}
