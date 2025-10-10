import { useState, useEffect, useCallback } from 'react'

// Cache the auto-launch status to prevent flickering on component remounts
let cachedAutoLaunchStatus: boolean | null = null

export function useAutoLaunch() {
  const [isEnabled, setIsEnabled] = useState<boolean>(
    () => cachedAutoLaunchStatus ?? false
  )
  const [isLoading, setIsLoading] = useState<boolean>(
    () => cachedAutoLaunchStatus === null
  )
  const [error, setError] = useState<string | null>(null)

  // Load the current auto-launch status
  const loadAutoLaunchStatus = useCallback(async () => {
    try {
      // If we have cached status and this is initial load, don't show loading
      if (cachedAutoLaunchStatus === null) {
        setIsLoading(true)
      }
      setError(null)
      const status = await window.electronAPI?.autoLaunch.getStatus()
      const finalStatus = status ?? false
      setIsEnabled(finalStatus)
      cachedAutoLaunchStatus = finalStatus // Cache the result
    } catch {
      setError('Failed to load auto-launch status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Toggle auto-launch on/off
  const toggleAutoLaunch = useCallback(async () => {
    try {
      setError(null)
      const success = await window.electronAPI?.autoLaunch.toggle()
      if (success) {
        // Immediately update local state and cache for instant feedback
        const newState = !isEnabled
        setIsEnabled(newState)
        cachedAutoLaunchStatus = newState
        // Also reload to ensure we're in sync with system
        void loadAutoLaunchStatus()
      } else {
        setError('Failed to toggle auto-launch')
      }
    } catch {
      setError('Failed to toggle auto-launch')
    }
  }, [isEnabled, loadAutoLaunchStatus])

  // Enable auto-launch
  const enableAutoLaunch = useCallback(async () => {
    try {
      setError(null)
      const success = await window.electronAPI?.autoLaunch.enable()
      if (success) {
        setIsEnabled(true)
        cachedAutoLaunchStatus = true
      } else {
        setError('Failed to enable auto-launch')
      }
    } catch {
      setError('Failed to enable auto-launch')
    }
  }, [])

  // Disable auto-launch
  const disableAutoLaunch = useCallback(async () => {
    try {
      setError(null)
      const success = await window.electronAPI?.autoLaunch.disable()
      if (success) {
        setIsEnabled(false)
        cachedAutoLaunchStatus = false
      } else {
        setError('Failed to disable auto-launch')
      }
    } catch {
      setError('Failed to disable auto-launch')
    }
  }, [])

  // Load status on mount only if not cached
  useEffect(() => {
    if (cachedAutoLaunchStatus === null) {
      void loadAutoLaunchStatus()
    }
  }, [loadAutoLaunchStatus])

  return {
    isEnabled,
    isLoading,
    error,
    toggleAutoLaunch,
    enableAutoLaunch,
    disableAutoLaunch,
    refresh: loadAutoLaunchStatus,
  }
}
