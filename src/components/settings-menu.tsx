import { LogOut, User, Pencil, Power, ArrowUp, ArrowDown } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useAutoLaunch } from '../hooks/use-auto-launch'
import { AuthUser } from '../lib/auth-client'
import { InteractiveArea } from './interactive-area'
import { Button } from './ui/button'
import { Slider } from './ui/slider'

interface SettingsMenuProps {
  user: AuthUser | null
  isOpen: boolean
  onLogout: () => void
  onClose: () => void
  currentKeybind?: string
  onKeybindChange?: (keybind: string) => void
  currentChatKeybind?: string
  onChatKeybindChange?: (keybind: string) => void
  currentHistoryKeybind?: string
  onHistoryKeybindChange?: (keybind: string) => void
  currentSettingsKeybind?: string
  onSettingsKeybindChange?: (keybind: string) => void
  currentNewChatKeybind?: string
  onNewChatKeybindChange?: (keybind: string) => void
  currentVoiceChatKeybind?: string
  onVoiceChatKeybindChange?: (keybind: string) => void
  currentTransparency?: number
  onTransparencyChange?: (transparency: number) => void
  isSubscribed: boolean
  subscriptionLoading: boolean
  onUpgrade: () => void
  onCancel: () => void
}

export function SettingsMenu({
  user,
  isOpen,
  onLogout,
  onClose,
  currentKeybind = 'Shift+\\',
  onKeybindChange,
  currentChatKeybind = '',
  onChatKeybindChange,
  currentHistoryKeybind = '',
  onHistoryKeybindChange,
  currentSettingsKeybind = '',
  onSettingsKeybindChange,
  currentNewChatKeybind = '',
  onNewChatKeybindChange,
  currentVoiceChatKeybind = '',
  onVoiceChatKeybindChange,
  currentTransparency = 90,
  onTransparencyChange,
  isSubscribed,
  subscriptionLoading,
  onUpgrade,
  onCancel,
}: SettingsMenuProps) {
  const [isCapturingKeybind, setIsCapturingKeybind] = useState(false)
  const [isCapturingChatKeybind, setIsCapturingChatKeybind] = useState(false)
  const [isCapturingHistoryKeybind, setIsCapturingHistoryKeybind] =
    useState(false)
  const [isCapturingSettingsKeybind, setIsCapturingSettingsKeybind] =
    useState(false)
  const [isCapturingNewChatKeybind, setIsCapturingNewChatKeybind] =
    useState(false)
  const [isCapturingVoiceChatKeybind, setIsCapturingVoiceChatKeybind] =
    useState(false)
  const { isEnabled: autoLaunchEnabled, toggleAutoLaunch } = useAutoLaunch()

  const handleLogout = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onLogout()
    onClose()
  }

  const handleKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
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
    },
    [isCapturingKeybind, onKeybindChange]
  )

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

  const handleChatKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingChatKeybind) return

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
        setIsCapturingChatKeybind(false)
        onChatKeybindChange?.(newKeybind)
      }
    },
    [isCapturingChatKeybind, onChatKeybindChange]
  )

  const startCapturingChatKeybind = () => {
    setIsCapturingChatKeybind(true)
  }

  const cancelCapturingChat = () => {
    setIsCapturingChatKeybind(false)
  }

  const resetChatToDefault = () => {
    const defaultChatKeybind = ''
    setIsCapturingChatKeybind(false)
    onChatKeybindChange?.(defaultChatKeybind)
  }

  const handleHistoryKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingHistoryKeybind) return

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
        setIsCapturingHistoryKeybind(false)
        onHistoryKeybindChange?.(newKeybind)
      }
    },
    [isCapturingHistoryKeybind, onHistoryKeybindChange]
  )

  const startCapturingHistoryKeybind = () => {
    setIsCapturingHistoryKeybind(true)
  }

  const cancelCapturingHistory = () => {
    setIsCapturingHistoryKeybind(false)
  }

  const resetHistoryToDefault = () => {
    const defaultHistoryKeybind = ''
    setIsCapturingHistoryKeybind(false)
    onHistoryKeybindChange?.(defaultHistoryKeybind)
  }

  const handleSettingsKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingSettingsKeybind) return

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
        setIsCapturingSettingsKeybind(false)
        onSettingsKeybindChange?.(newKeybind)
      }
    },
    [isCapturingSettingsKeybind, onSettingsKeybindChange]
  )

  const startCapturingSettingsKeybind = () => {
    setIsCapturingSettingsKeybind(true)
  }

  const cancelCapturingSettings = () => {
    setIsCapturingSettingsKeybind(false)
  }

  const resetSettingsToDefault = () => {
    const defaultSettingsKeybind = ''
    setIsCapturingSettingsKeybind(false)
    onSettingsKeybindChange?.(defaultSettingsKeybind)
  }

  const handleNewChatKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingNewChatKeybind) return

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
        setIsCapturingNewChatKeybind(false)
        onNewChatKeybindChange?.(newKeybind)
      }
    },
    [isCapturingNewChatKeybind, onNewChatKeybindChange]
  )

  const startCapturingNewChatKeybind = () => {
    setIsCapturingNewChatKeybind(true)
  }

  const cancelCapturingNewChat = () => {
    setIsCapturingNewChatKeybind(false)
  }

  const resetNewChatToDefault = () => {
    const defaultNewChatKeybind = ''
    setIsCapturingNewChatKeybind(false)
    onNewChatKeybindChange?.(defaultNewChatKeybind)
  }

  const handleVoiceChatKeybindCapture = useCallback(
    (event: KeyboardEvent) => {
      if (!isCapturingVoiceChatKeybind) return

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
        setIsCapturingVoiceChatKeybind(false)
        onVoiceChatKeybindChange?.(newKeybind)
      }
    },
    [isCapturingVoiceChatKeybind, onVoiceChatKeybindChange]
  )

  const startCapturingVoiceChatKeybind = () => {
    setIsCapturingVoiceChatKeybind(true)
  }

  const cancelCapturingVoiceChat = () => {
    setIsCapturingVoiceChatKeybind(false)
  }

  const resetVoiceChatToDefault = () => {
    const defaultVoiceChatKeybind = ''
    setIsCapturingVoiceChatKeybind(false)
    onVoiceChatKeybindChange?.(defaultVoiceChatKeybind)
  }

  // Add and remove event listener for key capture
  useEffect(() => {
    if (isCapturingKeybind) {
      document.addEventListener('keydown', handleKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleKeybindCapture)
      }
    }
  }, [isCapturingKeybind, handleKeybindCapture])

  // Add and remove event listener for chat keybind capture
  useEffect(() => {
    if (isCapturingChatKeybind) {
      document.addEventListener('keydown', handleChatKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleChatKeybindCapture)
      }
    }
  }, [isCapturingChatKeybind, handleChatKeybindCapture])

  // Add and remove event listener for history keybind capture
  useEffect(() => {
    if (isCapturingHistoryKeybind) {
      document.addEventListener('keydown', handleHistoryKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleHistoryKeybindCapture)
      }
    }
  }, [isCapturingHistoryKeybind, handleHistoryKeybindCapture])

  // Add and remove event listener for settings keybind capture
  useEffect(() => {
    if (isCapturingSettingsKeybind) {
      document.addEventListener('keydown', handleSettingsKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleSettingsKeybindCapture)
      }
    }
  }, [isCapturingSettingsKeybind, handleSettingsKeybindCapture])

  // Add and remove event listener for new chat keybind capture
  useEffect(() => {
    if (isCapturingNewChatKeybind) {
      document.addEventListener('keydown', handleNewChatKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleNewChatKeybindCapture)
      }
    }
  }, [isCapturingNewChatKeybind, handleNewChatKeybindCapture])

  // Add and remove event listener for voice chat keybind capture
  useEffect(() => {
    if (isCapturingVoiceChatKeybind) {
      document.addEventListener('keydown', handleVoiceChatKeybindCapture)
      return () => {
        document.removeEventListener('keydown', handleVoiceChatKeybindCapture)
      }
    }
  }, [isCapturingVoiceChatKeybind, handleVoiceChatKeybindCapture])

  // Format keybind for display
  const formatKeybindForDisplay = (keybind: string) => {
    if (!keybind || keybind === '') {
      return (
        <span className="text-xs text-overlay-text-muted italic">Not set</span>
      )
    }
    return keybind.split('+').map((key, index, array) => (
      <div key={key} className="flex items-center">
        <kbd className="px-2 py-1 text-xs border border-overlay-border-primary rounded text-overlay-text-primary">
          {key === '\\' ? '\\' : key}
        </kbd>
        {index < array.length - 1 && (
          <span className="text-xs text-overlay-text-muted mx-1">+</span>
        )}
      </div>
    ))
  }

  if (!isOpen) return null

  return (
    <InteractiveArea className="w-full">
      <div className="w-full bg-overlay-bg-primary border border-overlay-border-primary rounded-3xl p-4 mt-2">
        {/* Keyboard Shortcuts */}
        <div className="mb-3">
          <h3 className="text-sm font-medium text-overlay-text-primary mb-2">
            Keyboard shortcuts
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Show / Hide toggle visibility
              </span>
              <div className="flex items-center gap-2">
                {isCapturingKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
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
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Open / Close chat
              </span>
              <div className="flex items-center gap-2">
                {isCapturingChatKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
                    <div className="flex gap-1">
                      <Button
                        onClick={resetChatToDefault}
                        variant="gaming"
                        size="sm"
                        className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={cancelCapturingChat}
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
                      {formatKeybindForDisplay(currentChatKeybind)}
                    </div>
                    <Button
                      onClick={startCapturingChatKeybind}
                      variant="gaming"
                      size="icon"
                      className="px-2 py-1 h-auto hover:!border-transparent"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Open / Close conversation history
              </span>
              <div className="flex items-center gap-2">
                {isCapturingHistoryKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
                    <div className="flex gap-1">
                      <Button
                        onClick={resetHistoryToDefault}
                        variant="gaming"
                        size="sm"
                        className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={cancelCapturingHistory}
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
                      {formatKeybindForDisplay(currentHistoryKeybind)}
                    </div>
                    <Button
                      onClick={startCapturingHistoryKeybind}
                      variant="gaming"
                      size="icon"
                      className="px-2 py-1 h-auto hover:!border-transparent"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Open / Close settings
              </span>
              <div className="flex items-center gap-2">
                {isCapturingSettingsKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
                    <div className="flex gap-1">
                      <Button
                        onClick={resetSettingsToDefault}
                        variant="gaming"
                        size="sm"
                        className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={cancelCapturingSettings}
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
                      {formatKeybindForDisplay(currentSettingsKeybind)}
                    </div>
                    <Button
                      onClick={startCapturingSettingsKeybind}
                      variant="gaming"
                      size="icon"
                      className="px-2 py-1 h-auto hover:!border-transparent"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Start new chat
              </span>
              <div className="flex items-center gap-2">
                {isCapturingNewChatKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
                    <div className="flex gap-1">
                      <Button
                        onClick={resetNewChatToDefault}
                        variant="gaming"
                        size="sm"
                        className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={cancelCapturingNewChat}
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
                      {formatKeybindForDisplay(currentNewChatKeybind)}
                    </div>
                    <Button
                      onClick={startCapturingNewChatKeybind}
                      variant="gaming"
                      size="icon"
                      className="px-2 py-1 h-auto hover:!border-transparent"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Start / Stop voice chat
              </span>
              <div className="flex items-center gap-2">
                {isCapturingVoiceChatKeybind ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay-accent-primary">
                      Press keys...
                    </span>
                    <div className="flex gap-1">
                      <Button
                        onClick={resetVoiceChatToDefault}
                        variant="gaming"
                        size="sm"
                        className="px-2 py-1 text-xs h-auto border border-overlay-border-primary"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={cancelCapturingVoiceChat}
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
                      {formatKeybindForDisplay(currentVoiceChatKeybind)}
                    </div>
                    <Button
                      onClick={startCapturingVoiceChatKeybind}
                      variant="gaming"
                      size="icon"
                      className="px-2 py-1 h-auto hover:!border-transparent"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transparency Settings */}
        <div className="mb-3">
          <h3 className="text-sm font-medium text-overlay-text-primary mb-2">
            Appearance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-overlay-text-muted">
                Overlay transparency
              </span>
              <span className="text-xs text-overlay-accent-primary font-mono">
                {currentTransparency}%
              </span>
            </div>
            <div className="px-1">
              <Slider
                min={10}
                max={100}
                step={5}
                value={[currentTransparency]}
                onValueChange={(value) => onTransparencyChange?.(value[0])}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-xs text-overlay-text-muted px-1">
              <span>More transparent</span>
              <span>More opaque</span>
            </div>
          </div>
        </div>

        {/* Auto-launch Settings */}
        <div className="mb-3">
          <h3 className="text-sm font-medium text-overlay-text-primary mb-2">
            Startup
          </h3>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Power
                className={`w-4 h-4 transition-colors duration-200 ${
                  autoLaunchEnabled
                    ? 'text-overlay-accent-primary'
                    : 'text-overlay-text-muted'
                }`}
              />
              <span className="text-xs text-overlay-text-muted">
                Launch Unstuck when computer starts
              </span>
            </div>
            <Button
              onClick={toggleAutoLaunch}
              variant="gaming"
              size="sm"
              className="px-3 py-1 text-xs h-auto border border-overlay-border-primary hover:border-overlay-accent-primary"
            >
              {autoLaunchEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-overlay-border-primary mb-3"></div>

        {/* Email and Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-overlay-bg-secondary rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-overlay-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-overlay-text-primary truncate">
              {user?.email ?? 'Unknown User'}
            </p>
            <p className="text-xs text-overlay-accent-primary">Signed in</p>
          </div>
          <div className="flex gap-2">
            {isSubscribed ? (
              <Button
                onClick={() => {
                  window.electronAPI?.windowInteraction()
                  onCancel()
                }}
                variant="gaming"
                size="sm"
                disabled={subscriptionLoading}
                className="justify-center items-center text-xs py-2 px-3 h-auto border border-overlay-accent-error bg-overlay-accent-error/10 hover:bg-overlay-accent-error/20 hover:border-overlay-accent-error disabled:opacity-50"
              >
                <ArrowDown className="mr-2 w-3.5 h-3.5" />
                <span>
                  {subscriptionLoading ? 'Processing...' : 'Downgrade'}
                </span>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  window.electronAPI?.windowInteraction()
                  onUpgrade()
                }}
                variant="gaming"
                size="sm"
                disabled={subscriptionLoading}
                className="justify-center items-center text-xs py-2 px-3 h-auto border border-overlay-accent-success bg-overlay-accent-success/10 hover:bg-overlay-accent-success/20 hover:border-overlay-accent-success disabled:opacity-50"
              >
                <ArrowUp className="mr-2 w-3.5 h-3.5" />
                <span>{subscriptionLoading ? 'Loading...' : 'Upgrade'}</span>
              </Button>
            )}
            <Button
              onClick={handleLogout}
              variant="gaming"
              size="sm"
              className="justify-center items-center text-xs py-2 px-3 h-auto border border-overlay-border-primary"
            >
              <span>Sign Out</span>
              <LogOut className="ml-2 w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </InteractiveArea>
  )
}
