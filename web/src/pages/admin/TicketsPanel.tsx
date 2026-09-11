// Билеты: свёрнутый блок внизу пульта. Нужен до шоу (создать коды) и если зритель потерял доступ (отвязать).
// Формат номера (длина, символы) задаётся в shared/config.ts, в админке не меняется (решение D18).
import { useState } from 'react'
import { config } from '@shared/config'
import { formatMoney } from '@shared/format'
import { texts } from '@shared/texts'
import type { AdminOverview, AdminTicket, TicketMode } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input, Label, Select, Textarea } from '../../components/Field'
import { api } from '../../lib/api'
import { useLive } from '../../lib/useLive'
import type { Apply } from '../AdminPage'

const PAGE = 30

export function TicketsPanel({ o, apply, notify }: { o: AdminOverview; apply: Apply; notify: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="display text-2xl">{texts.admin.ticketsSection}</h2>
          <p className="text-xs text-muted mt-1">{texts.admin.ticketsWhy}</p>
        </div>
        <Button variant="subtle" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? texts.admin.ticketsHide : texts.admin.ticketsShow}
        </Button>
      </div>
      {open && <TicketsBody o={o} apply={apply} notify={notify} />}
    </Card>
  )
}

function TicketsBody({ o, apply, notify }: { o: AdminOverview; apply: Apply; notify: (m: string) => void }) {
  const tickets = useLive(() => api.adminTickets(), ['show', 'totals'])
  const [count, setCount] = useState(120)
  const [output, setOutput] = useState('')
  const [importText, setImportText] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const generate = async () => {
    const codes = await api.adminGenerateTickets(count)
    setOutput(codes.join('\n'))
    notify(texts.admin.generated(codes.length))
    void tickets.refresh()
  }

  const copyAll = async () => {
    const text = (tickets.data ?? []).map((t) => t.number).join('\n')
    setOutput(text)
    try {
      await navigator.clipboard.writeText(text)
      notify(texts.common.copied)
    } catch {
      // буфер обмена недоступен — номера видны в поле ниже
    }
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output)
      notify(texts.common.copied)
    } catch {
      notify(texts.errors.unknown)
    }
  }

  const doImport = async () => {
    const added = await api.adminImportTickets(importText)
    setImportText('')
    notify(texts.admin.imported(added))
    void tickets.refresh()
  }

  const release = async (number: string) => {
    await api.adminReleaseTicket(number)
    notify(texts.admin.done)
    void tickets.refresh()
  }

  const list = (tickets.data ?? []).filter((t) => !search || t.number.includes(search.trim().toUpperCase()))

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label>
          <Label>{texts.admin.ticketMode}</Label>
          <Select value={o.show.ticket_mode} onChange={(e) => void apply(() => api.adminUpdateShow({ ticket_mode: e.target.value as TicketMode }))}>
            <option value="free">{texts.admin.ticketModes.free}</option>
            <option value="whitelist">{texts.admin.ticketModes.whitelist}</option>
          </Select>
        </label>
        <div className="flex items-end gap-2">
          <label className="w-24">
            <Label>{texts.admin.generateCount}</Label>
            <Input type="number" min={1} max={2000} value={count} onChange={(e) => setCount(Number(e.target.value) || 0)} />
          </label>
          <Button variant="subtle" onClick={() => void generate()} disabled={count < 1}>
            {texts.admin.generateTickets}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="sm" onClick={() => void copyAll()} disabled={!tickets.data?.length}>
          {texts.admin.exportTickets}
        </Button>
        <span className="text-sm text-muted">
          {o.tickets_in_list} {texts.admin.ticketsInList}
        </span>
      </div>
      {output && (
        <div className="flex flex-col gap-2">
          <Textarea value={output} readOnly />
          <Button variant="subtle" size="sm" onClick={() => void copyOutput()} className="self-start">
            {texts.common.copy}
          </Button>
        </div>
      )}

      <div>
        <Label>{texts.admin.importTickets}</Label>
        <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={texts.admin.importPlaceholder} />
        <Button variant="subtle" size="sm" className="mt-2" disabled={!importText.trim()} onClick={() => void doImport()}>
          {texts.admin.importButton}
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="display text-xl">{texts.admin.ticketsList}</span>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={texts.admin.ticketSearch} className="h-10 max-w-48" />
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {list.slice(0, limit).map((t) => (
            <TicketRow key={t.number} t={t} onRelease={() => void release(t.number)} />
          ))}
        </ul>
        {list.length > limit && (
          <Button variant="subtle" size="sm" className="mt-2" onClick={() => setLimit((l) => l + PAGE)}>
            {texts.admin.showMore} ({list.length - limit})
          </Button>
        )}
      </div>
    </div>
  )
}

function TicketRow({ t, onRelease }: { t: AdminTicket; onRelease: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="display text-lg tracking-wider">{t.number}</span>
      {t.sector && <span className="text-xs text-accent border border-accent/60 rounded px-1">{config.sectorLabels[t.sector] ?? t.sector}</span>}
      <span className={t.status === 'claimed' ? 'text-accent' : 'text-muted'}>{texts.admin.ticketStatus[t.status]}</span>
      {t.is_bot && <span className="text-xs text-muted border border-line rounded px-1">{texts.admin.bot}</span>}
      <span className="money text-muted ml-auto">{t.status === 'free' ? '' : `${formatMoney(t.allocated)} / ${formatMoney(t.budget)}`}</span>
      {t.status === 'claimed' && (
        <Button size="sm" variant="ghost" onClick={onRelease}>
          {texts.admin.releaseTicket}
        </Button>
      )}
    </li>
  )
}
