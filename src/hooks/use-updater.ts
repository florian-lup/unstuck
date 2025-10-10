import { useEffect, useState } from 'react'

/**
 * Hook to manage app updates
 * Listens for update availability and provides function to restart and install
 */
export function useUpdater() {
  const [updateReady, setUpdateReady] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string>('')

  useEffect(() => {
    if (!window.electronAPI?.updater) {
      return
    }

    // Listen for update ready event
    window.electronAPI.updater.onUpdateReady((version: string) => {
      setUpdateReady(true)
      setUpdateVersion(version)
    })

    // Cleanup listener on unmount
    return () => {
      window.electronAPI?.updater.removeUpdateReadyListener()
    }
  }, [])

  const restartAndInstall = async () => {
    if (!window.electronAPI?.updater || !updateReady) {
      return
    }

    try {
      await window.electronAPI.updater.restartAndInstall()
    } catch {
      // Failed to restart and install update
    }
  }

  return {
    updateReady,
    updateVersion,
    restartAndInstall,
  }
}

