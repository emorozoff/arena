// Разработка одной командой: сервер Node (с перезапуском при изменениях) + фронтенд Vite.
// Страницы: http://localhost:5173, запросы /api Vite сам передаёт серверу на порт 3000.
import { spawn } from 'node:child_process'

const processes = [
  spawn('npx', ['tsx', 'watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite', '--host'], { stdio: 'inherit' }),
]

function stopAll() {
  for (const p of processes) p.kill('SIGINT')
  process.exit(0)
}

process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
for (const p of processes) p.on('exit', (code) => code && stopAll())
