import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { registerSchema, type RegisterInput } from '../schemas/register'
import { registerMember, checkEmailExists, type RegisterSuccessResponse } from '../lib/api'
import { apiErrorToKey } from '../lib/mapApiError'
import { type SupportedLanguage } from '../i18n'

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
      <main className="flex min-h-screen items-center justify-center px-4">
        <section
          className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"
          aria-live="polite"
        >
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('success.title')}
          </h1>
          <p className="mt-3 text-slate-600">
            {t('success.message', { email: success.email })}
          </p>
          {onNavigateToLogin && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 cursor-pointer"
              >
                {t('register.loginLink')}
              </button>
            </div>
          )}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={toggleLanguage}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {t('header.languageToggle')}
            </button>
          </div>
        </section>
      </main>
    )
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
            {t('register.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('register.subtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            {serverError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {serverError.key === 'unexpected'
                  ? t('register.api.unexpected', { status: serverError.status })
                  : t(`register.api.${serverError.key}`)}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                {t('register.email')}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder={t('register.emailPlaceholder')}
                aria-invalid={Boolean(errors.email || fieldError === 'email' || emailConflict)}
                aria-describedby={errors.email || emailConflict ? 'email-error' : undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.email || fieldError === 'email' || emailConflict
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/40'
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
                <div id="email-error" className="mt-1 flex items-center justify-between text-sm text-red-600">
                  <span>{t('register.api.conflict')}</span>
                  {onNavigateToLogin && (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="ml-2 font-medium text-indigo-600 hover:text-indigo-500 underline cursor-pointer"
                    >
                      {t('register.loginLink')}
                    </button>
                  )}
                </div>
              ) : errors.email ? (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {t(`register.errors.${errors.email.message ?? 'required'}`, {
                    min: 8,
                  })}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                {t('register.password')}
              </label>
              <input
                type="password"
                id="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password || fieldError === 'password')}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.password || fieldError === 'password'
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/40'
                }`}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {t(`register.errors.${errors.password.message ?? 'required'}`, {
                    min: 8,
                  })}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          {onNavigateToLogin && (
            <div className="mt-6 text-center text-sm text-slate-600">
              <span>{t('register.alreadyAccount')} </span>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="font-medium text-indigo-600 hover:text-indigo-500 underline cursor-pointer"
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
