'use client'

import React, { useState, useRef, useEffect } from 'react'

interface ResizablePanelsProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number // percentage (0-100)
  minLeftWidth?: number
  maxLeftWidth?: number
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 40,
  minLeftWidth = 25,
  maxLeftWidth = 60,
}: ResizablePanelsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      // Constrain within minimum and maximum width
      const clampedWidth = Math.min(Math.max(newLeftWidth, minLeftWidth), maxLeftWidth)
      setLeftWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, minLeftWidth, maxLeftWidth])

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-white">
      {/* Left panel */}
      <div
        style={{ width: `${leftWidth}%` }}
        className="h-full flex flex-col overflow-hidden border-r border-gray-200"
      >
        {leftPanel}
      </div>

      {/* Drag separator - more obvious style */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className={`w-1.5 flex-shrink-0 cursor-col-resize relative transition-colors ${
          isDragging ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'
        }`}
      >
        {/* Central grip indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col gap-1">
            <div className="w-1 h-1 rounded-full bg-gray-500" />
            <div className="w-1 h-1 rounded-full bg-gray-500" />
            <div className="w-1 h-1 rounded-full bg-gray-500" />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{ width: `${100 - leftWidth}%` }}
        className="h-full flex flex-col overflow-hidden"
      >
        {rightPanel}
      </div>
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  icon?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="font-medium text-sm text-gray-900">{title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}
