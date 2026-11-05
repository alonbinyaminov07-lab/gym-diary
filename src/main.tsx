import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, StorageError } from './components/ErrorBoundary';
import { db } from './db/db';
import { initTelegram } from './telegram/telegram';
import { initTheme } from './telegram/theme';
// Шрифты вшиты в приложение — работают без интернета
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import './styles.css';

initTelegram();
initTheme();

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Если хранилище устройства недоступно — вместо пустых экранов объясняем, в чём дело
db.open().catch((e: unknown) => {
  root.render(<StorageError message={e instanceof Error ? e.message : String(e)} />);
});
