import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'clubconnect_theme'

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  } catch {
    // Ignore storage/media query access issues
  }
  return 'dark'
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('theme-light')
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  } else {
    root.classList.remove('theme-light')
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage access errors in restricted contexts
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
}
