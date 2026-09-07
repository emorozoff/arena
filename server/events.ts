// Реалтайм-сигналы «обновись» (решение D6). Данные по сигналу клиент перезапрашивает сам.
//   show   — изменилось состояние шоу: проекты, голосование, регистрация, экран. Получают все.
//   totals — кто-то переложил деньги. Получают только пульт и экран, не чаще раза в секунду.
import { config } from '@shared/config'
import type { LiveChannel } from '@shared/types'

type Send = (event: LiveChannel | 'hello' | 'ping', data: string) => void
interface Client {
  admin: boolean
  send: Send
}

const clients = new Map<number, Client>()
let nextClientId = 1
let version = 0
let totalsTimer: NodeJS.Timeout | null = null
let totalsPending = false

export function addClient(admin: boolean, send: Send): () => void {
  const id = nextClientId++
  clients.set(id, { admin, send })
  send('hello', String(version))
  return () => clients.delete(id)
}

export function clientCount(): number {
  return clients.size
}

export function emitShow() {
  version++
  for (const client of clients.values()) client.send('show', String(version))
}

export function emitTotals() {
  if (totalsTimer) {
    totalsPending = true
    return
  }
  sendTotals()
  totalsTimer = setTimeout(() => {
    totalsTimer = null
    if (totalsPending) {
      totalsPending = false
      emitTotals()
    }
  }, config.screenRefreshMs)
}

function sendTotals() {
  version++
  for (const client of clients.values()) if (client.admin) client.send('totals', String(version))
}

// Раз в 25 секунд — пустое сообщение, чтобы соединение не закрыли прокси и мобильные сети
setInterval(() => {
  for (const client of clients.values()) client.send('ping', '')
}, 25_000)
