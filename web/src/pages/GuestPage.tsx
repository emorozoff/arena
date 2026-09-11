// Телефон зрителя: свободный остаток, открытые проекты с кнопками, заглушки закрытых.
import { useEffect } from 'react'
import { config } from '@shared/config'
import { formatDelta, formatMoney } from '@shared/format'
import { texts } from '@shared/texts'
import type { GuestProject, GuestState } from '@shared/types'
import { Button } from '../components/Button'
import { OfflineBanner, StatusDot, Toast } from '../components/Status'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { useGuest } from '../lib/useGuest'

export function GuestPage() {
  const { state, online, error, notice, bump, takeAll } = useGuest()

  useEffect(() => {
    if (error === 'not_joined') navigate('join')
  }, [error])

  if (!state) return <div className="min-h-dvh bg-bg" />
  if (!state.voting_open) return <ClosedView state={state} online={online} />

  const open = state.projects.filter((p) => p.is_open)
  const closed = state.projects.filter((p) => !p.is_open)
  const allocatedShare = state.budget > 0 ? (state.budget - state.free) / state.budget : 0

  return (
    <div className="max-w-md mx-auto px-4 pb-28">
      <header className="sticky top-[var(--demo-bar,0px)] z-30 bg-bg/95 backdrop-blur py-4 border-b border-line">
        <div className="flex items-center justify-between">
          <span className="display text-muted text-sm">{texts.common.showName}</span>
          <StatusDot online={online} />
        </div>
        <SectorBadge sector={state.sector} />
        <div className="text-muted text-sm mt-3">{texts.guest.free}</div>
        <div className="display money text-accent text-5xl leading-none mt-1">{formatMoney(state.free)}</div>
        <div className="text-muted text-xs mt-2">
          {texts.guest.of} {formatMoney(state.budget)} · {texts.guest.ticket} {state.ticket_number} · <LogoutLink />
        </div>
        <div className="h-1 bg-line rounded mt-3 overflow-hidden">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.round(allocatedShare * 100)}%` }} />
        </div>
      </header>

      <main className="flex flex-col gap-3 mt-4">
        {open.length === 0 && <p className="text-muted text-center py-8">{texts.guest.noProjectsYet}</p>}
        {open.map((p) => (
          <ProjectCard key={p.id} project={p} free={state.free} onBump={bump} onTakeAll={takeAll} />
        ))}
        {closed.map((p) => (
          <div key={p.id} className="border border-dashed border-line rounded-xl px-4 py-4 text-muted">
            <span className="display text-lg">{texts.guest.closedProject(p.position)}</span>
            <span className="text-sm"> · {texts.guest.opensLater}</span>
          </div>
        ))}
      </main>

      <Toast message={notice} />
      <OfflineBanner online={online} />
    </div>
  )
}

function ProjectCard({
  project,
  free,
  onBump,
  onTakeAll,
}: {
  project: GuestProject
  free: number
  onBump: (id: string, delta: number) => void
  onTakeAll: (id: string) => void
}) {
  const invested = project.my_amount > 0
  return (
    <section className={`bg-card border rounded-xl p-4 ${invested ? 'border-accent/60' : 'border-line'}`}>
      <div className="text-xs text-muted">{texts.guest.closedProject(project.position)}</div>
      <h2 className="display text-2xl mt-1">{project.name}</h2>
      <div className="text-muted text-sm mt-1">{project.speaker}</div>

      <div className="flex items-baseline justify-between mt-4">
        <span className="text-sm text-muted">{texts.guest.invested}</span>
        <span className={`display money text-3xl ${invested ? 'text-accent' : 'text-muted'}`}>{formatMoney(project.my_amount)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {config.plusButtons.map((step) => (
          <Button key={step} size="md" className="money" disabled={free <= 0} onClick={() => onBump(project.id, step)}>
            {formatDelta(step)}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {config.minusButtons.map((step) => (
          <Button key={step} variant="ghost" size="md" className="money" disabled={!invested} onClick={() => onBump(project.id, -step)}>
            {formatDelta(-step)}
          </Button>
        ))}
        <Button variant="ghost" size="md" disabled={!invested} onClick={() => onTakeAll(project.id)}>
          {texts.guest.takeAll}
        </Button>
      </div>
    </section>
  )
}

// «Выйти»: забыть билет на этом телефоне и вернуться к вводу номера. Вложения остаются за билетом.
function LogoutLink() {
  const logout = async () => {
    if (!window.confirm(texts.guest.logoutConfirm)) return
    await api.logout()
    navigate('join')
  }
  return (
    <button type="button" onClick={() => void logout()} className="underline text-muted">
      {texts.guest.logout}
    </button>
  )
}

// Тариф билета (сектор из выгрузки площадки): GOLD, STANDARD, ... Показывается, если известен.
function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return null
  const label = config.sectorLabels[sector] ?? sector
  return <span className="inline-block mt-3 px-3 py-1 rounded-full border border-accent text-accent display text-sm tracking-wider">{label}</span>
}

function ClosedView({ state, online }: { state: GuestState; online: boolean }) {
  const mine = state.projects.filter((p) => p.is_open && p.my_amount > 0)
  const total = mine.reduce((acc, p) => acc + p.my_amount, 0)
  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-16 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="display text-muted text-sm">{texts.common.showName}</span>
        <StatusDot online={online} />
      </div>
      <SectorBadge sector={state.sector} />
      <div>
        <h1 className="display text-5xl text-accent">{texts.guest.votingClosedTitle}</h1>
        <p className="text-muted mt-3 leading-relaxed">{texts.guest.votingClosedText}</p>
      </div>
      <section className="bg-card border border-line rounded-xl p-4">
        <h2 className="display text-2xl">{texts.guest.yourAllocations}</h2>
        {mine.length === 0 && <p className="text-muted mt-3">{texts.guest.notInvested}</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {mine.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <span className="display text-lg">{p.name}</span>
              <span className="display money text-2xl text-accent">{formatMoney(p.my_amount)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between mt-4">
          <span className="text-muted text-sm">{texts.guest.totalInvested}</span>
          <span className="display money text-2xl">{formatMoney(total)}</span>
        </div>
        <div className="text-xs text-muted mt-2">
          {texts.guest.ticket} {state.ticket_number} · <LogoutLink />
        </div>
      </section>
      <OfflineBanner online={online} />
    </div>
  )
}
