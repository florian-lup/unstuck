import { Mic, Type, Menu, Settings, Info, Grip, Download, Loader2, PhoneOff } from 'lucide-react'
import React from 'react'
import { Game } from '../lib/games'
import { InteractiveArea } from './interactive-area'
import { SelectGame } from './select-game'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'
import '../overlay.css'

interface NavigationBarProps {
  onSpeakClick?: () => void
  onTextClick?: () => void
  onHistoryClick?: () => void
  onSettingsClick?: () => void
  onInfoClick?: () => void
  onGameSelect?: (game: Game | null) => void
  selectedGame?: Game | null
  onDropdownOpenChange?: (open: boolean) => void
  updateReady?: boolean
  onUpdateClick?: () => void
  voiceState?: {
    isConnected: boolean
    isConnecting: boolean
  }
}

export function NavigationBar({
  onSpeakClick,
  onTextClick,
  onHistoryClick,
  onSettingsClick,
  onInfoClick,
  onGameSelect,
  selectedGame,
  onDropdownOpenChange,
  updateReady,
  onUpdateClick,
  voiceState,
}: NavigationBarProps) {
  const handleVoiceClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onSpeakClick?.()
  }

  const handleTextClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onTextClick?.()
  }

  const handleHistoryClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onHistoryClick?.()
  }

  const handleSettingsClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onSettingsClick?.()
  }

  const handleInfoClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onInfoClick?.()
  }

  const handleGameSelect = (game: Game | null) => {
    // Ensure window stays on top when dropdown is used
    window.electronAPI?.windowInteraction()
    onGameSelect?.(game)
  }

  const handleUpdateClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onUpdateClick?.()
  }

  return (
    <div className="w-full mx-auto">
      <InteractiveArea className="px-2 py-1.5 rounded-3xl border border-overlay-border-primary bg-overlay-bg-primary">
        <div className="flex items-center justify-between gap-2">
          {/* Game Selection Dropdown */}
          <div className="flex-1">
            <SelectGame
              onGameSelect={handleGameSelect}
              selectedGame={selectedGame}
              onDropdownOpenChange={onDropdownOpenChange}
            />
          </div>

          <div className="flex items-center gap-1">
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Voice Button */}
              <Button
                onClick={handleVoiceClick}
                variant="gaming"
                size="sm"
                className={`gap-1 p-1 h-auto w-[65px] ${voiceState?.isConnected ? 'bg-overlay-accent-error hover:bg-overlay-accent-error/80' : ''}`}
                disabled={voiceState?.isConnecting}
              >
                {voiceState?.isConnecting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Wait</span>
                  </>
                ) : voiceState?.isConnected ? (
                  <>
                    <PhoneOff className="w-3 h-3" />
                    <span className="text-xs">Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3" />
                    <span className="text-xs">Voice</span>
                  </>
                )}
              </Button>

              {/* Text Button */}
              <Button
                onClick={handleTextClick}
                variant="gaming"
                size="sm"
                className="gap-1 p-1 h-auto w-[65px]"
              >
                <Type className="w-3 h-3" />
                <span className="text-xs">Chat</span>
              </Button>

              {/* Divider */}
              <div className="w-px h-4 mx-1 bg-overlay-border-primary"></div>

              {/* History Button */}
              <Tooltip content="History">
                <Button
                  onClick={handleHistoryClick}
                  variant="gaming"
                  size="icon"
                  className="p-1 h-auto w-auto"
                >
                  <Menu className="w-3 h-3" />
                </Button>
              </Tooltip>

              {/* Settings Button */}
              <Tooltip content="Settings">
                <Button
                  onClick={handleSettingsClick}
                  variant="gaming"
                  size="icon"
                  className="p-1 h-auto w-auto"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </Tooltip>

              {/* Info Button */}
              <Tooltip content="About">
                <Button
                  onClick={handleInfoClick}
                  variant="gaming"
                  size="icon"
                  className="p-1 h-auto w-auto"
                >
                  <Info className="w-3 h-3" />
                </Button>
              </Tooltip>

              {/* Update Button - Only shown when update is ready */}
              {updateReady && (
                <>
                  {/* Divider */}
                  <div className="w-px h-4 mx-1 bg-overlay-border-primary"></div>

                  <Tooltip content="Restart">
                    <Button
                      onClick={handleUpdateClick}
                      variant="gaming"
                      size="icon"
                      className="p-1 h-auto w-auto animate-pulse"
                    >
                      <Download className="w-3 h-3 text-overlay-accent-primary" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-4 mx-1 bg-overlay-border-primary"></div>

            {/* Move indicator - draggable */}
            <div
              className="overlay-draggable px-2 py-2 -mx-1 -my-1"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              <Grip className="w-3 h-3 text-overlay-text-muted" />
            </div>
          </div>
        </div>
      </InteractiveArea>
    </div>
  )
}
