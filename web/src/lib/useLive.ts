// Живые данные: загрузить, обновлять по сигналу реалтайма и страховочным опросом (решение D6).
// При обрыве связи данные не пропадают — остаётся последнее известное состояние.
import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '@shared/config'
import { ApiError, type ApiErrorCode, type LiveChannel } from '@shared/types'
import { api } from './api'

export function useLive<T>(load: () => Promise<T>, channels: LiveChannel[], pollMs = config.fallbackPollMs) {
  const [data, setData] = useState<T | null>(null)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<ApiErrorCode | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadRef.current()
      setData(fresh)
      setError(null)
      setOnline(true)
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'network') {
        setError(e.code)
        setOnline(true)
      } else {
        setOnline(false)
      }
    }
  }, [])

  const channelKey = channels.join(',')
  useEffect(() => {
    void refresh()
    const unsubscribes = channelKey
      ? channelKey.split(',').map((c) => api.subscribe(c as LiveChannel, () => void refresh()))
      : []
    const timer = setInterval(() => void refresh(), pollMs)
    return () => {
      unsubscribes.forEach((unsub) => unsub())
      clearInterval(timer)
    }
  }, [channelKey, pollMs, refresh])

  return { data, setData, online, error, refresh }
}
