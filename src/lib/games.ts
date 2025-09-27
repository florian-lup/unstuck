import React from 'react'

export interface Game {
  id: string
  gameName: string
  displayName: string
  version?: string
  icon?: React.ReactNode
  category?: 'fps' | 'moba' | 'battle-royale' | 'strategy' | 'mmorpg' | 'other'
  isActive?: boolean
}

// Central games database
export const GAMES: Game[] = [
  {
    id: 'valorant',
    gameName: 'valorant',
    displayName: 'Valorant',
    version: '8.11',
    category: 'fps',
    isActive: true,
  },
  {
    id: 'wow',
    gameName: 'world of warcraft',
    displayName: 'World of Warcraft',
    version: '11.2',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'lol',
    gameName: 'league of legends',
    displayName: 'League of Legends',
    version: '14.18',
    category: 'moba',
    isActive: true,
  },
  {
    id: 'apex',
    gameName: 'apex legends',
    displayName: 'Apex Legends',
    version: 'Season 22',
    category: 'battle-royale',
    isActive: true,
  },
  {
    id: 'overwatch',
    gameName: 'overwatch',
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
      (game.gameName.toLowerCase().includes(lowercaseQuery) ||
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
