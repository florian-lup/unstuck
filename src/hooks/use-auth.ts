import { useState, useEffect } from 'react'
import { secureAuth, AuthUser, AuthSession } from '../lib/secure-auth-client'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSecureStorage, setIsSecureStorage] = useState(false)

  useEffect(() => {
    // Check if secure storage is being used
    secureAuth.isSecureStorage().then(setIsSecureStorage)

    // Get initial session
    secureAuth.getSession().then(({ user, session }) => {
      setUser(user)
      setSession(session)
      setLoading(false)
    }).catch((error) => {
      console.error('Failed to get initial session:', error)
      setLoading(false)
    })

    // Listen for auth changes via secure IPC
    const { unsubscribe } = secureAuth.onAuthStateChange(
      async (event, session, error) => {
        console.log('Auth0 event:', event, session ? 'Session exists' : 'No session', error ? `Error: ${error}` : '')
        
        if (event === 'ERROR' && error) {
          console.error('Authentication error:', error)
        }
        
        setUser(session?.user ?? null)
        setSession(session)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      await secureAuth.signOut()
      console.log('Successfully signed out')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const getSecurityStatus = async () => {
    const isSecure = await secureAuth.isSecureStorage()
    return {
      storageMethod: isSecure ? 'keychain' : 'localStorage' as const,
      isSecure,
      platform: typeof window !== 'undefined' && window.navigator ? window.navigator.platform : 'unknown',
      keychainType: getKeychainType(),
    }
  }

  return {
    user,
    session,
    loading,
    isSecureStorage,
    signOut,
    getSecurityStatus,
  }
}

function getKeychainType(): string {
  if (typeof window === 'undefined' || !window.navigator) {
    return 'unknown'
  }
  
  const platform = window.navigator.platform.toLowerCase()
  if (platform.includes('win')) {
    return 'Windows Credential Manager'
  } else if (platform.includes('mac')) {
    return 'macOS Keychain'
  } else if (platform.includes('linux')) {
    return 'Linux libsecret'
  }
  return 'unknown'
}
