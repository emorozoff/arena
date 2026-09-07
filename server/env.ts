// Настройки запуска: из переменных окружения и файла .env в корне проекта (без библиотек).
import fs from 'node:fs'
import path from 'node:path'

function loadDotEnv(file = '.env') {
  try {
    const text = fs.readFileSync(path.resolve(file), 'utf8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // файла .env нет — берём только переменные окружения
  }
}
loadDotEnv()

export const env = {
  port: Number(process.env.PORT ?? 3000),
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  dataDir: process.env.DATA_DIR ?? 'data',
  // Публичный адрес для QR, например https://unicorn-arena.emorozoff.ru. Пусто — берём из запроса.
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  // Папка с собранным фронтендом (результат `npm run build`)
  webDir: process.env.WEB_DIR ?? 'dist',
}

if (!env.adminPassword) {
  console.error('Не задан пароль пульта. Создайте файл .env со строкой ADMIN_PASSWORD=ваш-пароль (пример в .env.example).')
  process.exit(1)
}
