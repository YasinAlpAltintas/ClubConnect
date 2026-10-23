import { useTranslation } from 'react-i18next'
import { type AuthenticatedMember } from './LobbyPage'

export interface DashboardPageProps {
  member: AuthenticatedMember
  onLogout: () => void
  onNavigateToLobby: () => void
  onSessionExpired?: () => void
}

export default function DashboardPage({
  member,
  onLogout,
  onNavigateToLobby,
}: DashboardPageProps) {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-screen flex-col bg-slate-50" data-testid="club-dashboard-page">
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <span className="text-xl font-bold tracking-tight text-indigo-600">
            {t('app.name')}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {t('dashboard.title', { defaultValue: 'Club Dashboard' })}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="back-to-lobby-btn"
            onClick={onNavigateToLobby}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors"
          >
            {t('dashboard.backToLobby', { defaultValue: '← Back to Lobby' })}
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
        <h1 className="text-2xl font-bold text-slate-900">
          {t('dashboard.title', { defaultValue: 'Club Dashboard' })}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {member.email}
        </p>
      </div>
    </main>
  )
}
