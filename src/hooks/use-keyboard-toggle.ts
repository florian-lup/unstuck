import { useState, useEffect } from 'react'

interface UseKeyboardToggleOptions {
  initialValue?: boolean
  key: string
  modifiers?: {
    shift?: boolean
    ctrl?: boolean
    alt?: boolean
    meta?: boolean
  }
}

export function useKeyboardToggle({
  initialValue = true,
  key,
  modifiers = {}
}: UseKeyboardToggleOptions) {
  const [isVisible, setIsVisible] = useState(initialValue)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the key matches
      if (event.code !== key) return

      // Check modifiers
      if (modifiers.shift !== undefined && event.shiftKey !== modifiers.shift) return
      if (modifiers.ctrl !== undefined && event.ctrlKey !== modifiers.ctrl) return
      if (modifiers.alt !== undefined && event.altKey !== modifiers.alt) return
      if (modifiers.meta !== undefined && event.metaKey !== modifiers.meta) return

      // Prevent default behavior and toggle visibility
      event.preventDefault()
      setIsVisible(prev => !prev)
    }

    const handleElectronToggle = () => {
      setIsVisible(prev => !prev)
    }

    // Add event listener with capture: true to intercept before input elements
    document.addEventListener('keydown', handleKeyDown, true)

    // Listen for Electron global shortcut if available
    if (window.electronAPI?.onNavigationBarToggle) {
      window.electronAPI.onNavigationBarToggle(handleElectronToggle)
    }

    // Cleanup function to remove event listeners
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (window.electronAPI?.removeNavigationBarToggleListener) {
        window.electronAPI.removeNavigationBarToggleListener()
      }
    }
  }, [key, modifiers.shift, modifiers.ctrl, modifiers.alt, modifiers.meta])

  return {
    isVisible,
    toggle: () => setIsVisible(prev => !prev),
    setVisible: setIsVisible
  }
}
