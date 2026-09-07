// Индикаторы связи: точка в шапке и плашка «Нет связи, повторяем…» внизу экрана.
import { texts } from '@shared/texts'

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-ok' : 'bg-accent animate-pulse'}`} />
      {online ? texts.common.online : texts.common.offline}
    </span>
  )
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null
  return (
    <div className="fixed left-0 right-0 bottom-0 z-40 bg-accent text-white text-center font-semibold py-3 px-4">
      {texts.common.offline}
    </div>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed left-4 right-4 bottom-6 z-40 bg-card border border-accent text-text text-center font-semibold rounded-xl py-3 px-4">
      {message}
    </div>
  )
}
