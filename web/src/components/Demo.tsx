// Только для прототипа (решение D16): полоска переключения ролей и вступительное окно.
import { useState } from 'react'
import { texts } from '@shared/texts'
import { api } from '../lib/api'
import { navigate, type Route } from '../lib/router'
import { Button } from './Button'

const INTRO_KEY = 'arena_demo_intro_seen'

const roles: Route[] = ['app', 'admin', 'screen']

export function DemoBar({ route }: { route: Route }) {
  const [restartArmed, setRestartArmed] = useState(false)
  const activeRole: Route = route === 'join' ? 'app' : route

  const restart = async () => {
    if (!restartArmed) {
      setRestartArmed(true)
      setTimeout(() => setRestartArmed(false), 4000)
      return
    }
    setRestartArmed(false)
    await api.restartDemo?.()
    navigate('join')
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-11 bg-card border-b border-line flex items-center px-2 gap-1">
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => navigate(r)}
          className={`h-8 px-3 rounded-md text-sm font-semibold transition-colors ${
            activeRole === r ? 'bg-accent text-white' : 'text-muted hover:text-text'
          }`}
        >
          {texts.demo.roles[r as keyof typeof texts.demo.roles]}
        </button>
      ))}
      <span className="flex-1 text-center text-xs text-muted hidden sm:block">{texts.demo.badge}</span>
      <button
        type="button"
        onClick={() => void restart()}
        className={`ml-auto h-8 px-3 rounded-md text-sm font-semibold ${restartArmed ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
      >
        {restartArmed ? texts.admin.confirmAgain : texts.demo.restart}
      </button>
    </div>
  )
}

export function DemoIntro() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(INTRO_KEY) === '1'
    } catch {
      return false
    }
  })
  if (seen) return null

  const start = () => {
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      // нет доступа к хранилищу
    }
    setSeen(true)
    navigate('join')
  }

  return (
    <div className="fixed inset-0 z-[60] bg-bg/95 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-line rounded-2xl p-6 flex flex-col gap-4">
        <span className="display text-accent text-lg">{texts.common.showName}</span>
        <h1 className="display text-3xl">{texts.demo.introTitle}</h1>
        {texts.demo.introLines.map((line) => (
          <p key={line} className="text-muted leading-relaxed">
            {line}
          </p>
        ))}
        <Button size="lg" onClick={start}>
          {texts.demo.introButton}
        </Button>
      </div>
    </div>
  )
}
