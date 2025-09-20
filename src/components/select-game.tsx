import { Gamepad2 } from 'lucide-react'
import { Dropdown } from './ui/dropdown'
import {
  Game,
  getActiveGames,
  getGameDisplayNameWithVersion,
} from '../lib/games'
import '../App.css'

interface SelectGameProps {
  onGameSelect?: (game: Game) => void
  selectedGame?: Game | null
  className?: string
  onDropdownOpenChange?: (open: boolean) => void
}

export function SelectGame({
  onGameSelect,
  selectedGame,
  className = '',
  onDropdownOpenChange,
}: SelectGameProps) {
  const games = getActiveGames()

  const handleGameSelect = (game: Game) => {
    onGameSelect?.(game)
  }

  return (
    <Dropdown className={className} onOpenChange={onDropdownOpenChange}>
      <Dropdown.Trigger>
        {selectedGame ? (
          <>
            <Gamepad2 className="w-4 h-4" />
            <span className="text-xs">{selectedGame.displayName}</span>
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
            onSelect={() => {
              handleGameSelect(game)
            }}
          >
            {getGameDisplayNameWithVersion(game)}
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  )
}
