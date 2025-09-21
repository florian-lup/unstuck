import { useState, useEffect } from 'react'
import { secureAuth, AuthUser } from '../lib/secure-auth-client'
import { Button } from './ui/button'

interface AuthWindowProps {
  onAuthSuccess: (user: AuthUser) => void
}

export function AuthWindow({ onAuthSuccess }: AuthWindowProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [_user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    // Check for existing session
    secureAuth.getSession().then(({ user }) => {
      setUser(user)
      if (user) {
        onAuthSuccess(user)
      }
    })

    // Listen for auth changes via secure IPC
    const { unsubscribe } = secureAuth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null
      setUser(user)
      if (user && event === 'SIGNED_IN') {
        onAuthSuccess(user)
      }
    })

    return () => {
      unsubscribe()
      secureAuth.cleanup()
    }
  }, [onAuthSuccess])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      // Get OAuth URL from secure main process
      const oauthUrl = await secureAuth.getOAuthUrl('google')
      
      // Open the auth URL in system browser
      window.electronAPI?.windowInteraction()
      await window.ipcRenderer.invoke('open-external-url', oauthUrl)
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    setIsLoading(true)
    try {
      // Get OAuth URL from secure main process
      const oauthUrl = await secureAuth.getOAuthUrl('google')
      
      // Open the auth URL in system browser
      window.electronAPI?.windowInteraction()
      await window.ipcRenderer.invoke('open-external-url', oauthUrl)
    } catch (error) {
      console.error('Signup failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16">
              <img
                src="/unstuck-logo.svg"
                alt="Unstuck Logo"
                className="w-full h-full"
              />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Get Unstuck
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Your gaming companion for overcoming challenges
          </p>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-36"
          >
            {isLoading ? 'Connecting...' : 'Log In'}
          </Button>
          
          <Button
            onClick={handleSignUp}
            disabled={isLoading}
            variant="outline"
            className="w-36"
          >
            {isLoading ? 'Connecting...' : 'Sign Up for Free'}
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
