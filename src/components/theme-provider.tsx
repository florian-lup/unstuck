import { useEffect } from "react"
import { ThemeProviderContext } from "@/hooks/use-theme"

interface ThemeProviderState {
  systemTheme: "dark" | "light"
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (theme: string) => {
      root.classList.remove("light", "dark")
      root.classList.add(theme)
    }

    // Check if we're in Electron environment
    if (window.electronAPI?.getSystemTheme) {
      // Get initial system theme from Electron
      void window.electronAPI.getSystemTheme().then((systemTheme: string) => {
        applyTheme(systemTheme)
      })
      
      // Listen for system theme changes
      window.electronAPI.onThemeChanged((newTheme: string) => {
        applyTheme(newTheme)
      })
    } else {
      // Fallback to browser API if not in Electron or during development
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      applyTheme(systemTheme)

      // Listen for system theme changes in browser
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light")
      }
      
      mediaQuery.addEventListener("change", handleChange)
      
      return () => {
        mediaQuery.removeEventListener("change", handleChange)
        // Clean up Electron listener if it exists
        if (window.electronAPI?.removeThemeListener) {
          window.electronAPI.removeThemeListener()
        }
      }
    }
  }, [])

  // Since we're only detecting system theme, we don't need to expose any values
  // But keeping the context for potential future use
  const value: ThemeProviderState = {
    systemTheme: "light", // This is just a placeholder since we don't track state
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}