// Переключатель «открыто / закрыто».
export function Toggle({
  on,
  onChange,
  labelOn,
  labelOff,
  disabled,
}: {
  on: boolean
  onChange: (next: boolean) => void
  labelOn: string
  labelOff: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-3 h-11 pl-1 pr-4 rounded-full border transition-colors disabled:opacity-50 ${on ? 'border-accent' : 'border-line'}`}
    >
      <span className={`relative w-12 h-7 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
      <span className="font-semibold">{on ? labelOn : labelOff}</span>
    </button>
  )
}
