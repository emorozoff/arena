// Кто пришёл: зритель (токен устройства) или ведущий (сессия по паролю).
import { timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { ApiError } from '@shared/types'
import { db, now, uid } from './db'
import { env } from './env'

const GUEST_COOKIE = 'guest_token'
const ADMIN_COOKIE = 'admin_session'
const GUEST_COOKIE_DAYS = 30
const ADMIN_COOKIE_HOURS = 24

export interface GuestRow {
  id: string
  token: string
  ticket_number: string
  budget: number
  created_at: string
  last_seen_at: string | null
}

// Запрос пришёл по https? Смотрим на заголовок прокси (Caddy) или на сам адрес
export function isHttps(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-proto')
  if (forwarded) return forwarded.split(',')[0].trim() === 'https'
  return new URL(c.req.url).protocol === 'https:'
}

// Адрес, на который ведёт QR: настройка PUBLIC_URL или адрес текущего запроса
export function publicOrigin(c: Context): string {
  if (env.publicUrl) return env.publicUrl
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost'
  return `${isHttps(c) ? 'https' : 'http'}://${host}`
}

// --- Зритель ---

// Токен берём из заголовка (его шлёт страница из localStorage) или из cookie
export function guestToken(c: Context): string | null {
  return c.req.header('x-guest-token') || getCookie(c, GUEST_COOKIE) || null
}

export function setGuestCookie(c: Context, token: string) {
  setCookie(c, GUEST_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
    maxAge: GUEST_COOKIE_DAYS * 24 * 60 * 60,
  })
}

export function requireGuest(c: Context): GuestRow {
  const token = guestToken(c)
  const guest = token ? (db.prepare('SELECT * FROM guests WHERE token = ?').get(token) as GuestRow | undefined) : undefined
  if (!guest) throw new ApiError('not_joined')
  return guest
}

// --- Ведущий ---

function passwordMatches(candidate: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(env.adminPassword)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isAdmin(c: Context): boolean {
  const id = getCookie(c, ADMIN_COOKIE)
  if (!id) return false
  return !!db.prepare('SELECT 1 FROM admin_sessions WHERE id = ?').get(id)
}

export function requireAdmin(c: Context) {
  if (!isAdmin(c)) throw new ApiError('unauthorized')
}

export function adminLogin(c: Context, password: string): boolean {
  if (!passwordMatches(password)) return false
  const id = uid()
  db.prepare('INSERT INTO admin_sessions (id, created_at) VALUES (?, ?)').run(id, now())
  setCookie(c, ADMIN_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
    maxAge: ADMIN_COOKIE_HOURS * 60 * 60,
  })
  return true
}

export function adminLogout(c: Context) {
  const id = getCookie(c, ADMIN_COOKIE)
  if (id) db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(id)
  deleteCookie(c, ADMIN_COOKIE, { path: '/' })
}
