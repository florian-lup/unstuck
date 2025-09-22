import { LogOut, User } from 'lucide-react'
import { Button } from './ui/button'
import { InteractiveArea } from './interactive-area'
import { AuthUser } from '../lib/auth-client'

interface SettingsMenuProps {
  user: AuthUser | null
  onLogout: () => void
  onClose: () => void
}

export function SettingsMenu({ user, onLogout, onClose }: SettingsMenuProps) {
  const handleLogout = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onLogout()
    onClose()
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-64 z-50">
      <InteractiveArea className="bg-overlay-bg-primary border border-overlay-border-primary rounded-2xl p-3 shadow-lg">
        <div className="space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3 pb-3 border-b border-overlay-border-primary">
            <div className="w-8 h-8 bg-overlay-bg-secondary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-overlay-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-overlay-text-primary truncate">
                {user?.email || 'Unknown User'}
              </p>
              <p className="text-xs text-overlay-text-muted">Signed in</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-1">
            <Button
              onClick={handleLogout}
              variant="gaming"
              size="sm"
              className="w-full justify-start gap-2 text-sm py-2 h-auto"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </InteractiveArea>
    </div>
  )
}