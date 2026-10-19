import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginInput } from '../schemas/login'
import { loginMember, type LoginSuccessResponse } from '../lib/api'
import { loginApiErrorToKey, type ResolvedLoginApiError } from '../lib/mapApiError'
import { type SupportedLanguage } from '../i18n'

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
  const [expiredNoticeVisible, setExpiredNoticeVisible] = useState(sessionExpired)

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
    setExpiredNoticeVisible(false)
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
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold text-slate-900">
          {t('app.name')}
        </span>
        <button
          type="button"
          onClick={toggleLanguage}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
        >
          {t('header.languageToggle')}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('login.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('login.subtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            {expiredNoticeVisible && (
              <div
                role="alert"
                className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                {t('login.sessionExpired')}
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {serverError.key === 'unexpected'
                  ? t('login.api.unexpected', { status: serverError.status })
                  : t(`login.api.${serverError.key}`)}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                {t('login.email')}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder={t('login.emailPlaceholder')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/40'
                }`}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {t(`login.errors.${errors.email.message ?? 'required'}`)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                {t('login.password')}
              </label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/40'
                }`}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {t(`login.errors.${errors.password.message ?? 'required'}`)}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            <span>{t('login.noAccount')} </span>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="font-medium text-indigo-600 hover:text-indigo-500 underline cursor-pointer"
            >
              {t('login.registerLink')}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
