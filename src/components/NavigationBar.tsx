import React from 'react'
import { Mic, Type, Settings, Move } from 'lucide-react'
import { Button } from './ui/button'
import '../App.css'

interface NavigationBarProps {
  onSpeakClick?: () => void
  onTextClick?: () => void
  onSettingsClick?: () => void
}

export function NavigationBar({ 
  onSpeakClick, 
  onTextClick, 
  onSettingsClick 
}: NavigationBarProps) {
  return (
    <div className="w-full mx-auto">
      <div className="gaming-nav-container px-2 py-1.5">
        <div className="flex items-center justify-end gap-1">
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
          <div className="w-px h-4 bg-gray-600 mx-1"></div>

          {/* Move indicator - draggable */}
          <div
            className="gaming-draggable cursor-move"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <Move className="w-3 h-3 text-gray-400 gaming-icon" />
          </div>
        </div>
      </div>
    </div>
  )
}
