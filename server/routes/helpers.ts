// Мелкие помощники для маршрутов.
import type { Context } from 'hono'
import { ApiError } from '@shared/types'

// Тело запроса как JSON. Кривой JSON — это ошибка формата, а не падение сервера.
export async function readJson<T extends object>(c: Context): Promise<T> {
  try {
    const body = (await c.req.json()) as unknown
    return (body && typeof body === 'object' ? body : {}) as T
  } catch {
    throw new ApiError('bad_format')
  }
}
