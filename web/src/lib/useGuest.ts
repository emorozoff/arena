// Состояние зрителя и очередь его действий (решение D2).
// Нажатие сразу видно на экране, на сервер уходит «поставить вложение равным S».
// В полёте не больше одного запроса; новые нажатия сливаются в последнее значение.
// При обрыве связи запрос повторяется сам, действие не теряется.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from '@shared/config'
import { texts } from '@shared/texts'
import { ApiError, type GuestState } from '@shared/types'
import { api } from './api'
import { useLive } from './useLive'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function without(map: Record<string, number>, key: string): Record<string, number> {
  const copy = { ...map }
  delete copy[key]
  return copy
}

export function useGuest() {
  const live = useLive(() => api.getMe(), ['show'])
  const [desired, setDesired] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const pending = useRef(new Map<string, number>())
  const inFlight = useRef(false)

  // Показываем серверное состояние с наложенными на него ещё не подтверждёнными нажатиями
  const state = useMemo<GuestState | null>(() => {
    const server = live.data
    if (!server) return null
    const projects = server.projects.map((p) => ({ ...p, my_amount: desired[p.id] ?? p.my_amount }))
    const allocated = projects.reduce((acc, p) => acc + p.my_amount, 0)
    return { ...server, projects, free: server.budget - allocated }
  }, [live.data, desired])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const pump = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSending(true)
    try {
      while (pending.current.size > 0) {
        const [projectId, amount] = pending.current.entries().next().value as [string, number]
        pending.current.delete(projectId)
        try {
          const fresh = await api.allocate(projectId, amount)
          live.setData(fresh)
          setOnline(true)
          if (!pending.current.has(projectId)) setDesired((d) => without(d, projectId))
        } catch (e) {
          if (e instanceof ApiError && e.code !== 'network') {
            // Сервер отказал по правилам: показываем причину и берём правду с сервера
            setNotice(texts.errors[e.code])
            pending.current.delete(projectId)
            setDesired((d) => without(d, projectId))
            await live.refresh()
          } else {
            // Нет связи: оставляем действие в очереди и пробуем снова
            setOnline(false)
            if (!pending.current.has(projectId)) pending.current.set(projectId, amount)
            await delay(config.retryDelayMs)
          }
        }
      }
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }, [live])

  const setAmount = useCallback(
    (projectId: string, target: number) => {
      if (!state) return
      const project = state.projects.find((p) => p.id === projectId)
      if (!project) return
      const current = project.my_amount
      const maxAllowed = current + state.free
      const next = Math.max(0, Math.min(target, maxAllowed))
      if (next === current) return
      setDesired((d) => ({ ...d, [projectId]: next }))
      pending.current.set(projectId, next)
      void pump()
    },
    [state, pump],
  )

  const bump = useCallback(
    (projectId: string, delta: number) => {
      const project = state?.projects.find((p) => p.id === projectId)
      if (!project) return
      setAmount(projectId, project.my_amount + delta)
    },
    [state, setAmount],
  )

  const takeAll = useCallback((projectId: string) => setAmount(projectId, 0), [setAmount])

  return { state, online: online && live.online, error: live.error, notice, sending, bump, takeAll }
}
