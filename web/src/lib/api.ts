// Единственное место, где страницы получают «сервер».
// VITE_API=mock — игрушечный сервер внутри браузера (прототип для заказчика, D16).
// Иначе — настоящий сервер Node + SQLite (api.http.ts).
import type { Api } from './api.types'
import { httpApi } from './api.http'
import { mockApi } from './api.mock'

export const IS_DEMO = import.meta.env.VITE_API === 'mock'

export const api: Api = IS_DEMO ? mockApi : httpApi
