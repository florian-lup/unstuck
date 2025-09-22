import { useEffect, useState } from 'react'
import { AuthUser } from '../lib/secure-auth-client'
import { useAuth } from '../hooks/use-auth'
import { useAuthFlow } from '../hooks/use-auth-flow'
import { Button } from './ui/button'

interface AuthWindowProps {
  onAuthSuccess: (user: AuthUser) => void
}

export function AuthWindow({ onAuthSuccess }: AuthWindowProps) {
  const { user } = useAuth()
  const { isLoading, deviceAuth, handleLogin, handleSignUp, clearDeviceAuth } = useAuthFlow()
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      onAuthSuccess(user)
    }
  }, [user, onAuthSuccess])

  // Countdown timer for device code expiration - uses Auth0's actual value
  useEffect(() => {
    if (deviceAuth) {
      setTimeLeft(deviceAuth.expires_in) // Use Auth0's actual expiration time
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer)
            clearDeviceAuth()
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    } else {
      setTimeLeft(null) // Clear timer when no deviceAuth
    }
  }, [deviceAuth, clearDeviceAuth]) // Now clearDeviceAuth is stable with useCallback

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (deviceAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Removed logo and title section */}

          {/* Device Code Instructions */}
          <div className="space-y-6 p-6 bg-muted rounded-lg">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {deviceAuth.flow_type === 'login' ? 'Complete Login in Browser' : 'Complete Sign Up in Browser'}
              </h2>
              <p className="text-muted-foreground">
                A browser window has opened. Enter this code to complete your {deviceAuth.flow_type === 'login' ? 'login' : 'sign up'}:
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-background rounded border-2 border-dashed">
                <div className="text-3xl font-mono font-bold tracking-widest text-primary">
                  {deviceAuth.user_code}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Visit: <span className="font-mono text-foreground">{deviceAuth.verification_uri}</span>
              </div>
            </div>

            {timeLeft && (
              <div className="text-sm text-muted-foreground">
                Code expires in: <span className="font-mono text-foreground">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <Button
              onClick={() => {
                // Re-open verification URL in browser
                if (deviceAuth.verification_uri) {
                  window.open(deviceAuth.verification_uri, '_blank')
                }
              }}
              variant="outline"
              className="w-full"
            >
              Open Browser Again
            </Button>
            
            <Button
              onClick={clearDeviceAuth}
              variant="ghost"
              className="w-full"
            >
              Cancel & Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

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
            {isLoading ? 'Starting...' : 'Log In'}
          </Button>
          
          <Button
            onClick={handleSignUp}
            disabled={isLoading}
            variant="outline"
            className="w-36"
          >
            {isLoading ? 'Starting...' : 'Sign Up for Free'}
          </Button>
        </div>
      </div>
    </div>
  )
}