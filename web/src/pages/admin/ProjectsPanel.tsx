// Проекты: добавить, изменить, удалить, порядок, открыть/закрыть, «на сцене».
import { useState, type FormEvent } from 'react'
import { formatMoney } from '@shared/format'
import { texts } from '@shared/texts'
import type { AdminOverview, ProjectTotals } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmButton } from '../../components/ConfirmButton'
import { Input } from '../../components/Field'
import { api } from '../../lib/api'
import type { Apply } from '../AdminPage'

export function ProjectsPanel({ o, apply }: { o: AdminOverview; apply: Apply }) {
  const [name, setName] = useState('')
  const [speaker, setSpeaker] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    void apply(() => api.adminAddProject(name, speaker))
    setName('')
    setSpeaker('')
  }

  return (
    <Card title={texts.admin.projectsSection}>
      {o.projects.length === 0 && <p className="text-muted">{texts.admin.noProjects}</p>}
      <ul className="flex flex-col gap-2">
        {o.projects.map((p, i) => (
          <ProjectRow key={p.id} p={p} isFirst={i === 0} isLast={i === o.projects.length - 1} onStage={o.show.current_project_id === p.id} apply={apply} />
        ))}
      </ul>

      <form onSubmit={add} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mt-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={texts.admin.projectName} />
        <Input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder={texts.admin.projectSpeaker} />
        <Button type="submit" variant="subtle" disabled={!name.trim()}>
          {texts.admin.addProject}
        </Button>
      </form>
    </Card>
  )
}

function ProjectRow({ p, isFirst, isLast, onStage, apply }: { p: ProjectTotals; isFirst: boolean; isLast: boolean; onStage: boolean; apply: Apply }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const [speaker, setSpeaker] = useState(p.speaker)

  const save = () => {
    void apply(() => api.adminEditProject(p.id, { name, speaker }))
    setEditing(false)
  }

  return (
    <li className={`rounded-lg border p-3 flex flex-col gap-2 ${p.is_open ? 'border-accent/60' : 'border-line'}`}>
      <div className="flex items-start gap-3">
        <span className="display text-2xl text-muted w-8 shrink-0">{p.position}</span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              <Input value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="h-10" />
            </div>
          ) : (
            <>
              <div className="display text-xl truncate">{p.name}</div>
              <div className="text-sm text-muted truncate">{p.speaker}</div>
            </>
          )}
          <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span className={p.is_open ? 'text-accent' : 'text-muted'}>{p.is_open ? texts.common.opened : texts.common.closed}</span>
            {onStage && <span className="text-text">● {texts.admin.onStage}</span>}
            {p.is_open && (
              <span className="text-muted money">
                {formatMoney(p.amount)} · {p.investors}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {p.is_open ? (
          <ConfirmButton
            size="sm"
            label={texts.admin.closeProject}
            confirmText={texts.admin.closeProjectConfirm(p.investors, formatMoney(p.amount))}
            onConfirm={() => void apply(() => api.adminCloseProject(p.id))}
          />
        ) : (
          <Button size="sm" onClick={() => void apply(() => api.adminOpenProject(p.id))}>
            {texts.admin.openProject}
          </Button>
        )}
        <Button size="sm" variant={onStage ? 'primary' : 'subtle'} onClick={() => void apply(() => api.adminUpdateShow({ current_project_id: onStage ? null : p.id }))}>
          {texts.admin.onStage}
        </Button>
        <Button size="sm" variant="subtle" disabled={isFirst} onClick={() => void apply(() => api.adminMoveProject(p.id, 'up'))}>
          ↑
        </Button>
        <Button size="sm" variant="subtle" disabled={isLast} onClick={() => void apply(() => api.adminMoveProject(p.id, 'down'))}>
          ↓
        </Button>
        {editing ? (
          <>
            <Button size="sm" onClick={save}>
              {texts.common.save}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setEditing(false)}>
              {texts.common.cancel}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="subtle" onClick={() => setEditing(true)}>
            {texts.common.edit}
          </Button>
        )}
        <ConfirmButton size="sm" variant="ghost" label={texts.common.delete} confirmText={texts.admin.deleteProjectConfirm} onConfirm={() => void apply(() => api.adminDeleteProject(p.id))} className="ml-auto" />
      </div>
    </li>
  )
}
