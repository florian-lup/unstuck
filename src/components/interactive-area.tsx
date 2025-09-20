import React from 'react'

interface InteractiveAreaProps {
  children: React.ReactNode
  className?: string
  as?: keyof React.JSX.IntrinsicElements
  [key: string]: unknown // Allow any other props to be passed through
}

/**
 * Wrapper component that marks an area as interactive for click-through functionality
 * Any element wrapped in this component will remain clickable when the window has click-through enabled
 */
export function InteractiveArea({
  children,
  className = '',
  as: Component = 'div',
  ...props
}: InteractiveAreaProps) {
  return (
    <Component className={className} data-interactive-area {...props}>
      {children}
    </Component>
  )
}
