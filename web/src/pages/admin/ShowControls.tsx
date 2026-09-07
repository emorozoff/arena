// Переключатели шоу: регистрация, голосование, режим экрана, проект на сцене и для раскрытия.
import { texts } from '@shared/texts'
import type { AdminOverview, ScreenMode } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmButton } from '../../components/ConfirmButton'
import { Label, Select } from '../../components/Field'
import { Toggle } from '../../components/Toggle'
import { api } from '../../lib/api'
import type { Apply } from '../AdminPage'

const modes: ScreenMode[] = ['qr', 'current', 'reveal', 'overview']

export function ShowControls({ o, apply }: { o: AdminOverview; apply: Apply }) {
  const show = o.show
  const update = (patch: Partial<AdminOverview['show']>) => void apply(() => api.adminUpdateShow(patch))

  return (
    <Card title={texts.admin.showSection}>
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {modes.map((m) => (
            <Button key={m} variant={show.screen_mode === m ? 'primary' : 'subtle'} onClick={() => update({ screen_mode: m })}>
              {texts.admin.screenModes[m]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label>
          <Label>{texts.admin.currentProject}</Label>
          <Select value={show.current_project_id ?? ''} onChange={(e) => update({ current_project_id: e.target.value || null })}>
            <option value="">{texts.admin.noneSelected}</option>
            {o.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.position}. {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <Label>{texts.admin.revealProject}</Label>
          <Select value={show.reveal_project_id ?? ''} onChange={(e) => update({ reveal_project_id: e.target.value || null })}>
            <option value="">{texts.admin.noneSelected}</option>
            {o.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.position}. {p.name} {p.is_open ? '' : `(${texts.common.closed})`}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </Card>
  )
}
