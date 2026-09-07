// Что умеет «сервер» с точки зрения страниц. Две реализации:
//   api.mock.ts — игрушечный сервер внутри браузера (прототип, решение D16)
//   api.http.ts — настоящий сервер Node + SQLite (появится на этапе 2)
// Страницы зовут только эти функции и не знают, какая реализация за ними.
import type {
  AdminOverview,
  AdminTicket,
  GuestState,
  LiveChannel,
  ResetScope,
  ScreenState,
  ShowState,
} from '@shared/types'

export interface Api {
  // Зритель
  join(ticket: string): Promise<GuestState>
  getMe(): Promise<GuestState>
  allocate(projectId: string, amount: number): Promise<GuestState>

  // Экран на сцену
  getScreen(): Promise<ScreenState>

  // Ведущий
  adminIsLoggedIn(): Promise<boolean>
  adminLogin(password: string): Promise<void>
  adminOverview(): Promise<AdminOverview>
  adminUpdateShow(patch: Partial<ShowState>): Promise<AdminOverview>
  adminAddProject(name: string, speaker: string): Promise<AdminOverview>
  adminEditProject(id: string, fields: { name: string; speaker: string }): Promise<AdminOverview>
  adminDeleteProject(id: string): Promise<AdminOverview>
  adminMoveProject(id: string, direction: 'up' | 'down'): Promise<AdminOverview>
  adminOpenProject(id: string): Promise<AdminOverview>
  adminCloseProject(id: string): Promise<AdminOverview>
  adminTickets(): Promise<AdminTicket[]>
  adminImportTickets(text: string): Promise<number>
  adminGenerateTickets(count: number): Promise<string[]>
  adminReleaseTicket(number: string): Promise<void>
  adminReset(scope: ResetScope): Promise<AdminOverview>
  adminSeedDemo(): Promise<AdminOverview>

  // Реалтайм: сигнал «обновись» по каналу (решение D6). Возвращает функцию отписки.
  subscribe(channel: LiveChannel, callback: () => void): () => void

  // Только в прототипе: начать демо заново
  restartDemo?(): Promise<void>
}
