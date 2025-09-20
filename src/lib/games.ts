import React from 'react'

export interface Game {
  id: string
  name: string
  displayName: string
  version?: string
  icon?: React.ReactNode
  category?: 'fps' | 'moba' | 'battle-royale' | 'strategy' | 'other'
  isActive?: boolean
}

// Central games database
export const GAMES: Game[] = [
  {
    id: 'valorant',
    name: 'valorant',
    displayName: 'Valorant',
    version: '8.11',
    category: 'fps',
    isActive: true,
  },
  {
    id: 'cs2',
    name: 'cs2',
    displayName: 'CS2',
    category: 'fps',
    isActive: true,
  },
  {
    id: 'lol',
    name: 'lol',
    displayName: 'League of Legends',
    version: '14.18',
    category: 'moba',
    isActive: true,
  },
  {
    id: 'apex',
    name: 'apex',
    displayName: 'Apex Legends',
    version: 'Season 22',
    category: 'battle-royale',
    isActive: true,
  },
  {
    id: 'overwatch',
    name: 'overwatch',
    displayName: 'Overwatch 2',
    version: 'Season 12',
    category: 'fps',
    isActive: true,
  },
]

// Utility functions for game management
export const getActiveGames = (): Game[] => {
  return GAMES.filter((game) => game.isActive)
}

export const getGameById = (id: string): Game | undefined => {
  return GAMES.find((game) => game.id === id)
}

export const getGamesByCategory = (category: Game['category']): Game[] => {
  return GAMES.filter((game) => game.category === category && game.isActive)
}

export const searchGames = (query: string): Game[] => {
  const lowercaseQuery = query.toLowerCase()
  return GAMES.filter(
    (game) =>
      game.isActive &&
      (game.name.toLowerCase().includes(lowercaseQuery) ||
        game.displayName.toLowerCase().includes(lowercaseQuery) ||
        game.version?.toLowerCase().includes(lowercaseQuery))
  )
}

export const getGameDisplayNameWithVersion = (game: Game): string => {
  return game.version
    ? `${game.displayName} (${game.version})`
    : game.displayName
}

// Default export for convenience
export default GAMES
