// Экран на сцену: тёмный фон, огромные цифры. Два состояния переключает ведущий:
// «QR-код» до начала и «Общий расклад». Пока голосование открыто, в раскладе видны все открытые
// проекты по сумме. После закрытия начинается финал (D21): сервер присылает только показанные
// ведущим места, они появляются по одному с последнего, новая строка всегда сверху. Победитель —
// последним, с лёгкой пометкой.
// При обрыве связи показывает последнее известное состояние. Никаких ошибок на проекторе.
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { formatMoney, plural } from '@shared/format'
import { texts } from '@shared/texts'
import type { ProjectTotals, ScreenState } from '@shared/types'
import { CountUp } from '../components/CountUp'
import { StatusDot } from '../components/Status'
import { api } from '../lib/api'
import { useLive } from '../lib/useLive'
import { AdminLogin } from './AdminPage'

export function ScreenPage() {
  const { data, online, error, refresh } = useLive(() => api.getScreen(), ['show', 'totals'])
  const last = useRef<ScreenState | null>(null)
  if (data) last.current = data
  const s = last.current

  // Экран закрыт паролем ведущего (D3): без сессии показываем форму входа, а не пустоту
  if (!s && error === 'unauthorized') return <AdminLogin onDone={() => void refresh()} />

  return (
    <div className="min-h-[calc(100dvh-var(--demo-bar,0px))] bg-bg text-text flex flex-col p-[4vmin]">
      <div className="flex items-center justify-between">
        <span className="display text-muted text-[clamp(14px,2.5vmin,32px)]">{texts.common.showName}</span>
        <div className="flex items-center gap-4">
          {s && !s.voting_open && (
            <span className="display text-accent text-[clamp(14px,2.5vmin,32px)]">{texts.screen.votingClosed}</span>
          )}
          <StatusDot online={online} />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {s && (s.mode === 'qr' ? <QrMode s={s} /> : <OverviewMode rows={s.overview} finale={s.finale} />)}
      </div>
    </div>
  )
}

function QrMode({ s }: { s: ScreenState }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(s.join_url, { margin: 1, width: 720, errorCorrectionLevel: 'M' })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [s.join_url])

  return (
    <div className="flex flex-col landscape:flex-row items-center justify-center gap-[6vmin] w-full">
      <div className="bg-white rounded-[2vmin] p-[2vmin] shrink-0" style={{ width: 'min(60vmin, 520px)', height: 'min(60vmin, 520px)' }}>
        {src && <img src={src} alt="QR" className="w-full h-full block" />}
      </div>
      <div className="flex flex-col gap-[3vmin] max-w-[70vmin] landscape:max-w-[50vw] text-center landscape:text-left">
        <h1 className="display text-[clamp(28px,7vmin,110px)] leading-[0.95]">{texts.screen.qrTitle}</h1>
        <p className="text-muted text-[clamp(14px,2.6vmin,36px)] leading-snug">{texts.screen.qrHint}</p>
        <div>
          <div className="text-muted text-[clamp(14px,2.4vmin,32px)]">{texts.screen.registered}</div>
          <CountUp value={s.registered} format={(n) => String(n)} duration={600} className="display text-accent text-[clamp(56px,14vmin,220px)] leading-none" />
        </div>
      </div>
    </div>
  )
}

function OverviewMode({ rows, finale }: { rows: ProjectTotals[]; finale: ScreenState['finale'] }) {
  // В финале полосы считаются от суммы победителя: у последнего места полоса короткая, у победителя — во всю ширину
  const max = Math.max(1, finale ? finale.max_amount : 0, ...rows.map((r) => r.amount))
  const winnerShown = finale !== null && finale.revealed >= finale.total && finale.total > 0
  const title = finale ? texts.screen.finaleTitle : texts.screen.overviewTitle

  if (rows.length === 0) {
    return (
      <div className="display text-muted text-[clamp(24px,6vmin,96px)] text-center">
        {finale ? title : texts.screen.noOpenProjects}
      </div>
    )
  }
  return (
    <div className="w-full max-w-[1600px] flex flex-col gap-[2.5vmin]">
      <h1 className="display text-muted text-[clamp(18px,3.5vmin,48px)]">{title}</h1>
      {rows.map((r, i) => {
        const isWinner = winnerShown && i === 0
        return (
          <div key={r.id} className={`row-appear ${isWinner ? 'rounded-[1vmin] outline outline-1 outline-accent/70 p-[1.5vmin] -m-[1.5vmin]' : ''}`}>
            {isWinner && <div className="display text-accent text-[clamp(12px,2vmin,28px)] mb-[0.5vmin]">{texts.screen.winner}</div>}
            <div className="flex items-baseline justify-between gap-4">
              <span className="display text-[clamp(18px,4.2vmin,64px)] leading-none truncate">{r.name}</span>
              <CountUp value={r.amount} initial={finale ? 0 : undefined} duration={finale ? 1400 : 800} format={formatMoney} className="display text-accent text-[clamp(20px,5vmin,72px)] leading-none shrink-0" />
            </div>
            <div className="flex items-center gap-[2vmin] mt-[1vmin]">
              <div className="flex-1 h-[clamp(14px,3.5vmin,52px)] bg-line rounded-[0.6vmin] overflow-hidden">
                <div className="h-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%` }} />
              </div>
              <span className="text-muted text-[clamp(11px,1.8vmin,24px)] shrink-0 w-[16vmin] text-right">{plural(r.investors, texts.screen.investors)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
