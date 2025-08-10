import { createContext, useContext } from "react"

interface ThemeProviderState {
  systemTheme: "dark" | "light"
}

export const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (!context)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}