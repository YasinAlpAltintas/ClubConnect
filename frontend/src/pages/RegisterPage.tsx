import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { registerSchema, type RegisterInput } from '../schemas/register'
import { registerMember, checkEmailExists, type RegisterSuccessResponse } from '../lib/api'
import { apiErrorToKey } from '../lib/mapApiError'
import { type SupportedLanguage } from '../i18n'
import ThemeToggle from '../components/ThemeToggle'

type FieldError = 'email' | 'password' | null

export interface RegisterPageProps {
  onNavigateToLogin?: () => void
}

export default function RegisterPage({ onNavigateToLogin }: RegisterPageProps = {}) {
  const { t, i18n } = useTranslation()
  const [serverError, setServerError] = useState<{ key: string; status?: number } | null>(null)
  const [fieldError, setFieldError] = useState<FieldError>(null)
  const [emailConflict, setEmailConflict] = useState(false)
  const [success, setSuccess] = useState<RegisterSuccessResponse | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: ({ email, password }: RegisterInput) =>
      registerMember({ email, password }),
  })

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === 'en' ? 'nl-BE' : 'en'
    void i18n.changeLanguage(next)
  }

  async function handleEmailBlur() {
    const emailVal = getValues('email')
    if (emailVal && registerSchema.shape.email.safeParse(emailVal).success) {
      const exists = await checkEmailExists(emailVal)
      if (exists) {
        setEmailConflict(true)
        setFieldError('email')
      } else if (emailConflict) {
        setEmailConflict(false)
        if (fieldError === 'email') setFieldError(null)
      }
    }
  }

  function onSubmit(data: RegisterInput) {
    setServerError(null)
    setFieldError(null)
    setEmailConflict(false)
    mutation.mutate(data, {
      onSuccess: (result) => {
        setSuccess(result)
      },
      onError: (error) => {
        const resolved = apiErrorToKey(error)
        setServerError(resolved)
        if (resolved.key === 'conflict') {
          setEmailConflict(true)
          setFieldError('email')
        } else if (resolved.key === 'invalid_email') {
          setFieldError('email')
        } else if (resolved.key === 'invalid_password') {
          setFieldError('password')
        }
      },
    })
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 bg-aurora-bg text-aurora-text">
        <section
          className="w-full max-w-md rounded-2xl bg-aurora-surface p-8 text-center shadow-xl ring-1 ring-aurora-border"
          aria-live="polite"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-aurora-text">
            {t('success.title')}
          </h1>
          <p className="mt-3 text-sm text-aurora-text-secondary leading-relaxed">
            {t('success.message', { email: success.email })}
          </p>
          {onNavigateToLogin && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="btn-tactile w-full rounded-xl bg-aurora-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-aurora-primary-hover cursor-pointer"
              >
                {t('register.loginLink')}
              </button>
            </div>
          )}
          <div className="mt-8 flex items-center justify-end gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={toggleLanguage}
              className="text-xs font-medium text-aurora-text-muted hover:text-aurora-text transition-colors cursor-pointer"
            >
              {t('header.languageToggle')}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-aurora-bg text-aurora-text">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold tracking-tight text-aurora-primary">
          {t('app.name')}
        </span>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={toggleLanguage}
            className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors"
          >
            {t('header.languageToggle')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <section className="w-full max-w-md rounded-2xl bg-aurora-surface p-8 shadow-xl ring-1 ring-aurora-border">
          <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-aurora-primary/10 text-aurora-primary ring-1 ring-aurora-primary/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-aurora-text">
            {t('register.title')}
          </h1>
          <p className="mt-2 text-sm text-aurora-text-secondary">
            {t('register.subtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            {serverError && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20"
              >
                {serverError.key === 'unexpected'
                  ? t('register.api.unexpected', { status: serverError.status })
                  : t(`register.api.${serverError.key}`)}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-aurora-text">
                {t('register.email')}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder={t('register.emailPlaceholder')}
                aria-invalid={Boolean(errors.email || fieldError === 'email' || emailConflict)}
                aria-describedby={errors.email || emailConflict ? 'email-error' : undefined}
                className={`mt-1.5 block w-full rounded-xl border bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 ${
                  errors.email || fieldError === 'email' || emailConflict
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-aurora-border focus:border-aurora-primary focus:ring-aurora-primary/20'
                }`}
                {...register('email', {
                  onBlur: () => {
                    void handleEmailBlur()
                  },
                  onChange: () => {
                    if (emailConflict) {
                      setEmailConflict(false)
                      if (fieldError === 'email') setFieldError(null)
                    }
                  },
                })}
              />
              {emailConflict ? (
                <div id="email-error" className="mt-1.5 flex items-center justify-between text-xs font-medium text-red-400">
                  <span>{t('register.api.conflict')}</span>
                  {onNavigateToLogin && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onNavigateToLogin}
                      className="ml-2 font-medium text-aurora-primary hover:text-aurora-muted underline cursor-pointer"
                    >
                      {t('register.loginLink')}
                    </button>
                  )}
                </div>
              ) : errors.email ? (
                <p id="email-error" className="mt-1.5 text-xs font-medium text-red-400">
                  {t(`register.errors.${errors.email.message ?? 'required'}`, {
                    min: 8,
                  })}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-aurora-text">
                {t('register.password')}
              </label>
              <input
                type="password"
                id="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password || fieldError === 'password')}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`mt-1.5 block w-full rounded-xl border bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 ${
                  errors.password || fieldError === 'password'
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-aurora-border focus:border-aurora-primary focus:ring-aurora-primary/20'
                }`}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs font-medium text-red-400">
                  {t(`register.errors.${errors.password.message ?? 'required'}`, {
                    min: 8,
                  })}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-tactile w-full rounded-xl bg-aurora-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-aurora-primary-hover focus:outline-none focus:ring-2 focus:ring-aurora-primary/40 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          {onNavigateToLogin && (
            <div className="mt-6 text-center text-sm text-aurora-text-secondary">
              <span>{t('register.alreadyAccount')} </span>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="font-medium text-aurora-primary hover:text-aurora-muted underline cursor-pointer"
              >
                {t('register.loginLink')}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
