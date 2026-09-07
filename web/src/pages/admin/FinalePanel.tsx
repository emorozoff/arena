// Финал (D21): появляется в пульте только после закрытия голосования.
// Каждое нажатие «Показать следующего» добавляет на экран одно место, начиная с последнего.
import { texts } from '@shared/texts'
import type { AdminOverview } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { api } from '../../lib/api'
import type { Apply } from '../AdminPage'

export function FinalePanel({ o, apply }: { o: AdminOverview; apply: Apply }) {
  const total = o.projects.filter((p) => p.is_open).length
  const shown = Math.min(o.show.revealed_count, total)
  // Экран переключается на общий расклад вместе с показом места: ведущему не нужно делать два действия
  const setShown = (n: number) => void apply(() => api.adminUpdateShow({ revealed_count: n, screen_mode: 'overview' }))

  return (
    <Card title={texts.admin.finaleSection} className="border-accent/60">
      <p className="text-sm text-muted">{texts.admin.finaleHint}</p>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Button size="lg" onClick={() => setShown(shown + 1)} disabled={shown >= total}>
          {texts.admin.revealNext}
        </Button>
        <span className="display text-xl">{shown >= total && total > 0 ? texts.admin.revealDone : texts.admin.revealProgress(shown, total)}</span>
        <div className="flex gap-2 ml-auto">
          <Button variant="subtle" size="sm" onClick={() => setShown(0)} disabled={shown === 0}>
            {texts.admin.revealReset}
          </Button>
          <Button variant="subtle" size="sm" onClick={() => setShown(total)} disabled={shown >= total}>
            {texts.admin.revealAll}
          </Button>
        </div>
      </div>
    </Card>
  )
}
