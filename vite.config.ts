// Настройки сборки. Фронтенд лежит в web/, общие файлы — в shared/.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// SINGLE_FILE=1 — собрать прототип в один HTML-файл (demo/arena-demo.html)
const singleFile = process.env.SINGLE_FILE === '1'

export default defineConfig({
  root: 'web',
  // Относительные пути к файлам: страница работает и на github.io/arena/, и как локальный файл
  base: './',
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  build: {
    outDir: singleFile ? '../demo' : '../dist',
    emptyOutDir: true,
  },
  server: {
    // Страницы всегда на 5173. Если порт занят — Vite скажет об этом, а не уйдёт молча на другой порт
    port: 5173,
    strictPort: true,
    // В разработке страницы отдаёт Vite, а запросы к /api уходят на сервер Node (порт из .env, по умолчанию 3000)
    proxy: { '/api': { target: `http://localhost:${process.env.PORT ?? 3000}`, changeOrigin: false } },
  },
})
