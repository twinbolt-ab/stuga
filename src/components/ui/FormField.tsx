import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  hint?: string
  children: ReactNode
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
