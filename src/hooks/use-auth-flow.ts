import { useState } from 'react'
import { secureAuth } from '../lib/secure-auth-client'

export function useAuthFlow() {
  const [isLoading, setIsLoading] = useState(false)

  const startOAuthFlow = async (provider: 'google' = 'google') => {
    setIsLoading(true)
    try {
      // Get OAuth URL from secure main process
      const oauthUrl = await secureAuth.getOAuthUrl(provider)
      
      // Open the auth URL in system browser
      window.electronAPI?.windowInteraction()
      await window.ipcRenderer.invoke('open-external-url', oauthUrl)
    } catch (error) {
      console.error('OAuth flow failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = () => startOAuthFlow('google')
  const handleSignUp = () => startOAuthFlow('google')

  return {
    isLoading,
    handleLogin,
    handleSignUp,
    startOAuthFlow,
  }
}
