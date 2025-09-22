import { useState, useEffect, useCallback } from 'react'

interface UseCountdownTimerProps {
  /**
   * Initial time in seconds
   */
  initialTime?: number
  /**
   * Callback to execute when timer reaches zero
   */
  onComplete?: () => void
  /**
   * Whether the timer should start automatically when initialTime is provided
   */
  autoStart?: boolean
}

/**
 * Custom hook for managing countdown timers
 * Useful for device code expiration, session timeouts, etc.
 */
export function useCountdownTimer({ 
  initialTime, 
  onComplete, 
  autoStart = true 
}: UseCountdownTimerProps = {}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const startTimer = useCallback((duration: number) => {
    setTimeLeft(duration)
  }, [])

  const clearTimer = useCallback(() => {
    setTimeLeft(null)
  }, [])

  // Auto-start timer when initialTime changes
  useEffect(() => {
    if (initialTime && autoStart) {
      startTimer(initialTime)
    } else if (!initialTime) {
      clearTimer()
    }
  }, [initialTime, autoStart, startTimer, clearTimer])

  // Countdown logic
  useEffect(() => {
    if (timeLeft === null) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          onComplete?.()
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, onComplete])

  return {
    timeLeft,
    startTimer,
    clearTimer,
    isActive: timeLeft !== null
  }
}
