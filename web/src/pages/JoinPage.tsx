// Вход зрителя: одно поле — номер билета.
import { useEffect, useState, type FormEvent } from 'react'
import { config } from '@shared/config'
import { texts } from '@shared/texts'
import { ApiError, type ApiErrorCode } from '@shared/types'
import { Logo } from '../components/Brand'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Field'
import { api, IS_DEMO } from '../lib/api'
import { navigate } from '../lib/router'

// Цифры показываем группами по четыре, как номер карты: 7866 0018 2909. Пробелы сервер игнорирует.
function groupDigits(raw: string): string {
  if (config.ticketChars !== 'digits') return raw.toUpperCase()
  const digits = raw.replace(/\D/g, '').slice(0, config.ticketLength)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

// Бланк под полем: «____ ____ ____», подчёркивания исчезают по мере ввода.
// Введённая часть повторяется прозрачным текстом тем же шрифтом, поэтому подчёркивания всегда стоят ровно после курсора.
function TicketMask({ value }: { value: string }) {
  const digits = value.replace(/\D/g, '')
  const full = (digits + '_'.repeat(Math.max(0, config.ticketLength - digits.length))).replace(/(.{4})(?=.)/g, '$1 ')
  const typed = full.slice(0, value.length)
  const rest = full.slice(value.length)
  return (
    <div aria-hidden className="absolute inset-0 flex items-center px-4 pointer-events-none display text-3xl tracking-[0.12em] whitespace-pre">
      <span className="text-transparent">{typed}</span>
      <span className="text-line">{rest}</span>
    </div>
  )
}

export function JoinPage() {
  const [ticket, setTicket] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiErrorCode | null>(null)
  const [lostAccess, setLostAccess] = useState(false)
  const [checking, setChecking] = useState(true)

  // Уже входил с этого телефона — сразу в зал
  useEffect(() => {
    api
      .getMe()
      .then(() => navigate('app'))
      .catch(() => setChecking(false))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setLostAccess(false)
    try {
      await api.join(ticket)
      navigate('app')
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'unknown')
    } finally {
      setBusy(false)
    }
  }

  if (checking) return <div className="min-h-dvh bg-bg" />

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-16 flex flex-col gap-6">
      <Logo className="h-8" />
      <div className="mt-2">
        <span className="display text-accent text-2xl">{texts.common.showName}</span>
        <h1 className="display text-6xl mt-1">{texts.join.title}</h1>
        <p className="text-muted mt-3 leading-relaxed whitespace-pre-line">{texts.join.subtitle}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">{texts.join.ticketLabel}</span>
          <div className="relative">
            {config.ticketChars === 'digits' && <TicketMask value={ticket} />}
            <Input
              value={ticket}
              onChange={(e) => setTicket(groupDigits(e.target.value))}
              placeholder={texts.join.ticketPlaceholder}
              inputMode={config.ticketChars === 'digits' ? 'numeric' : 'text'}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={config.ticketLength + Math.ceil(config.ticketLength / 4)}
              className="relative h-16 px-4 text-3xl tracking-[0.12em] display bg-transparent"
            />
          </div>
        </label>
        <Button type="submit" size="lg" disabled={busy || ticket.trim().length === 0}>
          {texts.join.enter}
        </Button>
        {error && <p className="text-accent font-semibold text-center">{texts.errors[error]}</p>}
        {error === 'registration_closed' && <p className="text-muted text-sm text-center">{texts.join.registrationClosedText}</p>}
        {error === 'taken' && !lostAccess && (
          <Button variant="ghost" onClick={() => setLostAccess(true)}>
            {texts.join.lostAccess}
          </Button>
        )}
      </form>

      {lostAccess && (
        <Card title={texts.join.lostAccessTitle}>
          <p className="text-muted leading-relaxed">{texts.join.lostAccessText}</p>
          <p className="text-sm text-muted mt-4">{texts.join.lostAccessCodeLabel}</p>
          <p className="display text-5xl text-accent tracking-[0.12em] mt-1">{ticket.trim().toUpperCase()}</p>
        </Card>
      )}

      {IS_DEMO && <p className="text-xs text-muted text-center">{texts.demo.joinHint}</p>}
    </div>
  )
}
