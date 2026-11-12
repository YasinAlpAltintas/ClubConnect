import { useTranslation } from 'react-i18next'
import { useTheme } from '../lib/useTheme'

export interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  const isDark = theme === 'dark'
  const label = isDark ? t('header.themeLight', 'Light mode') : t('header.themeDark', 'Dark mode')

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors ${className}`}
    >
      {isDark ? (
        <>
          <svg className="h-4 w-4 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span className="hidden sm:inline font-medium">{t('header.themeLight', 'Light')}</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-aurora-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <span className="hidden sm:inline font-medium">{t('header.themeDark', 'Dark')}</span>
        </>
      )}
    </button>
  )
}
