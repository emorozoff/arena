// Число, которое плавно докручивается до нового значения, а не прыгает.
import { useEffect, useRef, useState } from 'react'

export function CountUp({
  value,
  initial,
  duration = 1200,
  format,
  className = '',
}: {
  value: number
  initial?: number
  duration?: number
  format: (n: number) => string
  className?: string
}) {
  const [shown, setShown] = useState(initial ?? value)
  const shownRef = useRef(initial ?? value)

  useEffect(() => {
    const from = shownRef.current
    const to = value
    if (from === to) return
    const start = performance.now()
    let frame = 0
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = Math.round(from + (to - from) * eased)
      shownRef.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className={`money ${className}`}>{format(shown)}</span>
}
