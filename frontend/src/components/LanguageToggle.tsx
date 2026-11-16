import { useTranslation } from 'react-i18next'
import { type SupportedLanguage } from '../i18n'

export interface LanguageToggleProps {
  className?: string
  'data-testid'?: string
}

export default function LanguageToggle({
  className = '',
  'data-testid': testId = 'language-toggle',
}: LanguageToggleProps) {
  const { t, i18n } = useTranslation()
  const isDutch = i18n.language === 'nl-BE'

  function toggleLanguage() {
    const next: SupportedLanguage = isDutch ? 'en' : 'nl-BE'
    void i18n.changeLanguage(next)
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={toggleLanguage}
      aria-label={t('header.languageToggle')}
      title={t('header.languageToggle')}
      className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors ${className}`}
    >
      <span className="text-base leading-none select-none" aria-hidden="true">
        {isDutch ? '🇬🇧' : '🇳🇱'}
      </span>
      <span className="font-medium">{t('header.languageToggle')}</span>
    </button>
  )
}
