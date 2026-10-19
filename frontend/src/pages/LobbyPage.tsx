import { useTranslation } from 'react-i18next'
import { type SupportedLanguage } from '../i18n'

export interface AuthenticatedMember {
  memberId: string
  email: string
  displayName?: string | null
}

export interface LobbyPageProps {
  member: AuthenticatedMember
  onLogout: () => void
}

export default function LobbyPage({ member, onLogout }: LobbyPageProps) {
  const { t, i18n } = useTranslation()

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === 'en' ? 'nl-BE' : 'en'
    void i18n.changeLanguage(next)
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold text-slate-900">
          {t('app.name')}
        </span>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
          >
            {t('header.languageToggle')}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            {t('lobby.logout')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <section
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">
              {t('lobby.title')}
            </h1>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              Connected
            </span>
          </div>

          <p className="mt-3 text-slate-700 font-medium">
            {t('lobby.welcome', { email: member.email })}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('lobby.subtitle')}
          </p>

          <div className="mt-6 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200/60 space-y-2 text-sm">
            <div>
              <span className="font-medium text-slate-600">{t('lobby.memberId')}: </span>
              <span className="font-mono text-slate-900 select-all">{member.memberId}</span>
            </div>
            <div>
              <span className="font-medium text-slate-600">{t('login.email')}: </span>
              <span className="text-slate-900">{member.email}</span>
            </div>
            {member.displayName && (
              <div>
                <span className="font-medium text-slate-600">Name: </span>
                <span className="text-slate-900">{member.displayName}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500"
            >
              {t('lobby.logout')}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
