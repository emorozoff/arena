// Единственное место, где страницы получают «сервер».
// VITE_API=http — настоящий сервер (этап 2). Всё остальное — игрушечный сервер прототипа.
import type { Api } from './api.types'
import { mockApi } from './api.mock'

const mode = import.meta.env.VITE_API ?? 'mock'

export const IS_DEMO = mode !== 'http'

// На этапе 2 здесь появится: mode === 'http' ? httpApi : mockApi
export const api: Api = mockApi
