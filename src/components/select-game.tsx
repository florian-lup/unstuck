import { Gamepad2, Plus, Trash2, X } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Game,
  getActiveGames,
  getGameDisplayNameWithVersion,
  addCustomGame,
  deleteGame,
} from '../lib/games'
import { Button } from './ui/button'
import { Dropdown } from './ui/dropdown'
import { Input } from './ui/input'
import '../overlay.css'

interface SelectGameProps {
  onGameSelect?: (game: Game | null) => void
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
  const [games, setGames] = useState<Game[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newGameVersion, setNewGameVersion] = useState('')
  const closeDropdownRef = useRef<(() => void) | null>(null)

  const loadGames = useCallback(() => {
    setGames(getActiveGames())
  }, [])

  // Load games on mount and when storage changes
  useEffect(() => {
    loadGames()
    
    // Listen for storage changes (if multiple windows/tabs)
    const handleStorageChange = () => {
      loadGames()
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => { window.removeEventListener('storage', handleStorageChange); }
  }, [loadGames])

  const handleGameSelect = (game: Game) => {
    onGameSelect?.(game)
    // Close dropdown using the stored close function
    closeDropdownRef.current?.()
  }

  const handleAddGame = () => {
    if (!newGameName.trim()) return
    
    addCustomGame(newGameName.trim(), newGameVersion.trim())
    setNewGameName('')
    setNewGameVersion('')
    setShowAddForm(false)
    loadGames() // Reload games list
  }

  const handleDeleteGame = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent dropdown item selection
    
    deleteGame(gameId)
    
    // If deleted game was selected, clear selection
    if (selectedGame?.id === gameId) {
      onGameSelect?.(null)
    }
    
    loadGames() // Reload games list
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setNewGameName('')
    setNewGameVersion('')
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

      <Dropdown.Content className="min-w-[280px]" noScroll={true}>
        {({ close }: { close?: () => void }) => {
          // Store the close function in ref so we can call it from handleGameSelect
          closeDropdownRef.current = close ?? null
          
          return (
        <div className="flex flex-col max-h-[450px]">
          {/* Game List - Scrollable */}
          <div className="overflow-y-auto max-h-[300px] overlay-scrollbar pr-2">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between group px-2 py-1.5 rounded"
              >
              <button
                onClick={() => { handleGameSelect(game); }}
                className={`flex-1 px-3 py-1 text-left flex items-center gap-2 text-xs text-overlay-text-primary hover:text-overlay-accent-primary transition-all duration-150 focus:outline-none rounded-3xl ${
                  selectedGame?.id === game.id ? 'text-overlay-accent-primary' : ''
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                    selectedGame?.id === game.id ? 'bg-overlay-accent-primary' : 'bg-overlay-text-muted'
                  }`}
                />
                <div className="flex items-center justify-between w-full">
                  <span>{getGameDisplayNameWithVersion(game)}</span>
                </div>
              </button>
              <button
                onClick={(e) => { handleDeleteGame(game.id, e); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all ml-1"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-2" />

          {/* Add Game Form or Button - Fixed at Bottom */}
          <div>
            {showAddForm ? (
              <div className="p-3 bg-gray-800/50 rounded space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-300">
                    Add New Game
                  </span>
                  <button
                    onClick={handleCancelAdd}
                    className="p-0.5 hover:bg-gray-700 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Game Name"
                  value={newGameName}
                  onChange={(e) => { setNewGameName(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddGame()
                    if (e.key === 'Escape') handleCancelAdd()
                  }}
                  className="text-xs h-8"
                  autoFocus
                />
                <Input
                  type="text"
                  placeholder="Version (optional)"
                  value={newGameVersion}
                  onChange={(e) => { setNewGameVersion(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddGame()
                    if (e.key === 'Escape') handleCancelAdd()
                  }}
                  className="text-xs h-8"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddGame}
                    disabled={!newGameName.trim()}
                    className="flex-1 h-8 text-xs"
                  >
                    Add Game
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowAddForm(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Game</span>
              </button>
            )}
          </div>
        </div>
          )
        }}
      </Dropdown.Content>
    </Dropdown>
  )
}
