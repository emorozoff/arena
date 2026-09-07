// Единственное место, где меняются деньги. Одна транзакция SQLite на одно действие зрителя.
// Клиент присылает целевую сумму «поставить вложение равным S» (решение D2), а не дельту.
import { ApiError } from '@shared/types'
import { db, log, now } from '../db'
import { getShow, guestAllocated } from './state'

interface Row {
  is_open: number
  name: string
}

export const setAllocation = db.transaction((guestId: string, projectId: string, amount: number) => {
  if (!getShow().voting_open) throw new ApiError('voting_closed')
  const project = db.prepare('SELECT is_open, name FROM projects WHERE id = ?').get(projectId) as Row | undefined
  if (!project || project.is_open !== 1) throw new ApiError('project_closed')
  if (!Number.isInteger(amount) || amount < 0) throw new ApiError('negative')

  const budget = (db.prepare('SELECT budget FROM guests WHERE id = ?').get(guestId) as { budget: number }).budget
  const current = (db.prepare('SELECT amount FROM allocations WHERE guest_id = ? AND project_id = ?').get(guestId, projectId) as { amount: number } | undefined)?.amount ?? 0
  const others = guestAllocated(guestId) - current
  if (others + amount > budget) throw new ApiError('over_budget')

  if (amount === 0) {
    db.prepare('DELETE FROM allocations WHERE guest_id = ? AND project_id = ?').run(guestId, projectId)
  } else {
    db.prepare(
      `INSERT INTO allocations (guest_id, project_id, amount, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (guest_id, project_id) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
    ).run(guestId, projectId, amount, now())
  }
  log('allocate', project.name, guestId, projectId, amount)
})

// Вернуть деньги всем, кто вложился в проект (проект убран ведущим или удалён)
export function removeAllocationsFor(projectId: string): { investors: number; amount: number } {
  const row = db.prepare('SELECT COUNT(*) AS investors, COALESCE(SUM(amount), 0) AS amount FROM allocations WHERE project_id = ?').get(projectId) as { investors: number; amount: number }
  db.prepare('DELETE FROM allocations WHERE project_id = ?').run(projectId)
  return row
}
