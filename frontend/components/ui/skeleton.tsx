import * as React from "react"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

function Skeleton({ className, variant = 'rectangular', width, height, ...props }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-slate-200"
  
  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-md",
  }

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
      style={style}
      {...props}
    />
  )
}

// Card skeleton
function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-3">
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
        <div className="flex gap-2 mt-4">
          <Skeleton variant="rectangular" width={80} height={32} />
          <Skeleton variant="rectangular" width={100} height={32} />
        </div>
      </div>
    </div>
  )
}

// Table row skeleton
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-200">
      <Skeleton variant="rectangular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <Skeleton variant="rectangular" width={100} height={36} />
    </div>
  )
}

// Statistics card skeleton
function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <Skeleton variant="text" width="50%" height={14} className="mb-3" />
      <Skeleton variant="text" width="80%" height={36} className="mb-2" />
      <Skeleton variant="text" width="60%" height={12} />
    </div>
  )
}

export { Skeleton, CardSkeleton, TableRowSkeleton, StatCardSkeleton }
