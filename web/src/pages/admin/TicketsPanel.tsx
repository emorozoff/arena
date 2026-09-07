// Зрители и билеты: режим, формат, генерация, импорт, список с кнопкой «Отвязать».
import { useState } from 'react'
import { formatMoney } from '@shared/format'
import { texts } from '@shared/texts'
import type { AdminOverview, AdminTicket, TicketChars, TicketMode } from '@shared/types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input, Label, Select, Textarea } from '../../components/Field'
import { api } from '../../lib/api'
import { useLive } from '../../lib/useLive'
import type { Apply } from '../AdminPage'

const PAGE = 30

export function TicketsPanel({ o, apply, notify }: { o: AdminOverview; apply: Apply; notify: (m: string) => void }) {
  const tickets = useLive(() => api.adminTickets(), ['show', 'totals'])
  const [count, setCount] = useState(120)
  const [output, setOutput] = useState('')
  const [importText, setImportText] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const show = o.show

  const update = (patch: Partial<AdminOverview['show']>) => void apply(() => api.adminUpdateShow(patch))

  const generate = async () => {
    const codes = await api.adminGenerateTickets(count)
    setOutput(codes.join('\n'))
    notify(texts.admin.generated(codes.length))
    void tickets.refresh()
  }

  const exportAll = () => {
    setOutput((tickets.data ?? []).map((t) => t.number).join('\n'))
  }

  const copy = async () => {
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
    <Card title={texts.admin.guestsSection}>
      <div className="grid sm:grid-cols-3 gap-3">
        <label>
          <Label>{texts.admin.ticketMode}</Label>
          <Select value={show.ticket_mode} onChange={(e) => update({ ticket_mode: e.target.value as TicketMode })}>
            <option value="free">{texts.admin.ticketModes.free}</option>
            <option value="whitelist">{texts.admin.ticketModes.whitelist}</option>
          </Select>
        </label>
        <label>
          <Label>{`${texts.admin.ticketFormat}: ${texts.admin.ticketLength}`}</Label>
          <Input type="number" min={3} max={10} value={show.ticket_length} onChange={(e) => update({ ticket_length: Math.max(3, Math.min(10, Number(e.target.value) || 4)) })} />
        </label>
        <label>
          <Label>{texts.admin.ticketCharsLabel}</Label>
          <Select value={show.ticket_chars} onChange={(e) => update({ ticket_chars: e.target.value as TicketChars })}>
            <option value="digits">{texts.admin.ticketCharsOptions.digits}</option>
            <option value="letters_digits">{texts.admin.ticketCharsOptions.letters_digits}</option>
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2 mt-4">
        <label className="w-28">
          <Label>{texts.admin.generateCount}</Label>
          <Input type="number" min={1} max={2000} value={count} onChange={(e) => setCount(Number(e.target.value) || 0)} />
        </label>
        <Button variant="subtle" onClick={() => void generate()} disabled={count < 1}>
          {texts.admin.generateTickets}
        </Button>
        <Button variant="subtle" onClick={exportAll} disabled={!tickets.data?.length}>
          {texts.admin.exportTickets}
        </Button>
        <span className="text-sm text-muted ml-auto">
          {o.tickets_in_list} {texts.admin.ticketsInList}
        </span>
      </div>
      {output && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea value={output} readOnly />
          <Button variant="subtle" size="sm" onClick={() => void copy()} className="self-start">
            {texts.common.copy}
          </Button>
        </div>
      )}

      <div className="mt-4">
        <Label>{texts.admin.importTickets}</Label>
        <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={texts.admin.importPlaceholder} />
        <Button variant="subtle" size="sm" className="mt-2" disabled={!importText.trim()} onClick={() => void doImport()}>
          {texts.admin.importButton}
        </Button>
      </div>

      <div className="mt-5">
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
    </Card>
  )
}

function TicketRow({ t, onRelease }: { t: AdminTicket; onRelease: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="display text-lg tracking-widest w-20">{t.number}</span>
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
