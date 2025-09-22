import { LogOut, User } from 'lucide-react'
import { Button } from './ui/button'
import { DropdownContent } from './ui/dropdown'
import { AuthUser } from '../lib/auth-client'

interface SettingsMenuProps {
  user: AuthUser | null
  isOpen: boolean
  onLogout: () => void
  onClose: () => void
}

export function SettingsMenu({ user, isOpen, onLogout, onClose }: SettingsMenuProps) {
  const handleLogout = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onLogout()
    onClose()
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-64 z-50">
      <DropdownContent 
        isOpen={isOpen} 
        close={onClose} 
        maxWidth="max-w-[256px]" 
        className="p-3 shadow-lg"
      >
        {/* User Info */}
        <div className="flex items-center gap-3 pb-3 border-b border-overlay-border-primary mb-3">
          <div className="w-8 h-8 bg-overlay-bg-secondary rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-overlay-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-overlay-text-primary truncate">
              {user?.email || 'Unknown User'}
            </p>
            <p className="text-xs text-overlay-accent-primary">Signed in</p>
          </div>
        </div>

        {/* Actions */}
        <Button
          onClick={handleLogout}
          variant="gaming"
          size="sm"
          className="w-full justify-between items-center text-sm py-2 h-auto"
        >
          <span>Sign Out</span>
          <LogOut className="w-4 h-4" />
        </Button>
      </DropdownContent>
    </div>
  )
}