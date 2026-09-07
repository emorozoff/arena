// Итоги на проектор: рейтинг по сумме, пошаговое раскрытие снизу вверх, победитель последним.
// Цифры — снимок на момент открытия страницы: они не «плывут», пока ведущий раскрывает места.
// Снимок обновляется сам только когда голосование закрывают, и по кнопке «Обновить».
import { useCallback, useEffect, useState } from 'react'
import { formatMoney, plural } from '@shared/format'
import { texts } from '@shared/texts'
import type { ResultsRow, ResultsState } from '@shared/types'
import { Button } from '../components/Button'
import { CountUp } from '../components/CountUp'
import { api } from '../lib/api'

export function ResultsPage() {
  const [s, setS] = useState<ResultsState | null>(null)
  const [revealed, setRevealed] = useState(0)
  const count = s?.rows.length ?? 0

  const load = useCallback(async (force: boolean) => {
    try {
      const fresh = await api.getResults()
      setS((prev) => (force || !prev || prev.voting_open !== fresh.voting_open ? fresh : prev))
    } catch {
      // нет связи — оставляем последний снимок
    }
  }, [])

  useEffect(() => {
    void load(true)
    return api.subscribe('show', () => void load(false))
  }, [load])

  const next = useCallback(() => setRevealed((r) => Math.min(count, r + 1)), [count])
  const back = useCallback(() => setRevealed((r) => Math.max(0, r - 1)), [])
  const reset = useCallback(() => setRevealed(0), [])
  const all = useCallback(() => setRevealed(count), [count])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') back()
      else if (e.key.toLowerCase() === 'r') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, reset])

  return (
    <div className="min-h-[calc(100dvh-var(--demo-bar,0px))] bg-bg text-text flex flex-col p-[4vmin] pb-[22vmin] sm:pb-[16vmin]">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="display text-[clamp(24px,5vmin,80px)]">{texts.results.title}</h1>
        <span className="text-muted text-[clamp(11px,1.6vmin,20px)] hidden sm:block">{texts.results.hint}</span>
      </div>
      {s?.voting_open && <p className="text-accent text-[clamp(12px,2vmin,28px)] mt-1">{texts.results.votingStillOpen}</p>}

      <div className="flex flex-col gap-[1.5vmin] mt-[3vmin]">
        {s?.rows.map((row, i) => (
          <Row key={row.id} row={row} visible={i >= count - revealed} winner={i === 0} />
        ))}
      </div>

      <div className="fixed bottom-[3vmin] left-[3vmin] right-[3vmin] flex flex-wrap justify-end gap-2">
        <Button variant="subtle" size="sm" onClick={() => void load(true)}>
          {texts.results.refresh}
        </Button>
        <Button variant="subtle" size="sm" onClick={reset}>
          {texts.results.reset}
        </Button>
        <Button variant="subtle" size="sm" onClick={all}>
          {texts.results.showAll}
        </Button>
        <Button size="md" onClick={next} disabled={revealed >= count}>
          {texts.results.next}
        </Button>
      </div>
    </div>
  )
}

function Row({ row, visible, winner }: { row: ResultsRow; visible: boolean; winner: boolean }) {
  if (!visible) {
    return (
      <div className="flex items-center gap-[2vmin] bg-card border border-line rounded-[1.2vmin] px-[2.5vmin] py-[1.8vmin]">
        <span className="display text-muted text-[clamp(20px,4vmin,64px)] w-[6vmin] shrink-0">{row.rank}</span>
        <span className="display text-line text-[clamp(20px,4vmin,64px)]">???</span>
      </div>
    )
  }
  const isWinner = winner && visible
  return (
    <div className={`rounded-[1.2vmin] px-[2.5vmin] py-[1.8vmin] border ${isWinner ? 'bg-accent border-accent text-white' : 'bg-card border-line'}`}>
      <div className="flex flex-wrap items-end gap-x-[3vmin] gap-y-[1vmin]">
        <span className={`display text-[clamp(20px,4vmin,64px)] w-[6vmin] shrink-0 self-start ${isWinner ? 'text-white' : 'text-muted'}`}>{row.rank}</span>
        <div className="flex-1 min-w-[55%]">
          {isWinner && <div className="display text-[clamp(12px,2vmin,28px)] opacity-90">{texts.results.winner}</div>}
          <div className={`display leading-[0.95] break-words ${isWinner ? 'text-[clamp(28px,6vmin,96px)]' : 'text-[clamp(20px,4vmin,64px)]'}`}>{row.name}</div>
          <div className={`text-[clamp(11px,1.8vmin,24px)] mt-[0.8vmin] ${isWinner ? 'text-white/85' : 'text-muted'}`}>
            {row.speaker} · {plural(row.investors, texts.screen.investors)} · {texts.results.averageCheck} {formatMoney(row.average)}
          </div>
        </div>
        <CountUp
          value={row.amount}
          initial={0}
          duration={1400}
          format={formatMoney}
          className={`display leading-none ml-auto ${isWinner ? 'text-white text-[clamp(32px,7vmin,120px)]' : 'text-accent text-[clamp(24px,4.5vmin,72px)]'}`}
        />
      </div>
    </div>
  )
}
