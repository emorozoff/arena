// Запуск сервера: API, реалтайм-сигналы и раздача собранного фронтенда. Один процесс, одна база.
import os from 'node:os'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { ApiError, type ApiErrorCode } from '@shared/types'
import { isAdmin } from './auth'
import { dbFile } from './db'
import { env } from './env'
import { addClient, clientCount } from './events'
import { adminRoutes } from './routes/admin'
import { guestRoutes } from './routes/guest'
import { screenRoutes } from './routes/screen'

const app = new Hono()

// Ошибки наружу — только кодом, без подробностей и стектрейсов
const statusByCode: Partial<Record<ApiErrorCode, number>> = { unauthorized: 401, not_joined: 401, not_found: 404, taken: 409, unknown: 500 }
app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.code }, (statusByCode[err.code] ?? 400) as 400)
  console.error(new Date().toISOString(), 'Ошибка сервера:', err)
  return c.json({ error: 'unknown' }, 500)
})

app.get('/api/health', (c) => c.json({ ok: true, clients: clientCount() }))

// Реалтайм: одно соединение на страницу. Ведущий и экран получают ещё и сигналы о деньгах.
app.get('/api/events', (c) =>
  streamSSE(c, async (stream) => {
    let open = true
    const remove = addClient(isAdmin(c), (event, data) => {
      if (open) void stream.writeSSE({ event, data })
    })
    stream.onAbort(() => {
      open = false
      remove()
    })
    while (open) await stream.sleep(60_000)
  }),
)

app.route('/api', guestRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/screen', screenRoutes)
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

// Красивые адреса для QR и для людей → страницы приложения
for (const page of ['join', 'app', 'screen', 'admin']) {
  app.get(`/${page}`, (c) => c.redirect(`/#/${page}`))
}

// Кэш браузера: саму страницу (index.html) не кэшировать — после обновления сервера старая страница
// ссылалась бы на удалённые файлы и показывала белый экран. Файлы в assets/ имеют уникальные имена,
// их можно кэшировать надолго.
app.use('/*', async (c, next) => {
  await next()
  if (c.req.path.startsWith('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  else if (!c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-cache')
})

// Собранный фронтенд из dist/
app.use('/*', serveStatic({ root: env.webDir }))
app.get('/*', serveStatic({ root: env.webDir, path: 'index.html' }))

function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) if (item.family === 'IPv4' && !item.internal) out.push(item.address)
  }
  return out
}

const server = serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, () => {
  console.log(`Арена Единорогов: сервер запущен, база ${dbFile}`)
  console.log(`  На этом компьютере:   http://localhost:${env.port}`)
  for (const ip of lanAddresses()) console.log(`  Для телефонов в Wi-Fi: http://${ip}:${env.port}`)
  if (env.publicUrl) console.log(`  Публичный адрес:       ${env.publicUrl}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${env.port} уже занят другой программой. Укажите другой порт в .env, например PORT=3100, и запустите снова.`)
  } else {
    console.error('Не удалось запустить сервер:', err.message)
  }
  process.exit(1)
})
