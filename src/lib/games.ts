import React from 'react'

export interface Game {
  id: string
  gameName: string
  displayName: string
  version?: string
  icon?: React.ReactNode
  category?: 'survival' | 'moba' | 'strategy' | 'rpg' | 'mmorpg' | 'souls-like'
  isActive?: boolean
}

// Central games database
export const GAMES: Game[] = [
  // ========== MMORPG ==========
  {
    id: 'ff14',
    gameName: 'final fantasy 14',
    displayName: 'Final Fantasy 14',
    version: '7.xx',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'wow',
    gameName: 'world of warcraft',
    displayName: 'World of Warcraft',
    version: '11.xx',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'elder-scrolls',
    gameName: 'elder scrolls online',
    displayName: 'Elder Scrolls Online',
    version: '11.xx',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'gw2',
    gameName: 'guild wars 2',
    displayName: 'Guild Wars 2',
    version: '',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'lost-ark',
    gameName: 'lost ark',
    displayName: 'Lost Ark',
    version: '',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'new-world',
    gameName: 'new world',
    displayName: 'New World',
    version: '',
    category: 'mmorpg',
    isActive: true,
  },
  {
    id: 'runescape',
    gameName: 'old school runescape',
    displayName: 'Old School RuneScape',
    version: '',
    category: 'mmorpg',
    isActive: true,
  },

  // ========== MOBA ==========
  {
    id: 'lol',
    gameName: 'league of legends',
    displayName: 'League of Legends',
    version: '25.xx',
    category: 'moba',
    isActive: true,
  },
  {
    id: 'dota2',
    gameName: 'dota2',
    displayName: 'Dota 2',
    version: '7.xx',
    category: 'moba',
    isActive: true,
  },
  {
    id: 'smite',
    gameName: 'smite',
    displayName: 'Smite',
    version: '11.xx',
    category: 'moba',
    isActive: true,
  },
  {
    id: 'hots',
    gameName: 'heroes of the storm',
    displayName: 'Heroes of the Storm',
    version: '',
    category: 'moba',
    isActive: true,
  },

  // ========== SOULS-LIKE ==========
  {
    id: 'elden-ring',
    gameName: 'elden ring',
    displayName: 'Elden Ring',
    version: '',
    category: 'souls-like',
    isActive: true,
  },
  {
    id: 'dark-souls-3',
    gameName: 'dark souls 3',
    displayName: 'Dark Souls 3',
    version: '',
    category: 'souls-like',
    isActive: true,
  },
  {
    id: 'bloodborne',
    gameName: 'bloodborne',
    displayName: 'Bloodborne',
    version: '',
    category: 'souls-like',
    isActive: true,
  },
  {
    id: 'sekiro',
    gameName: 'sekiro shadows die twice',
    displayName: 'Sekiro: Shadows Die Twice',
    version: '',
    category: 'souls-like',
    isActive: true,
  },
  {
    id: 'lies-of-p',
    gameName: 'lies of p',
    displayName: 'Lies of P',
    version: '',
    category: 'souls-like',
    isActive: true,
  },
  {
    id: 'bg3',
    gameName: "baldur's gate 3",
    displayName: "Baldur's Gate 3",
    version: '',
    category: 'souls-like',
    isActive: true,
  },

  // ========== RPG ==========
  {
    id: 'poe1 ',
    gameName: 'path of exile 1',
    displayName: 'Path of Exile 1',
    version: '3.26',
    category: 'rpg',
    isActive: true,
  },
  {
    id: 'poe2',
    gameName: 'path of exile 2',
    displayName: 'Path of Exile 2',
    version: '0.xx',
    category: 'rpg',
    isActive: true,
  },
  {
    id: 'diablo4',
    gameName: 'diablo 4',
    displayName: 'Diablo 4',
    version: '2.4.x',
    category: 'rpg',
    isActive: true,
  },
  {
    id: 'last-epoch',
    gameName: 'last epoch',
    displayName: 'Last Epoch',
    version: '1.xx',
    category: 'rpg',
    isActive: true,
  },
  {
    id: 'grim-dawn',
    gameName: 'grim dawn',
    displayName: 'Grim Dawn',
    version: '',
    category: 'rpg',
    isActive: true,
  },
  {
    id: 'divinity-2',
    gameName: 'divinity original sin 2',
    displayName: 'Divinity: Original Sin 2',
    version: '',
    category: 'rpg',
    isActive: true,
  },

  // ========== STRATEGY ==========
  {
    id: 'starcraft-2',
    gameName: 'starcraft 2',
    displayName: 'StarCraft 2',
    version: '',
    category: 'strategy',
    isActive: true,
  },
  {
    id: 'age-of-empires-4',
    gameName: 'age of empires 4',
    displayName: 'Age of Empires 4',
    version: '',
    category: 'strategy',
    isActive: true,
  },
  {
    id: 'total-war-warhammer-3',
    gameName: 'total war warhammer 3',
    displayName: 'Total War: Warhammer 3',
    version: '',
    category: 'strategy',
    isActive: true,
  },
  {
    id: 'civilization-6',
    gameName: 'civilization 6',
    displayName: 'Civilization 6',
    version: '',
    category: 'strategy',
    isActive: true,
  },

  // ========== SURVIVAL ==========
  {
    id: 'valheim',
    gameName: 'valheim',
    displayName: 'Valheim',
    version: '',
    category: 'survival',
    isActive: true,
  },
  {
    id: 'ark',
    gameName: 'ark survival evolved',
    displayName: 'ARK: Survival Evolved',
    version: '',
    category: 'survival',
    isActive: true,
  },
  {
    id: 'rust',
    gameName: 'rust',
    displayName: 'Rust',
    version: '',
    category: 'survival',
    isActive: true,
  },
  {
    id: 'minecraft',
    gameName: 'minecraft',
    displayName: 'Minecraft',
    version: '',
    category: 'survival',
    isActive: true,
  },
  {
    id: 'terraria',
    gameName: 'terraria',
    displayName: 'Terraria',
    version: '1.4.x',
    category: 'survival',
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
