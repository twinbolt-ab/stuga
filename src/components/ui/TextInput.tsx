interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'password'
}

export function TextInput({ value, onChange, placeholder, type = 'text' }: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
      }}
      placeholder={placeholder}
      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
    />
  )
}
