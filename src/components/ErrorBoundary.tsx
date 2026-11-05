import { Component, type ReactNode } from 'react';

/** Экран на случай, когда хранилище устройства недоступно (приватный режим, нет места). */
export function StorageError({ message }: { message: string }) {
  return (
    <div className="crash">
      <h1 className="screen-title">Нет доступа к хранилищу</h1>
      <p className="hint">
        Дневнику нужно место в памяти устройства, чтобы сохранять тренировки. Возможно, браузер открыт в
        приватном режиме или память переполнена. Откройте приложение в обычном режиме или освободите место.
      </p>
      <button className="btn btn-primary btn-block btn-lg" onClick={() => window.location.reload()}>
        Попробовать снова
      </button>
      <p className="crash-detail">{message}</p>
    </div>
  );
}

/**
 * Если что-то сломалось при отрисовке, вместо пустого экрана показываем понятное сообщение
 * с кнопкой перезапуска. Данные при этом не трогаем — они остаются в памяти устройства.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Ошибка интерфейса:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h1 className="screen-title">Что-то пошло не так</h1>
        <p className="hint">
          Экран не удалось показать. Ваши тренировки сохранены на устройстве — перезапуск их не удалит.
        </p>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => window.location.reload()}>
          Перезапустить приложение
        </button>
        <p className="crash-detail">{this.state.error.message}</p>
      </div>
    );
  }
}
