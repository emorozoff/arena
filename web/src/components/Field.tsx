// Поля ввода в тёмной палитре.
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const fieldClass =
  'w-full rounded-lg bg-bg border border-line px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} h-12 ${className}`} {...rest} />
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} h-12 ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} py-2 min-h-28 font-mono text-sm ${className}`} {...rest} />
}

export function Label({ children }: { children: string }) {
  return <span className="block text-sm text-muted mb-1">{children}</span>
}
