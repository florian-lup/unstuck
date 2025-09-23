import React from 'react'
import { Mic, Type, Search, Settings, Grip } from 'lucide-react'
import { Button } from './ui/button'
import { SelectGame } from './select-game'
import { InteractiveArea } from './interactive-area'
import { Game } from '../lib/games'
import '../overlay.css'

interface NavigationBarProps {
  onSpeakClick?: () => void
  onTextClick?: () => void
  onSearchClick?: () => void
  onSettingsClick?: () => void
  onGameSelect?: (game: Game) => void
  selectedGame?: Game | null
  onDropdownOpenChange?: (open: boolean) => void
}

export function NavigationBar({
  onSpeakClick,
  onTextClick,
  onSearchClick,
  onSettingsClick,
  onGameSelect,
  selectedGame,
  onDropdownOpenChange,
}: NavigationBarProps) {
  const handleSpeakClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onSpeakClick?.()
  }

  const handleTextClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onTextClick?.()
  }

  const handleSearchClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onSearchClick?.()
  }

  const handleSettingsClick = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onSettingsClick?.()
  }

  const handleGameSelect = (game: Game) => {
    // Ensure window stays on top when dropdown is used
    window.electronAPI?.windowInteraction()
    onGameSelect?.(game)
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
              {/* Speak Button */}
              <Button
                onClick={handleSpeakClick}
                variant="gaming"
                size="sm"
                className="gap-1 p-1 h-auto"
              >
                <Mic className="w-3 h-3" />
                <span className="text-xs">Speak</span>
              </Button>

              {/* Text Button */}
              <Button
                onClick={handleTextClick}
                variant="gaming"
                size="sm"
                className="gap-1 p-1 h-auto"
              >
                <Type className="w-3 h-3" />
                <span className="text-xs">Ask</span>
              </Button>

              {/* Search Button */}
              <Button
                onClick={handleSearchClick}
                variant="gaming"
                size="sm"
                className="gap-1 p-1 h-auto"
              >
                <Search className="w-3 h-3" />
                <span className="text-xs">Search</span>
              </Button>

              {/* Settings Button */}
              <Button
                onClick={handleSettingsClick}
                variant="gaming"
                size="icon"
                className="p-1 h-auto w-auto"
              >
                <Settings className="w-3 h-3" />
              </Button>
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
