import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMemberProfile } from '../lib/api'

export interface OnboardingNameModalProps {
  isOpen: boolean
  token: string
  onProfileUpdated: (displayName: string, newToken?: string) => void
}

export default function OnboardingNameModal({
  isOpen,
  token,
  onProfileUpdated,
}: OnboardingNameModalProps) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFirstNameError(null)
    setLastNameError(null)
    setFormError(null)

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()

    let hasError = false
    if (!trimmedFirst) {
      setFirstNameError(t('onboarding.errors.firstNameRequired'))
      hasError = true
    }
    if (!trimmedLast) {
      setLastNameError(t('onboarding.errors.lastNameRequired'))
      hasError = true
    }

    if (hasError) return

    setIsSubmitting(true)
    try {
      const response = await updateMemberProfile(token, {
        firstName: trimmedFirst,
        lastName: trimmedLast,
      })
      onProfileUpdated(response.displayName || `${trimmedFirst} ${trimmedLast}`, response.token)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred while saving your name.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      data-testid="onboarding-name-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aurora-scrim/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl bg-aurora-surface p-6 sm:p-8 shadow-2xl ring-1 ring-aurora-border">
        {/* Header Icon & Title */}
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-aurora-primary/10 text-aurora-primary ring-1 ring-aurora-primary/20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        <h2 id="onboarding-modal-title" className="text-xl font-bold tracking-tight text-aurora-text">
          {t('onboarding.title')}
        </h2>
        <p className="mt-1 text-sm text-aurora-text-secondary">
          {t('onboarding.subtitle')}
        </p>

        {formError && (
          <div role="alert" className="mt-4 rounded-xl bg-aurora-danger/10 p-3 text-xs font-medium text-aurora-danger-bright ring-1 ring-aurora-danger/20">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="onboarding-first-name" className="block text-xs font-semibold text-aurora-text">
              {t('onboarding.firstName')}
            </label>
            <input
              id="onboarding-first-name"
              data-testid="onboarding-first-name"
              type="text"
              autoFocus
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                if (firstNameError) setFirstNameError(null)
              }}
              placeholder={t('onboarding.firstNamePlaceholder')}
              className={`mt-1.5 w-full rounded-xl bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text ring-1 ring-aurora-border placeholder:text-aurora-text-muted focus:outline-hidden focus:ring-2 focus:ring-aurora-primary transition-all ${
                firstNameError ? 'ring-aurora-danger/50' : ''
              }`}
            />
            {firstNameError && (
              <p className="mt-1 text-xs text-aurora-danger-bright font-medium">{firstNameError}</p>
            )}
          </div>

          <div>
            <label htmlFor="onboarding-last-name" className="block text-xs font-semibold text-aurora-text">
              {t('onboarding.lastName')}
            </label>
            <input
              id="onboarding-last-name"
              data-testid="onboarding-last-name"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (lastNameError) setLastNameError(null)
              }}
              placeholder={t('onboarding.lastNamePlaceholder')}
              className={`mt-1.5 w-full rounded-xl bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text ring-1 ring-aurora-border placeholder:text-aurora-text-muted focus:outline-hidden focus:ring-2 focus:ring-aurora-primary transition-all ${
                lastNameError ? 'ring-aurora-danger/50' : ''
              }`}
            />
            {lastNameError && (
              <p className="mt-1 text-xs text-aurora-danger-bright font-medium">{lastNameError}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              data-testid="onboarding-submit-btn"
              disabled={isSubmitting}
              className="btn-tactile w-full inline-flex items-center justify-center rounded-xl bg-aurora-primary px-4 py-2.5 text-sm font-semibold text-aurora-on-accent shadow-xs hover:bg-aurora-primary-hover disabled:opacity-60 cursor-pointer transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-aurora-on-accent border-r-transparent" />
                  {t('onboarding.submitting')}
                </>
              ) : (
                t('onboarding.submit')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
