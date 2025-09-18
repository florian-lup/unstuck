import React from 'react'
import { Mic, Type, Settings, Gamepad2 } from 'lucide-react'

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
        className="bg-slate-800/90 backdrop-blur-md border border-slate-700/50 rounded-full px-2 py-1.5 shadow-lg cursor-move" 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-full">
              <Gamepad2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Speak Button */}
            <button
              onClick={onSpeakClick}
              className="flex items-center gap-1 bg-slate-700/50 hover:bg-slate-600/50 text-white px-2 py-1 rounded-full transition-all duration-200 hover:scale-105 border border-slate-600/50"
            >
              <Mic className="w-3 h-3" />
              <span className="text-xs font-medium">Listen</span>
            </button>

            {/* Text Button */}
            <button
              onClick={onTextClick}
              className="flex items-center gap-1 bg-slate-700/50 hover:bg-slate-600/50 text-white px-2 py-1 rounded-full transition-all duration-200 hover:scale-105 border border-slate-600/50"
            >
              <Type className="w-3 h-3" />
              <span className="text-xs font-medium">Ask</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onSettingsClick}
              className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-1 rounded-full transition-all duration-200 hover:scale-105 border border-slate-600/50"
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
