import React from 'react'
import { Mic, Type, Settings, Gamepad2 } from 'lucide-react'
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
      <div 
        className="gaming-nav-container gaming-draggable px-2 py-1.5" 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center">
            <div className="gaming-logo-container">
              <Gamepad2 className="w-3.5 h-3.5 text-white gaming-icon" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 gaming-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Speak Button */}
            <button
              onClick={onSpeakClick}
              className="gaming-button gaming-button-primary flex items-center gap-1 px-2 py-1"
            >
              <Mic className="w-3 h-3 gaming-icon" />
              <span className="text-xs gaming-text-primary">Listen</span>
            </button>

            {/* Text Button */}
            <button
              onClick={onTextClick}
              className="gaming-button gaming-button-primary flex items-center gap-1 px-2 py-1"
            >
              <Type className="w-3 h-3 gaming-icon" />
              <span className="text-xs gaming-text-primary">Ask</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onSettingsClick}
              className="gaming-button p-1"
            >
              <Settings className="w-3 h-3 gaming-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
