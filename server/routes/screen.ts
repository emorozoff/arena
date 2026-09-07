// Экран на сцену. Закрыт сессией ведущего (решение D3): на нём общие суммы.
import { Hono } from 'hono'
import { publicOrigin, requireAdmin } from '../auth'
import { screenState } from '../logic/state'

export const screenRoutes = new Hono()

screenRoutes.get('/state', (c) => {
  requireAdmin(c)
  return c.json(screenState(`${publicOrigin(c)}/join`))
})
