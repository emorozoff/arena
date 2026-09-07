// Тёмная карточка с тонкой рамкой: проекты у зрителя, панели админки.
import type { ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-card border border-line rounded-xl p-4 ${className}`}>
      {title && <h2 className="display text-2xl mb-3">{title}</h2>}
      {children}
    </section>
  )
}
