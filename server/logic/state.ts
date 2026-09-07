// Чтение состояния из базы и сборка ответов для страниц. Здесь только чтение и простые обновления.
// Деньги меняются только в allocate.ts, билеты — в tickets.ts.
import { config } from '@shared/config'
import type { AdminOverview, GuestState, Project, ProjectTotals, ScreenMode, ScreenState, ShowState, TicketMode } from '@shared/types'
import type { GuestRow } from '../auth'
import { db, log, now } from '../db'

interface ShowRow {
  registration_open: number
  voting_open: number
  ticket_mode: TicketMode
  screen_mode: ScreenMode
  revealed_count: number
  default_budget: number
  updated_at: string
}

interface ProjectRow {
  id: string
  name: string
  speaker: string
  position: number
  is_open: number
  created_at: string
}

interface TotalsRow extends ProjectRow {
  amount: number
  investors: number
}

export function getShow(): ShowState {
  const row = db.prepare('SELECT * FROM show_state WHERE id = 1').get() as ShowRow
  return {
    registration_open: row.registration_open === 1,
    voting_open: row.voting_open === 1,
    ticket_mode: row.ticket_mode,
    ticket_length: config.ticketLength,
    ticket_chars: config.ticketChars,
    screen_mode: row.screen_mode,
    revealed_count: row.revealed_count,
    default_budget: row.default_budget,
  }
}

const SCREEN_MODES: ScreenMode[] = ['qr', 'overview']
const TICKET_MODES: TicketMode[] = ['free', 'whitelist']

// Переключатели ведущего. Проверяем каждое поле: клиенту не верим.
export function updateShow(patch: Partial<ShowState>) {
  const before = getShow()
  const set: string[] = []
  const values: unknown[] = []
  if (typeof patch.registration_open === 'boolean') {
    set.push('registration_open = ?')
    values.push(patch.registration_open ? 1 : 0)
  }
  if (typeof patch.voting_open === 'boolean') {
    set.push('voting_open = ?')
    values.push(patch.voting_open ? 1 : 0)
  }
  if (patch.ticket_mode && TICKET_MODES.includes(patch.ticket_mode)) {
    set.push('ticket_mode = ?')
    values.push(patch.ticket_mode)
  }
  if (patch.screen_mode && SCREEN_MODES.includes(patch.screen_mode)) {
    set.push('screen_mode = ?')
    values.push(patch.screen_mode)
  }
  if (typeof patch.revealed_count === 'number' && Number.isFinite(patch.revealed_count)) {
    set.push('revealed_count = ?')
    values.push(Math.max(0, Math.floor(patch.revealed_count)))
  }
  if (set.length === 0) return
  set.push('updated_at = ?')
  values.push(now())
  db.prepare(`UPDATE show_state SET ${set.join(', ')} WHERE id = 1`).run(...values)

  const after = getShow()
  // Смена состояния голосования всегда начинает финал заново (D21)
  if (before.voting_open !== after.voting_open) {
    db.prepare('UPDATE show_state SET revealed_count = 0 WHERE id = 1').run()
    log('voting', after.voting_open ? 'Голосование открыто' : 'Голосование закрыто')
  }
  if (before.registration_open !== after.registration_open) {
    log('registration', after.registration_open ? 'Регистрация открыта' : 'Регистрация закрыта')
  }
  // Показанных мест не может быть больше, чем открытых проектов
  const openCount = (db.prepare('SELECT COUNT(*) AS n FROM projects WHERE is_open = 1').get() as { n: number }).n
  const revealed = Math.min(getShow().revealed_count, openCount)
  db.prepare('UPDATE show_state SET revealed_count = ? WHERE id = 1').run(revealed)
  if (before.revealed_count !== revealed) log('reveal', `Показано мест: ${revealed}`)
}

function toProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name, speaker: row.speaker, position: row.position, is_open: row.is_open === 1 }
}

export function listProjects(): Project[] {
  return (db.prepare('SELECT * FROM projects ORDER BY position').all() as ProjectRow[]).map(toProject)
}

// Проекты с общей суммой и числом инвесторов, по порядку показа
export function projectTotals(): ProjectTotals[] {
  const rows = db
    .prepare(
      `SELECT p.*, COALESCE(SUM(a.amount), 0) AS amount, COUNT(CASE WHEN a.amount > 0 THEN 1 END) AS investors
       FROM projects p LEFT JOIN allocations a ON a.project_id = p.id
       GROUP BY p.id ORDER BY p.position`,
    )
    .all() as TotalsRow[]
  return rows.map((row) => ({ ...toProject(row), amount: row.amount, investors: row.investors }))
}

export function guestAllocated(guestId: string): number {
  return (db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM allocations WHERE guest_id = ?').get(guestId) as { total: number }).total
}

export function guestState(guest: GuestRow): GuestState {
  const show = getShow()
  const mine = new Map<string, number>()
  for (const row of db.prepare('SELECT project_id, amount FROM allocations WHERE guest_id = ?').all(guest.id) as { project_id: string; amount: number }[]) {
    mine.set(row.project_id, row.amount)
  }
  const projects = listProjects().map((p) => ({
    id: p.id,
    position: p.position,
    is_open: p.is_open,
    name: p.is_open ? p.name : null,
    speaker: p.is_open ? p.speaker : null,
    my_amount: mine.get(p.id) ?? 0,
  }))
  const allocated = projects.reduce((acc, p) => acc + p.my_amount, 0)
  return {
    ticket_number: guest.ticket_number,
    budget: guest.budget,
    free: guest.budget - allocated,
    voting_open: show.voting_open,
    projects,
  }
}

export function overview(): AdminOverview {
  const show = getShow()
  const projects = projectTotals()
  const registered = (db.prepare('SELECT COUNT(*) AS n FROM guests').get() as { n: number }).n
  const ticketsInList = (db.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number }).n
  const moneyTotal = (db.prepare('SELECT COALESCE(SUM(budget), 0) AS total FROM guests').get() as { total: number }).total
  const moneyAllocated = projects.reduce((acc, p) => acc + p.amount, 0)
  const last = db.prepare('SELECT at FROM action_log ORDER BY id DESC LIMIT 1').get() as { at: string } | undefined
  return {
    show,
    projects,
    registered,
    tickets_in_list: ticketsInList,
    money_total: moneyTotal,
    money_allocated: moneyAllocated,
    money_free: moneyTotal - moneyAllocated,
    last_action_at: last?.at ?? null,
  }
}

// Экран: пока голосование открыто — все открытые проекты по сумме; после закрытия — только показанные места (D21)
export function screenState(joinUrl: string): ScreenState {
  const show = getShow()
  const ranked = projectTotals()
    .filter((p) => p.is_open)
    .sort((a, b) => b.amount - a.amount || a.position - b.position)
  const revealed = Math.min(show.revealed_count, ranked.length)
  // max_amount — сумма победителя: в финале полосы считаются от неё, а не от показанных строк
  const finale = show.voting_open ? null : { revealed, total: ranked.length, max_amount: ranked[0]?.amount ?? 0 }
  return {
    mode: show.screen_mode,
    voting_open: show.voting_open,
    registered: (db.prepare('SELECT COUNT(*) AS n FROM guests').get() as { n: number }).n,
    join_url: joinUrl,
    overview: finale ? ranked.slice(ranked.length - revealed) : ranked,
    finale,
  }
}
