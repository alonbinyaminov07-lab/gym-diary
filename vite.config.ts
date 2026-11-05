import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, чтобы сайт работал и на GitHub Pages
// (где адрес вида username.github.io/repo/), и на Vercel.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  // Время сборки — показывается внизу «Настроек», чтобы видеть, что телефон загрузил свежую версию
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
