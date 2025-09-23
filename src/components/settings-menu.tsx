import { LogOut, User } from 'lucide-react'
import { Button } from './ui/button'
import { InteractiveArea } from './interactive-area'
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

  if (!isOpen) return null

  return (
    <InteractiveArea className="w-full">
       <div className="w-full bg-overlay-bg-primary border border-overlay-border-primary rounded-3xl p-4 mt-2">
         {/* Keyboard Shortcuts */}
         <div className="mb-3">
           <h3 className="text-sm font-medium text-overlay-text-primary mb-2">Keyboard shortcuts</h3>
           <div className="flex justify-between items-center">
             <span className="text-xs text-overlay-text-muted">Show / Hide toggle visibility</span>
             <div className="flex items-center gap-1">
               <kbd className="px-2 py-1 text-xs bg-overlay-bg-secondary border border-overlay-border-primary rounded">Shift</kbd>
               <span className="text-xs text-overlay-text-muted">+</span>
               <kbd className="px-2 py-1 text-xs bg-overlay-bg-secondary border border-overlay-border-primary rounded">\</kbd>
             </div>
           </div>
         </div>
         
         {/* Divider */}
         <div className="border-b border-overlay-border-primary mb-3"></div>
         
         {/* Email and Sign Out Button */}
         <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-overlay-bg-secondary rounded-full flex items-center justify-center">
             <User className="w-4 h-4 text-overlay-text-muted" />
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-medium text-overlay-text-primary truncate">
               {user?.email || 'Unknown User'}
             </p>
             <p className="text-xs text-overlay-accent-primary">Signed in</p>
           </div>
           <Button
             onClick={handleLogout}
             variant="gaming"
             size="sm"
             className="justify-center items-center text-sm py-2 px-3 h-auto"
           >
             <span>Sign Out</span>
             <LogOut className="w-4 h-4 ml-2" />
           </Button>
         </div>
       </div>
    </InteractiveArea>
  )
}