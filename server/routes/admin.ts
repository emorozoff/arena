// Пульт ведущего. Все маршруты, кроме входа, требуют сессию ведущего.
import { Hono } from 'hono'
import { config } from '@shared/config'
import { formatMoney } from '@shared/format'
import { ApiError, type ResetScope, type ShowState } from '@shared/types'
import { adminLogin, adminLogout, isAdmin, requireAdmin } from '../auth'
import { db, log, now, uid } from '../db'
import { emitShow, emitTotals } from '../events'
import { removeAllocationsFor } from '../logic/allocate'
import { getShow, listProjects, overview, updateShow } from '../logic/state'
import { generateTickets, importTickets, listTickets, releaseTicket } from '../logic/tickets'
import { readJson } from './helpers'

export const adminRoutes = new Hono()

adminRoutes.post('/login', async (c) => {
  const body = await readJson<{ password?: unknown }>(c)
  if (!adminLogin(c, String(body.password ?? ''))) throw new ApiError('unauthorized')
  return c.json({ ok: true })
})

adminRoutes.get('/session', (c) => c.json({ logged_in: isAdmin(c) }))

adminRoutes.post('/logout', (c) => {
  adminLogout(c)
  return c.json({ ok: true })
})

// Всё ниже — только для ведущего
adminRoutes.use('/*', async (c, next) => {
  if (c.req.path.endsWith('/login') || c.req.path.endsWith('/session') || c.req.path.endsWith('/logout')) return next()
  requireAdmin(c)
  await next()
})

adminRoutes.get('/overview', (c) => c.json(overview()))

adminRoutes.post('/show', async (c) => {
  const patch = await readJson<Partial<ShowState>>(c)
  updateShow(patch)
  emitShow()
  return c.json(overview())
})

// --- Проекты ---

function renumberProjects() {
  const rows = db.prepare('SELECT id FROM projects ORDER BY position, created_at').all() as { id: string }[]
  const update = db.prepare('UPDATE projects SET position = ? WHERE id = ?')
  rows.forEach((row, i) => update.run(i + 1, row.id))
}

adminRoutes.post('/projects', async (c) => {
  const body = await readJson<{ name?: unknown; speaker?: unknown }>(c)
  const name = String(body.name ?? '').trim()
  if (!name) throw new ApiError('bad_format')
  const position = ((db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM projects').get() as { p: number }).p ?? 0) + 1
  db.prepare('INSERT INTO projects (id, name, speaker, position, is_open, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(uid(), name, String(body.speaker ?? '').trim(), position, now())
  log('project_add', name)
  emitShow()
  return c.json(overview())
})

adminRoutes.put('/projects/:id', async (c) => {
  const body = await readJson<{ name?: unknown; speaker?: unknown }>(c)
  const name = String(body.name ?? '').trim()
  if (!name) throw new ApiError('bad_format')
  db.prepare('UPDATE projects SET name = ?, speaker = ? WHERE id = ?').run(name, String(body.speaker ?? '').trim(), c.req.param('id'))
  log('project_edit', name)
  emitShow()
  return c.json(overview())
})

adminRoutes.delete('/projects/:id', (c) => {
  const id = c.req.param('id')
  const project = listProjects().find((p) => p.id === id)
  if (project) {
    const returned = removeAllocationsFor(id)
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    renumberProjects()
    updateShow({}) // подрежет revealed_count, если проектов стало меньше
    log('project_delete', `${project.name}: возвращено ${formatMoney(returned.amount)} ${returned.investors} зрителям`, null, id)
    emitShow()
    emitTotals()
  }
  return c.json(overview())
})

adminRoutes.post('/projects/:id/move', async (c) => {
  const body = await readJson<{ direction?: unknown }>(c)
  const list = listProjects()
  const index = list.findIndex((p) => p.id === c.req.param('id'))
  const swapWith = body.direction === 'up' ? index - 1 : index + 1
  if (index >= 0 && swapWith >= 0 && swapWith < list.length) {
    const a = list[index]
    const b = list[swapWith]
    const update = db.prepare('UPDATE projects SET position = ? WHERE id = ?')
    update.run(b.position, a.id)
    update.run(a.position, b.id)
    emitShow()
  }
  return c.json(overview())
})

adminRoutes.post('/projects/:id/open', (c) => {
  const id = c.req.param('id')
  const project = listProjects().find((p) => p.id === id)
  if (project && !project.is_open) {
    db.prepare('UPDATE projects SET is_open = 1 WHERE id = ?').run(id)
    log('project_open', project.name, null, id)
    emitShow()
  }
  return c.json(overview())
})

adminRoutes.post('/projects/:id/close', (c) => {
  const id = c.req.param('id')
  const project = listProjects().find((p) => p.id === id)
  if (project && project.is_open) {
    const returned = removeAllocationsFor(id)
    db.prepare('UPDATE projects SET is_open = 0 WHERE id = ?').run(id)
    updateShow({})
    log('project_close', `${project.name}: возвращено ${formatMoney(returned.amount)} ${returned.investors} зрителям`, null, id)
    emitShow()
    emitTotals()
  }
  return c.json(overview())
})

// --- Билеты ---

adminRoutes.get('/tickets', (c) => c.json(listTickets()))

adminRoutes.post('/tickets/import', async (c) => {
  const body = await readJson<{ text?: unknown }>(c)
  const added = importTickets(String(body.text ?? ''))
  emitShow()
  return c.json({ added })
})

adminRoutes.post('/tickets/generate', async (c) => {
  const body = await readJson<{ count?: unknown }>(c)
  const count = Math.max(0, Math.min(5000, Math.floor(Number(body.count) || 0)))
  const codes = generateTickets(count)
  emitShow()
  return c.json({ codes })
})

adminRoutes.post('/tickets/:number/release', (c) => {
  releaseTicket(c.req.param('number'))
  emitShow()
  return c.json({ ok: true })
})

// --- Опасная зона ---

const resetAllocations = db.transaction(() => {
  db.prepare('DELETE FROM allocations').run()
  log('reset_allocations', 'Все вложения сброшены')
})

const resetAll = db.transaction(() => {
  db.prepare('DELETE FROM allocations').run()
  db.prepare('DELETE FROM guests').run()
  if (getShow().ticket_mode === 'whitelist') {
    db.prepare('UPDATE tickets SET guest_id = NULL, claimed_at = NULL, released = 0').run()
  } else {
    db.prepare('DELETE FROM tickets').run()
  }
  db.prepare('UPDATE projects SET is_open = 0').run()
  db.prepare("UPDATE show_state SET registration_open = 1, voting_open = 1, screen_mode = 'qr', revealed_count = 0, updated_at = ? WHERE id = 1").run(now())
  log('reset_all', 'Полный сброс')
})

adminRoutes.post('/reset', async (c) => {
  const body = await readJson<{ scope?: unknown }>(c)
  const scope = body.scope as ResetScope
  if (scope === 'allocations') resetAllocations()
  else if (scope === 'all') resetAll()
  else throw new ApiError('bad_format')
  emitShow()
  emitTotals()
  return c.json(overview())
})

const seedDemo = db.transaction(() => {
  db.prepare('DELETE FROM allocations').run()
  db.prepare('DELETE FROM projects').run()
  const insert = db.prepare('INSERT INTO projects (id, name, speaker, position, is_open, created_at) VALUES (?, ?, ?, ?, 0, ?)')
  config.demo.projects.forEach((p, i) => insert.run(uid(), p.name, p.speaker, i + 1, now()))
  db.prepare('UPDATE show_state SET revealed_count = 0 WHERE id = 1').run()
  log('seed_demo', 'Тестовые проекты')
})

adminRoutes.post('/seed-demo', (c) => {
  seedDemo()
  emitShow()
  emitTotals()
  return c.json(overview())
})
