import * as React from "react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'error' | 'warning' | 'success' | 'info'
  title?: string
}

function Alert({ className, variant = 'default', title, children, ...props }: AlertProps) {
  const variantStyles = {
    default: 'bg-slate-50 text-slate-900 border-slate-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    success: 'bg-green-50 text-green-900 border-green-200',
    info: 'bg-blue-50 text-blue-900 border-blue-200',
  }

  const iconMap = {
    default: '📋',
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️',
  }

  return (
    <div
      className={`rounded-lg border p-4 ${variantStyles[variant]} ${className || ''}`}
      role="alert"
      {...props}
    >
      <div className="flex gap-3">
        <span className="text-xl">{iconMap[variant]}</span>
        <div className="flex-1">
          {title && (
            <h5 className="mb-1 font-semibold leading-none tracking-tight">
              {title}
            </h5>
          )}
          <div className="text-sm opacity-90">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`text-sm ${className || ''}`} {...props} />
  )
}

export { Alert, AlertDescription }
