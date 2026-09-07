// Переключатели шоу: регистрация, голосование, что показывает экран (QR или общий расклад).
import { texts } from '@shared/texts'
import type { AdminOverview, ScreenMode } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmButton } from '../../components/ConfirmButton'
import { Label } from '../../components/Field'
import { Toggle } from '../../components/Toggle'
import { api } from '../../lib/api'
import type { Apply } from '../AdminPage'

const modes: ScreenMode[] = ['qr', 'overview']

export function ShowControls({ o, apply }: { o: AdminOverview; apply: Apply }) {
  const show = o.show
  const update = (patch: Partial<AdminOverview['show']>) => void apply(() => api.adminUpdateShow(patch))

  return (
    <Card title={texts.admin.showSection}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label>{texts.admin.registration}</Label>
          <Toggle
            on={show.registration_open}
            onChange={(next) => update({ registration_open: next })}
            labelOn={texts.admin.openState}
            labelOff={texts.admin.closedState}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{texts.admin.voting}</Label>
          {show.voting_open ? (
            <ConfirmButton label={texts.admin.closeVoting} confirmText={texts.admin.closeVotingConfirm} onConfirm={() => update({ voting_open: false })} />
          ) : (
            <ConfirmButton variant="ghost" label={texts.admin.reopenVoting} onConfirm={() => update({ voting_open: true })} />
          )}
        </div>
      </div>

      <div className="mt-5">
        <Label>{texts.admin.screenMode}</Label>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => (
            <Button key={m} variant={show.screen_mode === m ? 'primary' : 'subtle'} onClick={() => update({ screen_mode: m })}>
              {texts.admin.screenModes[m]}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
