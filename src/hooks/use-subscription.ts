import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient, SubscriptionStatusResponse } from '../lib/api-client'
import { secureAuth } from '../lib/auth-client'

interface UseSubscriptionReturn {
  subscriptionStatus: SubscriptionStatusResponse | null
  isLoading: boolean
  error: string | null
  isSubscribed: boolean
  handleUpgrade: () => Promise<void>
  handleCancel: () => Promise<void>
  refreshStatus: () => Promise<void>
}

const POLL_INTERVAL = 3000 // Poll every 3 seconds
const MAX_POLL_DURATION = 300000 // Stop polling after 5 minutes

export function useSubscription(): UseSubscriptionReturn {
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollStartTimeRef = useRef<number | null>(null)

  // Determine if user has an active subscription
  // User is subscribed when they have "community" tier with "active" status
  const isSubscribed =
    subscriptionStatus !== null &&
    subscriptionStatus.subscription_tier === 'community' &&
    subscriptionStatus.subscription_status === 'active'

  // Fetch subscription status
  const fetchStatus = useCallback(async () => {
    const accessToken = await secureAuth.getValidAccessToken()
    if (!accessToken) return

    try {
      const status = await apiClient.getSubscriptionStatus(accessToken)
      // Log subscription status for debugging
      // eslint-disable-next-line no-console
      console.log('Subscription tier:', status.subscription_tier)
      // eslint-disable-next-line no-console
      console.log('Subscription status:', status.subscription_status)
      setSubscriptionStatus(status)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch subscription status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    }
  }, [])

  // Public method to refresh status
  const refreshStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetchStatus()
    } finally {
      setIsLoading(false)
    }
  }, [fetchStatus])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    pollStartTimeRef.current = null
  }, [])

  // Start polling for subscription status changes
  const startPolling = useCallback(() => {
    // Don't start polling if already polling
    if (pollIntervalRef.current) return

    pollStartTimeRef.current = Date.now()

    pollIntervalRef.current = setInterval(() => {
      void (async () => {
        // Check if we've exceeded max poll duration
        if (
          pollStartTimeRef.current &&
          Date.now() - pollStartTimeRef.current > MAX_POLL_DURATION
        ) {
          stopPolling()
          return
        }

        // Fetch status
        try {
          const accessToken = await secureAuth.getValidAccessToken()
          if (!accessToken) {
            stopPolling()
            return
          }

          const status = await apiClient.getSubscriptionStatus(accessToken)
          setSubscriptionStatus(status)

          // If subscription is active with community tier, stop polling
          if (
            status.subscription_tier === 'community' &&
            status.subscription_status === 'active'
          ) {
            stopPolling()
          }
        } catch (err) {
          console.error('Error polling subscription status:', err)
        }
      })()
    }, POLL_INTERVAL)
  }, [stopPolling])

  // Handle upgrade button click
  const handleUpgrade = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const accessToken = await secureAuth.getValidAccessToken()
      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      // Create checkout session
      const checkoutData = await apiClient.createCheckoutSession(accessToken)

      // Open checkout URL in system browser
      const result = await window.electronAPI?.openExternalUrl(
        checkoutData.checkout_url
      )

      if (!result?.success) {
        throw new Error(result?.error ?? 'Failed to open checkout')
      }

      // Start polling for subscription status
      startPolling()
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      setError(err instanceof Error ? err.message : 'Failed to upgrade')
    } finally {
      setIsLoading(false)
    }
  }, [startPolling])

  // Handle cancel button click
  const handleCancel = useCallback(async () => {
    // Confirm cancellation
    const confirmed = confirm(
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your billing period.'
    )

    if (!confirmed) return

    setIsLoading(true)
    setError(null)

    try {
      const accessToken = await secureAuth.getValidAccessToken()
      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const result = await apiClient.cancelSubscription(accessToken)

      if (result.success) {
        // Refresh status after cancellation
        await fetchStatus()
      } else {
        throw new Error(result.message || 'Failed to cancel subscription')
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setIsLoading(false)
    }
  }, [fetchStatus])

  // Fetch initial status when component mounts
  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    subscriptionStatus,
    isLoading,
    error,
    isSubscribed,
    handleUpgrade,
    handleCancel,
    refreshStatus,
  }
}
