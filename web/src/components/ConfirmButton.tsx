// Кнопка с подтверждением: первое нажатие «взводит», второе выполняет. Через 5 секунд взвод снимается.
import { useEffect, useState } from 'react'
import { texts } from '@shared/texts'
import { Button } from './Button'

export function ConfirmButton({
  label,
  confirmText,
  onConfirm,
  variant = 'danger',
  size = 'md',
  className = '',
  disabled,
}: {
  label: string
  confirmText?: string
  onConfirm: () => void
  variant?: 'danger' | 'ghost' | 'subtle' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Button
        variant={armed ? 'primary' : variant}
        size={size}
        disabled={disabled}
        onClick={() => {
          if (armed) {
            setArmed(false)
            onConfirm()
          } else {
            setArmed(true)
          }
        }}
      >
        {armed ? texts.admin.confirmAgain : label}
      </Button>
      {armed && confirmText && <p className="text-xs text-muted">{confirmText}</p>}
    </div>
  )
}
