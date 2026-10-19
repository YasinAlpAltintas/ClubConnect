import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { type SupportedLanguage } from '../i18n'
import { getMemberClubs, type ClubDto } from '../lib/api'

export interface AuthenticatedMember {
  memberId: string
  email: string
  displayName?: string | null
  token?: string
}

export interface LobbyPageProps {
  member: AuthenticatedMember
  onLogout: () => void
  onSessionExpired?: () => void
  initialClubs?: ClubDto[]
}

type ModalType = 'explore' | 'create' | null

export default function LobbyPage({
  member,
  onLogout,
  initialClubs,
}: LobbyPageProps) {
  const { t, i18n } = useTranslation()
  const [modalType, setModalType] = useState<ModalType>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [codeSubmitted, setCodeSubmitted] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const { data: clubs = initialClubs ?? [], isLoading } = useQuery<ClubDto[]>({
    queryKey: ['memberClubs', member.token],
    queryFn: () => getMemberClubs(member.token),
    initialData: initialClubs,
    enabled: initialClubs === undefined && Boolean(member.token),
  })

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === 'en' ? 'nl-BE' : 'en'
    void i18n.changeLanguage(next)
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteCode.trim()) {
      setCodeError(t('lobby.empty.codeError'))
      setCodeSubmitted(false)
      return
    }
    setCodeError(null)
    setCodeSubmitted(true)
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-bold tracking-tight text-indigo-600">
            {t('app.name')}
          </span>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            Student Portal
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            {t('header.languageToggle')}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300 cursor-pointer"
          >
            {t('lobby.logout')}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {/* Member Profile Overview Card */}
        <section
          className="mb-8 rounded-2xl bg-white p-6 shadow-xs ring-1 ring-slate-200"
          aria-label="Member details"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {t('lobby.title')}
                </h1>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
                  Connected
                </span>
              </div>
              <p className="mt-1 font-medium text-slate-700">
                {t('lobby.welcome', { email: member.email })}
              </p>
              <p className="text-sm text-slate-500">
                {t('lobby.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/80">
                <span className="font-medium text-slate-500">{t('lobby.memberId')}: </span>
                <span className="font-mono font-medium text-slate-900 select-all">{member.memberId}</span>
              </div>
              {member.displayName && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/80">
                  <span className="font-medium text-slate-500">Name: </span>
                  <span className="font-medium text-slate-900">{member.displayName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                {t('lobby.logout')}
              </button>
            </div>
          </div>
        </section>

        {/* My Clubs Section */}
        <section className="space-y-6" aria-label="My Clubs">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {t('lobby.myClubs')}
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}
            </span>
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-xs ring-1 ring-slate-200">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent align-[-0.125em]" />
              <p className="mt-4 text-sm font-medium text-slate-600">{t('lobby.loading')}</p>
            </div>
          ) : clubs.length === 0 ? (
            /* INC-10: Empty Lobby State with Clear Calls-to-Action */
            <div
              data-testid="lobby-empty-state"
              className="rounded-2xl bg-white p-8 shadow-xs ring-1 ring-slate-200 sm:p-12"
            >
              <div className="mx-auto max-w-2xl text-center">
                {/* Visual Badge / Icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.199l-.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </div>

                <div className="mt-4">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {t('lobby.empty.badge')}
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {t('lobby.empty.title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                  {t('lobby.empty.description')}
                </p>

                {/* Primary & Secondary Action CTAs */}
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setModalType('explore')}
                    className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {t('lobby.empty.exploreCta')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalType('create')}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {t('lobby.empty.createCta')}
                  </button>
                </div>

                {/* Tertiary CTA: Join With Invite Code */}
                <div className="mt-8 rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200/80">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {t('lobby.empty.codeCta')}
                  </h4>
                  <form onSubmit={handleInviteSubmit} className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row">
                    <input
                      type="text"
                      id="invite-code"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value)
                        if (codeError) setCodeError(null)
                      }}
                      placeholder={t('lobby.empty.codePlaceholder')}
                      aria-label={t('lobby.empty.codeCta')}
                      className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
                    >
                      {t('lobby.empty.codeSubmit')}
                    </button>
                  </form>

                  {codeError && (
                    <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                      {codeError}
                    </p>
                  )}

                  {codeSubmitted && (
                    <div role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                      {t('lobby.empty.codeSuccess')}
                    </div>
                  )}
                </div>
              </div>

              {/* 3-Step Guided Walkthrough */}
              <div className="mt-12 border-t border-slate-100 pt-8">
                <h4 className="text-center text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  {t('lobby.empty.stepsTitle')}
                </h4>

                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50/60 p-4 ring-1 ring-slate-200/60">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-700 text-xs">
                      1
                    </span>
                    <h5 className="mt-3 text-sm font-semibold text-slate-900">
                      {t('lobby.empty.step1Title')}
                    </h5>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {t('lobby.empty.step1Desc')}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50/60 p-4 ring-1 ring-slate-200/60">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-700 text-xs">
                      2
                    </span>
                    <h5 className="mt-3 text-sm font-semibold text-slate-900">
                      {t('lobby.empty.step2Title')}
                    </h5>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {t('lobby.empty.step2Desc')}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50/60 p-4 ring-1 ring-slate-200/60">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-700 text-xs">
                      3
                    </span>
                    <h5 className="mt-3 text-sm font-semibold text-slate-900">
                      {t('lobby.empty.step3Title')}
                    </h5>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {t('lobby.empty.step3Desc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Clubs Grid */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clubs.map((club) => (
                <article
                  key={club.id}
                  className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">{club.name}</h3>
                    {club.role && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {club.role}
                      </span>
                    )}
                  </div>
                  {club.description && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {club.description}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Info Dialog Modal */}
      {modalType && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              {modalType === 'explore'
                ? t('lobby.empty.dialogExploreTitle')
                : t('lobby.empty.dialogCreateTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {modalType === 'explore'
                ? t('lobby.empty.dialogExploreMessage')
                : t('lobby.empty.dialogCreateMessage')}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer"
              >
                {t('lobby.empty.dialogClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
