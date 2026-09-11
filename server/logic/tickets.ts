// Билеты: проверка формата, вход зрителя, передача билета новому устройству (D4), генерация и импорт кодов (D13).
import { config } from '@shared/config'
import { ApiError, type AdminTicket } from '@shared/types'
import type { GuestRow } from '../auth'
import { db, log, now, uid } from '../db'
import { getShow } from './state'

const DIGITS = '0123456789'
const LETTERS_DIGITS = 'ABCEHKMPTX23456789' // без похожих знаков: 0/O, 1/I/L

interface TicketRow {
  number: string
  guest_id: string | null
  claimed_at: string | null
  released: number
}

export function normalizeTicket(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function ticketMatchesFormat(ticket: string): boolean {
  if (ticket.length !== config.ticketLength) return false
  const alphabet = config.ticketChars === 'digits' ? DIGITS : LETTERS_DIGITS + 'OIL01'
  return [...ticket].every((ch) => alphabet.includes(ch))
}

function randomTicket(): string {
  const alphabet = config.ticketChars === 'digits' ? DIGITS : LETTERS_DIGITS
  let out = ''
  for (let i = 0; i < config.ticketLength; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// Вход зрителя. Возвращает гостя и его токен (новый или переданный).
export const joinWithTicket = db.transaction((raw: string): GuestRow => {
  const show = getShow()
  const number = normalizeTicket(raw)
  if (!ticketMatchesFormat(number)) throw new ApiError('bad_format')
  if (!show.registration_open) throw new ApiError('registration_closed')

  const ticket = db.prepare('SELECT * FROM tickets WHERE number = ?').get(number) as TicketRow | undefined
  if (show.ticket_mode === 'whitelist' && !ticket) throw new ApiError('not_found')

  if (ticket?.guest_id) {
    const owner = db.prepare('SELECT * FROM guests WHERE id = ?').get(ticket.guest_id) as GuestRow | undefined
    if (owner && ticket.released !== 1) throw new ApiError('taken')
    if (owner) {
      // Билет отвязан ведущим: гость переходит новому устройству вместе с деньгами (D4)
      const token = uid()
      db.prepare('UPDATE guests SET token = ?, last_seen_at = ? WHERE id = ?').run(token, now(), owner.id)
      db.prepare('UPDATE tickets SET released = 0, claimed_at = ? WHERE number = ?').run(now(), number)
      log('transfer', `Билет ${number} передан новому устройству`, owner.id)
      return { ...owner, token }
    }
  }

  const guest: GuestRow = { id: uid(), token: uid(), ticket_number: number, budget: show.default_budget, created_at: now(), last_seen_at: now() }
  db.prepare('INSERT INTO guests (id, token, ticket_number, budget, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    guest.id,
    guest.token,
    guest.ticket_number,
    guest.budget,
    guest.created_at,
    guest.last_seen_at,
  )
  if (ticket) {
    db.prepare('UPDATE tickets SET guest_id = ?, claimed_at = ?, released = 0 WHERE number = ?').run(guest.id, now(), number)
  } else {
    db.prepare('INSERT INTO tickets (number, guest_id, claimed_at, released) VALUES (?, ?, ?, 0)').run(number, guest.id, now())
  }
  log('join', `Билет ${number}`, guest.id)
  return guest
})

export function listTickets(): AdminTicket[] {
  const rows = db
    .prepare(
      `SELECT t.number, t.sector, t.guest_id, t.claimed_at, t.released, g.budget,
              (SELECT COALESCE(SUM(a.amount), 0) FROM allocations a WHERE a.guest_id = t.guest_id) AS allocated
       FROM tickets t LEFT JOIN guests g ON g.id = t.guest_id`,
    )
    .all() as (TicketRow & { sector: string | null; budget: number | null; allocated: number })[]
  const order: Record<AdminTicket['status'], number> = { claimed: 0, released: 1, free: 2 }
  return rows
    .map((t) => {
      const status: AdminTicket['status'] = !t.guest_id ? 'free' : t.released === 1 ? 'released' : 'claimed'
      return { number: t.number, sector: t.sector, status, claimed_at: t.claimed_at, allocated: t.allocated, budget: t.budget ?? config.defaultBudget, is_bot: false }
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.number.localeCompare(b.number))
}

// Одна строка выгрузки площадки: «Id билета  Сектор  Штрихкод» (через табуляцию, ; или запятую) — или просто номер.
// Номер — первое поле нужной длины; сектор — первое поле с буквами.
export function parseTicketLine(line: string): { number: string; sector: string | null } | null {
  const fields = line.split(/[\t;,]+/).map((f) => f.trim().toUpperCase().replace(/\s+/g, ' ')).filter(Boolean)
  const number = fields.map((f) => f.replace(/\s+/g, '')).find((f) => ticketMatchesFormat(f)) ?? (fields.length === 1 ? normalizeTicket(fields[0]) : undefined)
  if (!number) return null
  const sector = fields.find((f) => f.replace(/\s+/g, '') !== number && /[A-ZА-ЯЁ]/.test(f)) ?? null
  return { number, sector }
}

export const importTickets = db.transaction((text: string): number => {
  const insert = db.prepare('INSERT OR IGNORE INTO tickets (number, sector, guest_id, claimed_at, released) VALUES (?, ?, NULL, NULL, 0)')
  const updateSector = db.prepare('UPDATE tickets SET sector = ? WHERE number = ? AND sector IS NULL')
  let added = 0
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseTicketLine(line)
    if (!parsed) continue
    const changes = insert.run(parsed.number, parsed.sector).changes
    added += changes
    if (!changes && parsed.sector) updateSector.run(parsed.sector, parsed.number)
  }
  log('tickets_import', `Добавлено ${added}`)
  return added
})

export const generateTickets = db.transaction((count: number): string[] => {
  const insert = db.prepare('INSERT OR IGNORE INTO tickets (number, sector, guest_id, claimed_at, released) VALUES (?, NULL, NULL, NULL, 0)')
  const created: string[] = []
  let guard = 0
  while (created.length < count && guard++ < count * 50) {
    const number = randomTicket()
    if (insert.run(number).changes === 1) created.push(number)
  }
  log('tickets_generate', `Создано ${created.length}`)
  return created
})

export function releaseTicket(number: string) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE number = ?').get(number) as TicketRow | undefined
  if (!ticket || !ticket.guest_id) throw new ApiError('not_found')
  db.prepare('UPDATE tickets SET released = 1 WHERE number = ?').run(number)
  log('ticket_release', `Билет ${number} отвязан`, ticket.guest_id)
}
