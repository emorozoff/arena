// Открытие базы SQLite (один файл data/arena.db) и применение schema.sql.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '@shared/config'
import { env } from './env'

export const now = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()

fs.mkdirSync(env.dataDir, { recursive: true })
export const dbFile = path.join(env.dataDir, 'arena.db')
export const db = new Database(dbFile)

// WAL — запись не блокирует чтение; synchronous NORMAL — быстро и безопасно при обычных сбоях
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

// Ровно одна строка состояния шоу
db.prepare('INSERT OR IGNORE INTO show_state (id, default_budget, updated_at) VALUES (1, ?, ?)').run(config.defaultBudget, now())

// Запись в лог действий
export function log(kind: string, details: string, guestId: string | null = null, projectId: string | null = null, amount: number | null = null) {
  db.prepare('INSERT INTO action_log (at, kind, guest_id, project_id, amount, details) VALUES (?, ?, ?, ?, ?, ?)').run(now(), kind, guestId, projectId, amount, details)
  db.prepare('UPDATE show_state SET updated_at = ? WHERE id = 1').run(now())
}
