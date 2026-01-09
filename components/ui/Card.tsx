import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  interactive?: boolean
}

export function Card({ children, className, onClick, interactive }: CardProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={clsx(
        'card p-4 w-full text-left',
        interactive && 'touch-feedback transition-transform active:scale-[0.98]',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </Component>
  )
}
