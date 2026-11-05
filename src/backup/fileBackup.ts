// Сохранение копии в файл и чтение копии из файла.

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Отдать файл пользователю. На телефоне — системное меню «Поделиться» (можно сразу отправить
 * в «Избранное» Telegram или сохранить в «Файлы»), на компьютере — обычное скачивание.
 */
export async function saveFile(name: string, text: string): Promise<SaveResult> {
  const file = new File([text], name, { type: 'application/json' });
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // «Поделиться» недоступно — пробуем обычное скачивание
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Скопировать текст в буфер обмена (запасной путь, если файлы на устройстве недоступны). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Прочитать выбранный пользователем файл как текст. */
export function readFile(file: File): Promise<string> {
  return file.text();
}
