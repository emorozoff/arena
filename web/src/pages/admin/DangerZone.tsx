// Опасная зона: сбросы с двойным подтверждением, тестовые проекты.
import { texts } from '@shared/texts'
import { Card } from '../../components/Card'
import { ConfirmButton } from '../../components/ConfirmButton'
import { api } from '../../lib/api'
import type { Apply } from '../AdminPage'

export function DangerZone({ apply, notify }: { apply: Apply; notify: (m: string) => void }) {
  const run = (action: Parameters<Apply>[0]) => {
    void apply(action).then(() => notify(texts.admin.done))
  }
  return (
    <Card title={texts.admin.dangerSection} className="border-accent/60">
      <div className="flex flex-wrap gap-3">
        <ConfirmButton label={texts.admin.resetAllocations} onConfirm={() => run(() => api.adminReset('allocations'))} />
        <ConfirmButton label={texts.admin.resetAll} onConfirm={() => run(() => api.adminReset('all'))} />
        <ConfirmButton variant="subtle" label={texts.admin.seedDemo} confirmText={texts.admin.seedDemoConfirm} onConfirm={() => run(() => api.adminSeedDemo())} />
      </div>
    </Card>
  )
}
