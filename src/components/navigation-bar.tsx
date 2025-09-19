import React from 'react'
import { Mic, Type, Settings, Move } from 'lucide-react'
import { Button } from './ui/button'
import { SelectGame } from './select-game'
import '../App.css'

interface Game {
  id: string
  name: string
  icon?: React.ReactNode
}

interface NavigationBarProps {
  onSpeakClick?: () => void
  onTextClick?: () => void
  onSettingsClick?: () => void
  onGameSelect?: (game: Game) => void
}

export function NavigationBar({ 
  onSpeakClick, 
  onTextClick, 
  onSettingsClick,
  onGameSelect
}: NavigationBarProps) {
  return (
    <div className="w-full mx-auto">
      <div className="px-2 py-1.5 rounded-[2rem] border border-gaming-border-primary bg-gaming-bg-primary backdrop-blur-[12px]">
        <div className="flex items-center justify-between gap-2">
          {/* Game Selection Dropdown */}
          <div className="flex-1">
            <SelectGame onGameSelect={onGameSelect} />
          </div>
          
          <div className="flex items-center gap-1">
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
            {/* Speak Button */}
            <Button
              onClick={onSpeakClick}
              variant="gaming"
              size="sm"
              className="gap-1 px-2 py-1 h-auto rounded-3xl"
            >
              <Mic className="w-3 h-3" />
              <span className="text-xs">Listen</span>
            </Button>

            {/* Text Button */}
            <Button
              onClick={onTextClick}
              variant="gaming"
              size="sm"
              className="gap-1 px-2 py-1 h-auto rounded-3xl"
            >
              <Type className="w-3 h-3" />
              <span className="text-xs">Ask</span>
            </Button>

            {/* Settings Button */}
            <Button
              onClick={onSettingsClick}
              variant="gaming"
              size="icon"
              className="p-1 h-auto w-auto rounded-3xl"
            >
              <Settings className="w-3 h-3" />
            </Button>
            </div>

            {/* Divider */}
            <div className="w-px h-4 mx-1 bg-gaming-border-primary"></div>

            {/* Move indicator - draggable */}
            <div
              className="gaming-draggable cursor-move"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
              <Move className="w-3 h-3 text-gaming-text-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
