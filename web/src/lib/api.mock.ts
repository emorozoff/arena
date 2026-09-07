// Игрушечный сервер для прототипа (решение D16). Живёт внутри браузера, в сеть не ходит.
// Хранит состояние шоу в памяти и в localStorage, изображает зал из ботов-зрителей.
// Правила денег здесь ровно те, что будут на настоящем сервере: см. setAllocation().
import { config } from '@shared/config'
import { formatMoney } from '@shared/format'
import {
  ApiError,
  type AdminOverview,
  type AdminTicket,
  type GuestState,
  type LiveChannel,
  type Project,
  type ProjectTotals,
  type ResetScope,
  type ScreenState,
  type ShowState,
} from '@shared/types'
import type { Api } from './api.types'
import { joinUrl } from './router'

const STORAGE_KEY = 'arena_demo_state_v2'
const TOKEN_KEY = 'arena_demo_token' // в бою — cookie устройства

// ---------- Данные, как в базе ----------

interface Guest {
  id: string
  token: string
  ticket_number: string
  budget: number
  allocations: Record<string, number> // project_id → сумма
  created_at: string
  is_bot: boolean
  pref: Record<string, number> // у ботов: насколько нравится каждый проект
  spend: number // у ботов: какую долю бюджета готов вложить
}

interface Ticket {
  number: string
  guest_id: string | null
  claimed_at: string | null
  released: boolean // ведущий отвязал: следующий вход по номеру забирает гостя (D4)
}

interface LogEntry {
  at: string
  kind: string
  guest_id: string | null
  project_id: string | null
  amount: number | null
  details: string
}

interface Store {
  show: ShowState
  projects: Project[]
  guests: Guest[]
  tickets: Ticket[]
  log: LogEntry[]
  last_action_at: string | null
}

// ---------- Мелкие помощники ----------

const now = () => new Date().toISOString()
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
// Небольшая задержка, как у настоящей сети, чтобы интерфейс вёл себя как в бою
const likeNetwork = () => delay(randomInt(60, 180))

const DIGITS = '0123456789'
const LETTERS_DIGITS = 'ABCEHKMPTX23456789' // без похожих знаков: 0/O, 1/I/L

function randomTicket(length: number, chars: 'digits' | 'letters_digits'): string {
  const alphabet = chars === 'digits' ? DIGITS : LETTERS_DIGITS
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(0, alphabet.length - 1)]
  return out
}

function ticketMatchesFormat(ticket: string, show: ShowState): boolean {
  if (ticket.length !== show.ticket_length) return false
  const alphabet = show.ticket_chars === 'digits' ? DIGITS : LETTERS_DIGITS + 'OIL01'
  return [...ticket].every((ch) => alphabet.includes(ch))
}

function normalizeTicket(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

// ---------- Начальное состояние ----------

function freshShow(): ShowState {
  return {
    registration_open: true,
    voting_open: true,
    ticket_mode: 'free',
    ticket_length: config.ticketLength,
    ticket_chars: config.ticketChars,
    screen_mode: 'qr',
    revealed_count: 0,
    default_budget: config.defaultBudget,
  }
}

function demoProjects(openCount: number): Project[] {
  return config.demo.projects.map((p, i) => ({
    id: uid(),
    name: p.name,
    speaker: p.speaker,
    position: i + 1,
    is_open: i < openCount,
  }))
}

function freshStore(): Store {
  return { show: freshShow(), projects: demoProjects(config.demo.openAtStart), guests: [], tickets: [], log: [], last_action_at: null }
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      if (parsed && parsed.show && Array.isArray(parsed.projects) && Array.isArray(parsed.guests)) {
        // Новые поля состояния получают значения по умолчанию, старое сохранение не ломается
        parsed.show = { ...freshShow(), ...parsed.show }
        return parsed
      }
    }
  } catch {
    // localStorage недоступен или испорчен — начинаем заново
  }
  return freshStore()
}

// Включён только в сборке прототипа (VITE_API=mock); иначе не трогает хранилище и не запускает ботов
const ENABLED = import.meta.env.VITE_API === 'mock'

let store: Store = ENABLED ? loadStore() : freshStore()
let dirty = false

function save() {
  if (!dirty) return
  dirty = false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // нет места или приватный режим — прототип продолжает работать в памяти
  }
}

function touch() {
  dirty = true
  store.last_action_at = now()
}

function log(kind: string, details: string, guest_id: string | null = null, project_id: string | null = null, amount: number | null = null) {
  store.log.push({ at: now(), kind, guest_id, project_id, amount, details })
  if (store.log.length > 500) store.log.splice(0, store.log.length - 500)
  touch()
}

// ---------- Реалтайм: сигналы «обновись» ----------

const listeners: Record<LiveChannel, Set<() => void>> = { show: new Set(), totals: new Set() }
let totalsDirty = false
let showPending = false

function emitShow() {
  if (showPending) return
  showPending = true
  setTimeout(() => {
    showPending = false
    listeners.show.forEach((cb) => cb())
  }, 50)
}

function markTotalsChanged() {
  totalsDirty = true
}

// Раз в секунду: боты двигаются, суммы рассылаются не чаще раза в секунду, состояние сохраняется
if (ENABLED) {
  setInterval(() => {
    tickBots()
    if (totalsDirty) {
      totalsDirty = false
      listeners.totals.forEach((cb) => cb())
    }
    save()
  }, config.screenRefreshMs)
}

// ---------- Правила денег: единственное место, где меняются вложения ----------

function allocatedTotal(g: Guest, except?: string): number {
  return sum(Object.entries(g.allocations).filter(([pid]) => pid !== except).map(([, amount]) => amount))
}

function setAllocation(g: Guest, projectId: string, amount: number) {
  if (!store.show.voting_open) throw new ApiError('voting_closed')
  const project = store.projects.find((p) => p.id === projectId)
  if (!project || !project.is_open) throw new ApiError('project_closed')
  if (!Number.isInteger(amount) || amount < 0) throw new ApiError('negative')
  if (allocatedTotal(g, projectId) + amount > g.budget) throw new ApiError('over_budget')
  if (amount === 0) delete g.allocations[projectId]
  else g.allocations[projectId] = amount
  log('allocate', `${g.ticket_number} → ${project.name}: ${formatMoney(amount)}`, g.id, projectId, amount)
  markTotalsChanged()
}

// ---------- Боты: зал, который живёт сам ----------

function botPreference(g: Guest, projectId: string): number {
  if (g.pref[projectId] === undefined) g.pref[projectId] = Math.random() ** 2 // у большинства слабые предпочтения, у некоторых сильные
  return g.pref[projectId]
}

function botJoin() {
  const show = store.show
  let ticketNumber: string | null = null
  if (show.ticket_mode === 'whitelist') {
    const free = store.tickets.find((t) => !t.guest_id)
    if (!free) return
    ticketNumber = free.number
  } else {
    for (let attempt = 0; attempt < 20 && !ticketNumber; attempt++) {
      const candidate = randomTicket(show.ticket_length, show.ticket_chars)
      if (!store.tickets.some((t) => t.number === candidate)) ticketNumber = candidate
    }
    if (!ticketNumber) return
  }
  const guest = createGuest(ticketNumber, true)
  guest.spend = 0.5 + Math.random() * 0.5
}

function botMove(g: Guest, open: Project[]) {
  const weights = open.map((p) => botPreference(g, p.id))
  const totalWeight = sum(weights) || 1
  const step = 50_000
  const targets = open.map((p, i) => ({
    id: p.id,
    target: Math.round(((g.budget * g.spend * weights[i]) / totalWeight) / step) * step,
  }))
  // Сначала забираем лишнее, потом докладываем: как человек, который перекладывает деньги
  const over = targets.find((t) => (g.allocations[t.id] ?? 0) > t.target)
  const under = targets.find((t) => (g.allocations[t.id] ?? 0) < t.target)
  const move = over ?? under
  if (!move) return
  const current = g.allocations[move.id] ?? 0
  const diff = Math.abs(move.target - current)
  const buttons = [...config.plusButtons].sort((a, b) => b - a)
  const stepSize = buttons.find((b) => b <= diff) ?? step
  const next = current + (move.target > current ? stepSize : -stepSize)
  try {
    setAllocation(g, move.id, Math.max(0, next))
  } catch {
    // не хватило денег — бот подождёт следующего хода
  }
}

function tickBots() {
  if (store.show.registration_open) {
    const bots = store.guests.filter((g) => g.is_bot).length
    const toJoin = Math.min(config.demo.botsJoinPerSecond, config.demo.bots - bots)
    for (let i = 0; i < toJoin; i++) botJoin()
    if (toJoin > 0) emitShow()
  }
  if (store.show.voting_open) {
    const open = store.projects.filter((p) => p.is_open)
    if (open.length === 0) return
    for (const g of store.guests) {
      if (g.is_bot && Math.random() < config.demo.botMoveChance) botMove(g, open)
    }
  }
}

// Когда открывается новый проект, боты «слышат питч» и часть из них хочет вложиться
function botsNoticeProject(projectId: string) {
  for (const g of store.guests) {
    if (!g.is_bot) continue
    g.pref[projectId] = Math.random() ** 2 * 1.1
  }
}

// ---------- Гости и билеты ----------

function createGuest(ticketNumber: string, isBot: boolean): Guest {
  const guest: Guest = {
    id: uid(),
    token: uid(),
    ticket_number: ticketNumber,
    budget: store.show.default_budget,
    allocations: {},
    created_at: now(),
    is_bot: isBot,
    pref: {},
    spend: 1,
  }
  store.guests.push(guest)
  const ticket = store.tickets.find((t) => t.number === ticketNumber)
  if (ticket) {
    ticket.guest_id = guest.id
    ticket.claimed_at = guest.created_at
    ticket.released = false
  } else {
    store.tickets.push({ number: ticketNumber, guest_id: guest.id, claimed_at: guest.created_at, released: false })
  }
  log('join', `Билет ${ticketNumber}${isBot ? ' (бот)' : ''}`, guest.id)
  return guest
}

function currentGuest(): Guest {
  let token: string | null = null
  try {
    token = localStorage.getItem(TOKEN_KEY)
  } catch {
    // нет доступа к хранилищу
  }
  const guest = token ? store.guests.find((g) => g.token === token) : undefined
  if (!guest) throw new ApiError('not_joined')
  return guest
}

function rememberToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // нет доступа к хранилищу
  }
}

// ---------- Сборка ответов ----------

function sortedProjects(): Project[] {
  return [...store.projects].sort((a, b) => a.position - b.position)
}

function guestState(g: Guest): GuestState {
  const projects = sortedProjects().map((p) => ({
    id: p.id,
    position: p.position,
    is_open: p.is_open,
    name: p.is_open ? p.name : null,
    speaker: p.is_open ? p.speaker : null,
    my_amount: g.allocations[p.id] ?? 0,
  }))
  return {
    ticket_number: g.ticket_number,
    budget: g.budget,
    free: g.budget - allocatedTotal(g),
    voting_open: store.show.voting_open,
    projects,
  }
}

function totals(p: Project): ProjectTotals {
  let amount = 0
  let investors = 0
  for (const g of store.guests) {
    const a = g.allocations[p.id] ?? 0
    if (a > 0) {
      amount += a
      investors++
    }
  }
  return { ...p, amount, investors }
}

function projectById(id: string | null): Project | undefined {
  return id ? store.projects.find((p) => p.id === id) : undefined
}

function overview(): AdminOverview {
  const projects = sortedProjects().map(totals)
  const moneyTotal = sum(store.guests.map((g) => g.budget))
  const moneyAllocated = sum(projects.map((p) => p.amount))
  return {
    show: { ...store.show },
    projects,
    registered: store.guests.length,
    tickets_in_list: store.tickets.length,
    money_total: moneyTotal,
    money_allocated: moneyAllocated,
    money_free: moneyTotal - moneyAllocated,
    last_action_at: store.last_action_at,
  }
}

function renumber() {
  sortedProjects().forEach((p, i) => (p.position = i + 1))
}

function removeAllocationsFor(projectId: string): { investors: number; amount: number } {
  let investors = 0
  let amount = 0
  for (const g of store.guests) {
    const a = g.allocations[projectId] ?? 0
    if (a > 0) {
      investors++
      amount += a
      delete g.allocations[projectId]
    }
  }
  if (investors > 0) markTotalsChanged()
  return { investors, amount }
}

// ---------- Публичный API ----------

export const mockApi: Api = {
  async join(rawTicket) {
    await likeNetwork()
    const show = store.show
    const ticketNumber = normalizeTicket(rawTicket)
    if (!ticketMatchesFormat(ticketNumber, show)) throw new ApiError('bad_format')
    if (!show.registration_open) throw new ApiError('registration_closed')
    const ticket = store.tickets.find((t) => t.number === ticketNumber)
    if (show.ticket_mode === 'whitelist' && !ticket) throw new ApiError('not_found')
    if (ticket?.guest_id) {
      const owner = store.guests.find((g) => g.id === ticket.guest_id)
      if (owner && !ticket.released) throw new ApiError('taken')
      if (owner) {
        // Билет отвязан ведущим: передаём гостя новому устройству вместе с деньгами (D4)
        owner.token = uid()
        ticket.released = false
        ticket.claimed_at = now()
        rememberToken(owner.token)
        log('transfer', `Билет ${ticketNumber} передан новому устройству`, owner.id)
        emitShow()
        return guestState(owner)
      }
    }
    const guest = createGuest(ticketNumber, false)
    rememberToken(guest.token)
    emitShow()
    return guestState(guest)
  },

  async getMe() {
    await likeNetwork()
    return guestState(currentGuest())
  },

  async allocate(projectId, amount) {
    await likeNetwork()
    const guest = currentGuest()
    setAllocation(guest, projectId, amount)
    return guestState(guest)
  },

  async getScreen(): Promise<ScreenState> {
    const show = store.show
    const ranked = sortedProjects()
      .filter((p) => p.is_open)
      .map(totals)
      .sort((a, b) => b.amount - a.amount || a.position - b.position)
    // Финал (D21): после закрытия голосования экран получает только уже показанные места —
    // последние N строк рейтинга. Непоказанные на экран не попадают вообще.
    const revealed = Math.min(show.revealed_count, ranked.length)
    const finale = show.voting_open ? null : { revealed, total: ranked.length, max_amount: ranked[0]?.amount ?? 0 }
    return {
      mode: show.screen_mode,
      voting_open: show.voting_open,
      registered: store.guests.length,
      join_url: joinUrl(),
      overview: finale ? ranked.slice(ranked.length - revealed) : ranked,
      finale,
    }
  },

  async adminIsLoggedIn() {
    return true // в прототипе пароль отключён
  },

  async adminLogin() {
    await likeNetwork()
  },

  async adminOverview() {
    return overview()
  },

  async adminUpdateShow(patch) {
    await likeNetwork()
    const before = { ...store.show }
    Object.assign(store.show, patch)
    // Смена состояния голосования всегда начинает финал заново
    if (before.voting_open !== store.show.voting_open) {
      store.show.revealed_count = 0
      log('voting', store.show.voting_open ? 'Голосование открыто' : 'Голосование закрыто')
    }
    const openCount = store.projects.filter((p) => p.is_open).length
    store.show.revealed_count = Math.max(0, Math.min(openCount, Math.floor(store.show.revealed_count)))
    if (before.revealed_count !== store.show.revealed_count) log('reveal', `Показано мест: ${store.show.revealed_count}`)
    if (before.registration_open !== store.show.registration_open) log('registration', store.show.registration_open ? 'Регистрация открыта' : 'Регистрация закрыта')
    touch()
    emitShow()
    return overview()
  },

  async adminAddProject(name, speaker) {
    await likeNetwork()
    store.projects.push({ id: uid(), name: name.trim(), speaker: speaker.trim(), position: store.projects.length + 1, is_open: false })
    renumber()
    log('project_add', name)
    emitShow()
    return overview()
  },

  async adminEditProject(id, fields) {
    await likeNetwork()
    const p = projectById(id)
    if (p) {
      p.name = fields.name.trim()
      p.speaker = fields.speaker.trim()
      log('project_edit', p.name)
      emitShow()
    }
    return overview()
  },

  async adminDeleteProject(id) {
    await likeNetwork()
    const p = projectById(id)
    if (p) {
      const returned = removeAllocationsFor(id)
      store.projects = store.projects.filter((x) => x.id !== id)
      renumber()
      log('project_delete', `${p.name}: возвращено ${formatMoney(returned.amount)} ${returned.investors} зрителям`)
      emitShow()
    }
    return overview()
  },

  async adminMoveProject(id, direction) {
    await likeNetwork()
    const list = sortedProjects()
    const index = list.findIndex((p) => p.id === id)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index >= 0 && swapWith >= 0 && swapWith < list.length) {
      const a = list[index]
      const b = list[swapWith]
      ;[a.position, b.position] = [b.position, a.position]
      touch()
      emitShow()
    }
    return overview()
  },

  async adminOpenProject(id) {
    await likeNetwork()
    const p = projectById(id)
    if (p && !p.is_open) {
      p.is_open = true
      botsNoticeProject(id)
      log('project_open', p.name, null, id)
      emitShow()
    }
    return overview()
  },

  async adminCloseProject(id) {
    await likeNetwork()
    const p = projectById(id)
    if (p && p.is_open) {
      p.is_open = false
      const returned = removeAllocationsFor(id)
      log('project_close', `${p.name}: возвращено ${formatMoney(returned.amount)} ${returned.investors} зрителям`, null, id)
      emitShow()
    }
    return overview()
  },

  async adminTickets(): Promise<AdminTicket[]> {
    const rows = store.tickets.map((t) => {
      const guest = t.guest_id ? store.guests.find((g) => g.id === t.guest_id) : undefined
      const status: AdminTicket['status'] = !t.guest_id ? 'free' : t.released ? 'released' : 'claimed'
      return {
        number: t.number,
        status,
        claimed_at: t.claimed_at,
        allocated: guest ? allocatedTotal(guest) : 0,
        budget: guest?.budget ?? store.show.default_budget,
        is_bot: guest?.is_bot ?? false,
      }
    })
    const order: Record<AdminTicket['status'], number> = { claimed: 0, released: 1, free: 2 }
    return rows.sort((a, b) => order[a.status] - order[b.status] || a.number.localeCompare(b.number))
  },

  async adminImportTickets(text) {
    await likeNetwork()
    let added = 0
    for (const line of text.split(/\r?\n/)) {
      const number = normalizeTicket(line)
      if (!number || store.tickets.some((t) => t.number === number)) continue
      store.tickets.push({ number, guest_id: null, claimed_at: null, released: false })
      added++
    }
    log('tickets_import', `Добавлено ${added}`)
    emitShow()
    return added
  },

  async adminGenerateTickets(count) {
    await likeNetwork()
    const created: string[] = []
    const { ticket_length, ticket_chars } = store.show
    let guard = 0
    while (created.length < count && guard++ < count * 50) {
      const number = randomTicket(ticket_length, ticket_chars)
      if (store.tickets.some((t) => t.number === number)) continue
      store.tickets.push({ number, guest_id: null, claimed_at: null, released: false })
      created.push(number)
    }
    log('tickets_generate', `Создано ${created.length}`)
    emitShow()
    return created
  },

  async adminReleaseTicket(number) {
    await likeNetwork()
    const t = store.tickets.find((x) => x.number === number)
    if (t && t.guest_id) {
      t.released = true
      log('ticket_release', `Билет ${number} отвязан`, t.guest_id)
      emitShow()
    }
  },

  async adminReset(scope: ResetScope) {
    await likeNetwork()
    if (scope === 'allocations') {
      for (const g of store.guests) g.allocations = {}
      log('reset_allocations', 'Все вложения сброшены')
      markTotalsChanged()
    } else {
      store.guests = []
      store.tickets = store.tickets
        .filter(() => store.show.ticket_mode === 'whitelist')
        .map((t) => ({ ...t, guest_id: null, claimed_at: null, released: false }))
      for (const p of store.projects) p.is_open = false
      store.show.registration_open = true
      store.show.voting_open = true
      store.show.screen_mode = 'qr'
      rememberToken(null)
      log('reset_all', 'Полный сброс')
      markTotalsChanged()
    }
    emitShow()
    return overview()
  },

  async adminSeedDemo() {
    await likeNetwork()
    for (const g of store.guests) g.allocations = {}
    store.projects = demoProjects(0)
    log('seed_demo', 'Тестовые проекты')
    markTotalsChanged()
    emitShow()
    return overview()
  },

  subscribe(channel, callback) {
    listeners[channel].add(callback)
    return () => listeners[channel].delete(callback)
  },

  async restartDemo() {
    store = freshStore()
    rememberToken(null)
    dirty = true
    save()
    emitShow()
    markTotalsChanged()
  },
}
