import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 text-slate-900 hover:bg-slate-100',
  }

  return (
    <div
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variantStyles[variant]} ${className || ''}`}
      {...props}
    />
  )
}

export { Badge }
