import { useEffect } from 'react'

interface UseClickThroughOptions {
  /**
   * CSS selectors for elements that should remain interactive
   * When mouse is over these elements, click-through is disabled
   */
  interactiveSelectors: string[]
}

/**
 * Hook to manage click-through behavior for Electron windows
 * Automatically enables/disables mouse events based on mouse position
 */
export function useClickThrough({
  interactiveSelectors,
}: UseClickThroughOptions) {
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // If no interactive selectors, always enable click-through
      if (interactiveSelectors.length === 0) {
        window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
        return
      }

      // Check if mouse is over any interactive element
      const isInInteractiveArea = interactiveSelectors.some((selector) => {
        const elements = document.querySelectorAll(selector)
        return Array.from(elements).some((element) => {
          const rect = element.getBoundingClientRect()
          return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          )
        })
      })

      // Enable/disable mouse events based on mouse position
      window.electronAPI?.setIgnoreMouseEvents(
        !isInInteractiveArea,
        isInInteractiveArea ? undefined : { forward: true }
      )
    }

    // Set initial state
    if (interactiveSelectors.length === 0) {
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
    }

    document.addEventListener('mousemove', handleGlobalMouseMove, {
      passive: true,
    })
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [interactiveSelectors])

  /**
   * Manually enable mouse events (e.g., on hover)
   */
  const enableMouseEvents = () => {
    window.electronAPI?.setIgnoreMouseEvents(false)
  }

  /**
   * Manually enable click-through
   */
  const enableClickThrough = () => {
    window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
  }

  return {
    enableMouseEvents,
    enableClickThrough,
  }
}
