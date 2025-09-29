import React, { useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  delay?: number
}

export function Tooltip({ content, children, delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const showTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    const newTimeoutId = setTimeout(() => {
      setIsVisible(true)
    }, delay)
    setTimeoutId(newTimeoutId)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="absolute top-full left-1/2 mt-3 px-3 py-1.5 text-xs font-medium whitespace-nowrap z-50 pointer-events-none select-none bg-overlay-bg-primary text-overlay-text-primary border border-overlay-border-primary rounded-md backdrop-blur-sm transition-opacity duration-200"
          style={{
            transform: 'translateX(-50%)',
            opacity: 1,
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className="absolute bottom-full left-1/2 w-0 h-0"
            style={{
              transform: 'translateX(-50%)',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '5px solid var(--overlay-bg-primary)',
            }}
          />
        </div>
      )}
    </div>
  )
}
