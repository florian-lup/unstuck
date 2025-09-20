import React, { useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { Dropdown } from './ui/dropdown'
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
  { id: 'overwatch', name: 'Overwatch 2' },
]

interface SelectGameProps {
  onGameSelect?: (game: Game) => void
  className?: string
}

export function SelectGame({ onGameSelect, className = '' }: SelectGameProps) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    onGameSelect?.(game)
  }

  return (
    <Dropdown className={className}>
      <Dropdown.Trigger>
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
      </Dropdown.Trigger>

      <Dropdown.Content>
        {games.map((game) => (
          <Dropdown.Item
            key={game.id}
            selected={selectedGame?.id === game.id}
            onSelect={() => handleGameSelect(game)}
          >
            {game.name}
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  )
}
