// Экран на сцену: тёмный фон, огромные цифры. Четыре режима переключает ведущий.
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

export function ScreenPage() {
  const { data, online } = useLive(() => api.getScreen(), ['show', 'totals'])
  const last = useRef<ScreenState | null>(null)
  if (data) last.current = data
  const s = last.current

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
      <div className="flex-1 flex items-center justify-center">{s && <Mode s={s} />}</div>
    </div>
  )
}

function Mode({ s }: { s: ScreenState }) {
  switch (s.mode) {
    case 'qr':
      return <QrMode s={s} />
    case 'current':
      return <CurrentMode project={s.current} />
    case 'reveal':
      return <RevealMode project={s.reveal} />
    case 'overview':
      return <OverviewMode rows={s.overview} />
  }
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

function CurrentMode({ project }: { project: ProjectTotals | null }) {
  return (
    <div className="text-center max-w-[90vw]">
      <div className="text-muted display text-[clamp(18px,3.5vmin,48px)]">{texts.screen.nowOnStage}</div>
      {project ? (
        <>
          <h1 className="display text-[clamp(40px,11vmin,180px)] leading-[0.95] mt-[2vmin]">{project.name}</h1>
          <div className="display text-accent text-[clamp(22px,5vmin,72px)] mt-[3vmin]">{project.speaker}</div>
        </>
      ) : (
        <h1 className="display text-[clamp(40px,11vmin,180px)] mt-[2vmin]">{texts.screen.nothingOnStage}</h1>
      )}
    </div>
  )
}

function RevealMode({ project }: { project: ProjectTotals | null }) {
  if (!project) {
    return <div className="display text-muted text-[clamp(24px,6vmin,96px)] text-center">{texts.screen.noProjectChosen}</div>
  }
  return (
    <div className="text-center max-w-[92vw]">
      <h2 className="display text-[clamp(24px,6vmin,96px)] leading-[0.95]">{project.name}</h2>
      <div className="text-muted display text-[clamp(16px,3vmin,44px)] mt-[3vmin]">{texts.screen.revealTitle}</div>
      <CountUp
        key={project.id}
        value={project.amount}
        initial={0}
        duration={1800}
        format={formatMoney}
        className="block display text-accent text-[clamp(48px,17vmin,300px)] leading-none mt-[1vmin]"
      />
      <div className="display text-[clamp(20px,4.5vmin,64px)] mt-[3vmin]">{plural(project.investors, texts.screen.investors)}</div>
    </div>
  )
}

function OverviewMode({ rows }: { rows: ProjectTotals[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  if (rows.length === 0) {
    return <div className="display text-muted text-[clamp(24px,6vmin,96px)]">{texts.screen.noOpenProjects}</div>
  }
  return (
    <div className="w-full max-w-[1600px] flex flex-col gap-[2.5vmin]">
      <h1 className="display text-muted text-[clamp(18px,3.5vmin,48px)]">{texts.screen.overviewTitle}</h1>
      {rows.map((r) => (
        <div key={r.id}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="display text-[clamp(18px,4.2vmin,64px)] leading-none truncate">{r.name}</span>
            <CountUp value={r.amount} duration={800} format={formatMoney} className="display text-accent text-[clamp(20px,5vmin,72px)] leading-none shrink-0" />
          </div>
          <div className="h-[clamp(14px,3.5vmin,52px)] bg-line rounded-[0.6vmin] mt-[1vmin] overflow-hidden">
            <div className="h-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
