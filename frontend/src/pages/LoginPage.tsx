import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginInput } from '../schemas/login'
import { loginMember, type LoginSuccessResponse } from '../lib/api'
import { loginApiErrorToKey, type ResolvedLoginApiError } from '../lib/mapApiError'
import { type SupportedLanguage } from '../i18n'
import ThemeToggle from '../components/ThemeToggle'

export interface LoginPageProps {
  onLoginSuccess: (member: LoginSuccessResponse) => void
  onNavigateToRegister: () => void
  sessionExpired?: boolean
}

export default function LoginPage({
  onLoginSuccess,
  onNavigateToRegister,
  sessionExpired = false,
}: LoginPageProps) {
  const { t, i18n } = useTranslation()
  const [serverError, setServerError] = useState<ResolvedLoginApiError | null>(null)
  const [dismissedNotice, setDismissedNotice] = useState(false)
  const showExpiredNotice = sessionExpired && !dismissedNotice

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginInput) =>
      loginMember({ email, password }),
  })

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === 'en' ? 'nl-BE' : 'en'
    void i18n.changeLanguage(next)
  }

  function onSubmit(data: LoginInput) {
    setServerError(null)
    setDismissedNotice(true)
    mutation.mutate(data, {
      onSuccess: (result) => {
        onLoginSuccess(result)
      },
      onError: (error) => {
        const resolved = loginApiErrorToKey(error)
        setServerError(resolved)
      },
    })
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-aurora-text">
            {t('login.title')}
          </h1>
          <p className="mt-2 text-sm text-aurora-text-secondary">
            {t('login.subtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            {showExpiredNotice && (
              <div
                role="alert"
                className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/20"
              >
                {t('login.sessionExpired')}
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20"
              >
                {serverError.key === 'unexpected'
                  ? t('login.api.unexpected', { status: serverError.status })
                  : t(`login.api.${serverError.key}`)}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-aurora-text">
                {t('login.email')}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder={t('login.emailPlaceholder')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`mt-1.5 block w-full rounded-xl border bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-aurora-border focus:border-aurora-primary focus:ring-aurora-primary/20'
                }`}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs font-medium text-red-400">
                  {t(`login.errors.${errors.email.message ?? 'required'}`)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-aurora-text">
                {t('login.password')}
              </label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`mt-1.5 block w-full rounded-xl border bg-aurora-bg px-3.5 py-2.5 text-sm text-aurora-text placeholder:text-aurora-text-muted focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-aurora-border focus:border-aurora-primary focus:ring-aurora-primary/20'
                }`}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs font-medium text-red-400">
                  {t(`login.errors.${errors.password.message ?? 'required'}`)}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-tactile w-full rounded-xl bg-aurora-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-aurora-primary-hover focus:outline-none focus:ring-2 focus:ring-aurora-primary/40 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-aurora-text-secondary">
            <span>{t('login.noAccount')} </span>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="font-medium text-aurora-primary hover:text-aurora-muted underline cursor-pointer"
            >
              {t('login.registerLink')}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
