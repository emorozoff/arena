// Кнопка. Варианты: primary — оранжевая (главное действие), ghost — с рамкой,
// danger — оранжевая рамка (опасные действия), subtle — тёмная плашка.
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
  ghost: 'border border-line text-text bg-transparent hover:bg-card active:bg-card',
  danger: 'border border-accent text-accent bg-transparent hover:bg-accent/10 active:bg-accent/10',
  subtle: 'bg-card text-text border border-line hover:border-muted active:border-muted',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-12 px-4 text-base',
  lg: 'h-14 px-5 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg select-none transition-colors disabled:opacity-35 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  )
}
