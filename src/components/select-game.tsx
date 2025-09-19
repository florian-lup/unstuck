import React, { useState } from 'react'
import { ChevronDown, Gamepad2 } from 'lucide-react'
import { useDropdown } from '../hooks/use-dropdown'
import '../App.css'

interface Game {
  id: string
  name: string
  icon?: React.ReactNode
}

const games: Game[] = [
  { id: 'valorant', name: 'Valorant' },
  { id: 'csgo', name: 'CS2' },
  { id: 'lol', name: 'League of Legends 11.2' },
  { id: 'apex', name: 'Apex Legends' },
  { id: 'overwatch', name: 'Overwatch 2' }
]

interface SelectGameProps {
  onGameSelect?: (game: Game) => void
  className?: string
}

export function SelectGame({ onGameSelect, className = '' }: SelectGameProps) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const { isOpen, toggle, close, dropdownRef } = useDropdown<HTMLDivElement>()

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    close()
    onGameSelect?.(game)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        onClick={toggle}
        className="border border-gaming-border-primary rounded-3xl px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gaming-text-primary hover:border-gaming-accent-primary transition-all duration-200 w-full justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {selectedGame ? (
            <>
              <Gamepad2 className="w-4 h-4" />
              <span className="text-xs">{selectedGame.name}</span>
            </>
          ) : (
            <>
              <Gamepad2 className="w-4 h-4" />
              <span className="text-xs">Select Game</span>
            </>
          )}
        </div>
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full max-w-[200px] z-50">
          <div className="bg-gaming-bg-primary border border-gaming-border-primary rounded-2xl p-1">
            <div className="py-1" role="listbox">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs text-gaming-text-primary hover:bg-gaming-bg-hover hover:text-gaming-accent-primary transition-all duration-150 focus:outline-none focus:bg-gaming-bg-hover focus:text-gaming-accent-primary rounded-3xl"
                  role="option"
                  aria-selected={selectedGame?.id === game.id}
                >
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                    selectedGame?.id === game.id 
                      ? 'bg-gaming-accent-primary' 
                      : 'bg-gaming-text-muted'
                  }`} />
                  <span>{game.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
