// Зритель: вход по билету, своё состояние, вложение.
import { Hono } from 'hono'
import { ApiError } from '@shared/types'
import { requireGuest, setGuestCookie } from '../auth'
import { db, now } from '../db'
import { emitShow, emitTotals } from '../events'
import { setAllocation } from '../logic/allocate'
import { guestState } from '../logic/state'
import { joinWithTicket } from '../logic/tickets'
import { readJson } from './helpers'

export const guestRoutes = new Hono()

guestRoutes.post('/join', async (c) => {
  const body = await readJson<{ ticket?: unknown }>(c)
  const guest = joinWithTicket(String(body.ticket ?? ''))
  setGuestCookie(c, guest.token)
  emitShow() // изменилось число зарегистрированных
  return c.json({ ...guestState(guest), token: guest.token })
})

guestRoutes.get('/me', (c) => {
  const guest = requireGuest(c)
  db.prepare('UPDATE guests SET last_seen_at = ? WHERE id = ?').run(now(), guest.id)
  return c.json(guestState(guest))
})

guestRoutes.post('/allocate', async (c) => {
  const guest = requireGuest(c)
  const body = await readJson<{ project_id?: unknown; amount?: unknown }>(c)
  const projectId = typeof body.project_id === 'string' ? body.project_id : ''
  const amount = typeof body.amount === 'number' ? body.amount : Number.NaN
  if (!projectId || !Number.isInteger(amount)) throw new ApiError('bad_format')
  setAllocation(guest.id, projectId, amount)
  emitTotals()
  return c.json(guestState(guest))
})
