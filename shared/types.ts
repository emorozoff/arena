// Формы данных, общие для сервера и фронтенда. Меняются вместе с ARCHITECTURE.md.

export type TicketMode = 'free' | 'whitelist'
export type ScreenMode = 'qr' | 'overview'
export type TicketChars = 'digits' | 'letters_digits'

// Состояние шоу: одна строка в базе, все переключатели ведущего
export interface ShowState {
  registration_open: boolean
  voting_open: boolean
  ticket_mode: TicketMode
  ticket_length: number
  ticket_chars: TicketChars
  screen_mode: ScreenMode
  revealed_count: number   // финал: сколько мест уже показано на экране, считая с последнего (D21)
  default_budget: number
}

export interface Project {
  id: string
  name: string
  speaker: string
  position: number
  is_open: boolean
}

// Что видит зритель по проекту. У закрытых проектов название скрыто.
export interface GuestProject {
  id: string
  position: number
  is_open: boolean
  name: string | null
  speaker: string | null
  my_amount: number
}

// Полное состояние зрителя. Любой запрос зрителя возвращает именно это (решение D7).
export interface GuestState {
  ticket_number: string
  budget: number
  free: number
  voting_open: boolean
  projects: GuestProject[]
}

// Проект с общими суммами: для экрана и админки
export interface ProjectTotals extends Project {
  amount: number
  investors: number
}

export interface ScreenState {
  mode: ScreenMode
  voting_open: boolean
  registered: number
  join_url: string
  // Пока голосование открыто — все открытые проекты по убыванию суммы.
  // После закрытия — только уже показанные ведущим места (финал, D21), тоже по убыванию.
  overview: ProjectTotals[]
  // null, пока голосование открыто. max_amount — сумма победителя, чтобы полосы росли в одном масштабе
  finale: { revealed: number; total: number; max_amount: number } | null
}

export type TicketStatus = 'free' | 'claimed' | 'released'

export interface AdminTicket {
  number: string
  status: TicketStatus
  claimed_at: string | null
  allocated: number
  budget: number
  is_bot: boolean   // только в прототипе: зритель-бот
}

export interface AdminOverview {
  show: ShowState
  projects: ProjectTotals[]     // по порядку показа
  registered: number
  tickets_in_list: number       // сколько билетов в списке (для whitelist)
  money_total: number
  money_allocated: number
  money_free: number
  last_action_at: string | null
}

export type ResetScope = 'allocations' | 'all'

// Коды ошибок, которые сервер отдаёт клиенту. Тексты для людей — в texts.ts.
export type ApiErrorCode =
  | 'bad_format'
  | 'not_found'
  | 'taken'
  | 'registration_closed'
  | 'voting_closed'
  | 'project_closed'
  | 'over_budget'
  | 'negative'
  | 'not_joined'
  | 'unauthorized'
  | 'network'
  | 'unknown'

export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export type LiveChannel = 'show' | 'totals'
