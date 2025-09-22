import { useEffect } from 'react'
import { AuthUser } from '../lib/secure-auth-client'
import { useAuth } from '../hooks/use-auth'
import { useAuthFlow } from '../hooks/use-auth-flow'
import { Button } from './ui/button'

interface AuthWindowProps {
  onAuthSuccess: (user: AuthUser) => void
}

export function AuthWindow({ onAuthSuccess }: AuthWindowProps) {
  const { user } = useAuth()
  const { isLoading, handleLogin, handleSignUp } = useAuthFlow()

  useEffect(() => {
    if (user) {
      onAuthSuccess(user)
    }
  }, [user, onAuthSuccess])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-10 h-10">
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
            Ask questions without ever leaving the game screen
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
      </div>
    </div>
  )
}
