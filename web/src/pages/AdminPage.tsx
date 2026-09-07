// Пульт ведущего: управление шоу, проекты, мониторинг, билеты, опасная зона.
import { useEffect, useState, type FormEvent } from 'react'
import { texts } from '@shared/texts'
import { ApiError, type AdminOverview } from '@shared/types'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input, Label } from '../components/Field'
import { OfflineBanner, StatusDot, Toast } from '../components/Status'
import { api, IS_DEMO } from '../lib/api'
import { useLive } from '../lib/useLive'
import { DangerZone } from './admin/DangerZone'
import { FinalePanel } from './admin/FinalePanel'
import { MonitorPanel } from './admin/MonitorPanel'
import { ProjectsPanel } from './admin/ProjectsPanel'
import { ShowControls } from './admin/ShowControls'
import { TicketsPanel } from './admin/TicketsPanel'

export type Apply = (action: () => Promise<AdminOverview>) => Promise<void>

export function AdminPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  useEffect(() => {
    api.adminIsLoggedIn().then(setLoggedIn).catch(() => setLoggedIn(false))
  }, [])
  if (loggedIn === null) return <div className="min-h-dvh bg-bg" />
  if (!loggedIn) return <AdminLogin onDone={() => setLoggedIn(true)} />
  return <AdminPanel />
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.adminLogin(password)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? texts.errors[err.code] : texts.errors.unknown)
    }
  }
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto px-5 pt-16 flex flex-col gap-4">
      <h1 className="display text-4xl">{texts.admin.loginTitle}</h1>
      <label>
        <Label>{texts.admin.password}</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </label>
      <Button type="submit" size="lg">
        {texts.admin.login}
      </Button>
      {error && <p className="text-accent">{error}</p>}
    </form>
  )
}

function AdminPanel() {
  const live = useLive(() => api.adminOverview(), ['show', 'totals'])
  const [message, setMessage] = useState<string | null>(null)
  const o = live.data

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 2500)
    return () => clearTimeout(timer)
  }, [message])

  const apply: Apply = async (action) => {
    try {
      live.setData(await action())
    } catch (err) {
      setMessage(err instanceof ApiError ? texts.errors[err.code] : texts.errors.unknown)
    }
  }

  if (!o) return <div className="min-h-dvh bg-bg" />

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="display text-muted text-sm">{texts.common.showName}</span>
          <StatusDot online={live.online} />
        </div>
        <h1 className="display text-4xl">{texts.admin.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Chip on={o.show.registration_open} label={`${texts.admin.registration}: ${o.show.registration_open ? texts.admin.openState : texts.admin.closedState}`} />
          <Chip on={o.show.voting_open} label={`${texts.admin.voting}: ${o.show.voting_open ? texts.admin.openState : texts.admin.closedState}`} />
          <Chip on label={`${texts.admin.screenMode}: ${texts.admin.screenModes[o.show.screen_mode]}`} />
        </div>
        {IS_DEMO && <p className="text-xs text-muted">{texts.demo.adminHint}</p>}
      </header>

      <ShowControls o={o} apply={apply} />
      {!o.show.voting_open && <FinalePanel o={o} apply={apply} />}
      <ProjectsPanel o={o} apply={apply} />
      <MonitorPanel o={o} />
      <DangerZone apply={apply} notify={setMessage} />
      <TicketsPanel o={o} apply={apply} notify={setMessage} />

      <Toast message={message} />
      <OfflineBanner online={live.online} />
    </div>
  )
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return <span className={`px-3 py-1 rounded-full border ${on ? 'border-accent text-text' : 'border-line text-muted'}`}>{label}</span>
}

export { Card }
