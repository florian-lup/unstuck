import { LogOut, User, Edit } from 'lucide-react'
import { Button } from './ui/button'
import { InteractiveArea } from './interactive-area'
import { AuthUser } from '../lib/auth-client'
import { useState, useEffect } from 'react'

interface SettingsMenuProps {
  user: AuthUser | null
  isOpen: boolean
  onLogout: () => void
  onClose: () => void
  currentKeybind?: string
  onKeybindChange?: (keybind: string) => void
}

export function SettingsMenu({ user, isOpen, onLogout, onClose, currentKeybind = 'Shift+\\', onKeybindChange }: SettingsMenuProps) {
  const [isCapturingKeybind, setIsCapturingKeybind] = useState(false)

  const handleLogout = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onLogout()
    onClose()
  }

  const handleKeybindCapture = (event: KeyboardEvent) => {
    if (!isCapturingKeybind) return
    
    event.preventDefault()
    event.stopPropagation()
    
    const keys = []
    if (event.ctrlKey) keys.push('Ctrl')
    if (event.altKey) keys.push('Alt')
    if (event.shiftKey) keys.push('Shift')
    if (event.metaKey) keys.push('Meta')
    
    // Don't capture modifier keys alone
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      keys.push(event.key)
      const newKeybind = keys.join('+')
      setIsCapturingKeybind(false)
      onKeybindChange?.(newKeybind)
    }
  }

  const startCapturingKeybind = () => {
    setIsCapturingKeybind(true)
  }

  const cancelCapturing = () => {
    setIsCapturingKeybind(false)
  }

  const resetToDefault = () => {
    const defaultKeybind = 'Shift+\\'
    setIsCapturingKeybind(false)
    onKeybindChange?.(defaultKeybind)
  }

  // Add and remove event listener for key capture
  useEffect(() => {
    if (isCapturingKeybind) {
      document.addEventListener('keydown', handleKeybindCapture)
      return () => document.removeEventListener('keydown', handleKeybindCapture)
    }
  }, [isCapturingKeybind])

  // Format keybind for display
  const formatKeybindForDisplay = (keybind: string) => {
    return keybind.split('+').map((key, index, array) => (
      <div key={key} className="flex items-center">
        <kbd className="px-2 py-1 text-xs border border-overlay-border-primary rounded">
          {key === '\\' ? '\\' : key}
        </kbd>
        {index < array.length - 1 && <span className="text-xs text-overlay-text-muted mx-1">+</span>}
      </div>
    ))
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
             <div className="flex items-center gap-2">
               {isCapturingKeybind ? (
                 <div className="flex items-center gap-2">
                   <span className="text-xs text-overlay-accent-primary">Press keys...</span>
                   <div className="flex gap-1">
                     <Button
                       onClick={resetToDefault}
                       variant="gaming"
                       size="sm"
                       className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                     >
                       Reset
                     </Button>
                     <Button
                       onClick={cancelCapturing}
                       variant="gaming"
                       size="sm"
                       className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                     >
                       Cancel
                     </Button>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center">
                     {formatKeybindForDisplay(currentKeybind)}
                   </div>
                   <Button
                     onClick={startCapturingKeybind}
                     variant="gaming"
                     size="icon"
                     className="px-2 py-1 h-auto hover:!border-transparent"
                   >
                     <Edit className="w-3 h-3" />
                   </Button>
                 </>
               )}
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