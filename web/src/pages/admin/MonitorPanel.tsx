// Мониторинг: сколько зрителей, сколько денег распределено, суммы по проектам, последнее действие.
import { formatMoney, formatTime } from '@shared/format'
import { texts } from '@shared/texts'
import type { AdminOverview } from '@shared/types'
import { Card } from '../../components/Card'

export function MonitorPanel({ o }: { o: AdminOverview }) {
  const max = Math.max(1, ...o.projects.map((p) => p.amount))
  return (
    <Card title={texts.admin.monitorSection}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={texts.admin.registeredGuests} value={String(o.registered)} />
        <Stat label={texts.admin.moneyAllocated} value={formatMoney(o.money_allocated)} />
        <Stat label={texts.admin.moneyFree} value={formatMoney(o.money_free)} />
        <Stat label={texts.admin.lastAction} value={formatTime(o.last_action_at)} />
      </div>
      <div className="text-sm text-muted mt-4 mb-2">{texts.admin.perProject}</div>
      <ul className="flex flex-col gap-2">
        {o.projects.map((p) => (
          <li key={p.id} className={p.is_open ? '' : 'opacity-50'}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {p.position}. {p.name}
              </span>
              <span className="money shrink-0">
                {formatMoney(p.amount)} · {p.investors}
              </span>
            </div>
            <div className="h-1.5 bg-line rounded mt-1 overflow-hidden">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(p.amount / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg border border-line rounded-lg p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="display money text-2xl mt-1">{value}</div>
    </div>
  )
}
