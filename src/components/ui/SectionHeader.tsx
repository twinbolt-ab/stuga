interface SectionHeaderProps {
  children: React.ReactNode
}

export function SectionHeader({ children }: SectionHeaderProps) {
  return <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">{children}</h4>
}
