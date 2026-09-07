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
})
