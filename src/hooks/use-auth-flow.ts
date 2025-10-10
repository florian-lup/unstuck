import { useState, useCallback } from 'react'
import { secureAuth } from '../lib/auth-client'

export interface DeviceAuthInfo {
  user_code: string
  verification_uri: string
  expires_in: number
  flow_type: 'login' | 'signup'
}

export function useAuthFlow() {
  const [isLoading, setIsLoading] = useState(false)
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthInfo | null>(null)

  const startAuthFlow = async (flowType: 'login' | 'signup') => {
    setIsLoading(true)
    try {
      // Start Auth0 Device Authorization Flow
      const authInfo = await secureAuth.startAuthFlow()

      setDeviceAuth({
        user_code: authInfo.user_code,
        verification_uri: authInfo.verification_uri,
        expires_in: authInfo.expires_in,
        flow_type: flowType,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearDeviceAuth = useCallback(async () => {
    try {
      // Cancel the polling in the main process
      await secureAuth.cancelDeviceFlow()
    } catch {
      // Failed to cancel device flow
    }
    // Clear the UI state
    setDeviceAuth(null)
  }, [])

  const handleLogin = () => startAuthFlow('login')
  const handleSignUp = () => startAuthFlow('signup')

  return {
    isLoading,
    deviceAuth,
    handleLogin,
    handleSignUp,
    clearDeviceAuth,
  }
}
