// Форматирование чисел и слов. Единственное место, где деньги превращаются в текст.
import { config } from './config'

// Узкий неразрывный пробел между разрядами: "1 000 000"
const THIN_SPACE = ' '

export function formatNumber(n: number): string {
  const sign = n < 0 ? '−' : ''
  const digits = Math.abs(Math.round(n)).toString()
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
}

// "$1 000 000"
export function formatMoney(n: number): string {
  return config.currencySign + formatNumber(n)
}

// Короткая запись для кнопок: "+50 000", "−100 000"
export function formatDelta(n: number): string {
  return (n >= 0 ? '+' : '−') + formatNumber(Math.abs(n))
}

// Русские склонения: plural(5, ['инвестор', 'инвестора', 'инвесторов']) → "5 инвесторов"
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  let form = forms[2]
  if (abs < 11 || abs > 14) {
    if (last === 1) form = forms[0]
    else if (last >= 2 && last <= 4) form = forms[1]
  }
  return `${formatNumber(n)} ${form}`
}

// Время для админки: "18:42:07"
export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
