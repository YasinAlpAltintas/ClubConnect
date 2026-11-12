import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { type AuthenticatedMember } from './LobbyPage'
import { type ClubDto, getMemberClubs, getClubDetails, getClubMembers } from '../lib/api'
import { useActiveClub } from '../lib/useActiveClub'
import ClubSwitcherDropdown from '../components/ClubSwitcherDropdown'
import ClubMembersTable from '../components/ClubMembersTable'
import InviteCodeCard from '../components/InviteCodeCard'
import ThemeToggle from '../components/ThemeToggle'
import { type SupportedLanguage } from '../i18n'

export interface DashboardPageProps {
  member: AuthenticatedMember
  onLogout: () => void
  onNavigateToLobby: () => void
  onSessionExpired?: () => void
  initialActiveClubId?: string | null
  initialClubs?: ClubDto[]
}

export default function DashboardPage({
  member,
  onLogout,
  onNavigateToLobby,
  onSessionExpired,
  initialActiveClubId,
  initialClubs,
}: DashboardPageProps) {
  const { t, i18n } = useTranslation()
  const [selectedClubId, setSelectedClubId] = useState<string | null | undefined>(initialActiveClubId)

  const getSubViewFromHash = (): 'overview' | 'members' => {
    if (typeof window !== 'undefined' && window.location.hash.includes('/members')) {
      return 'members'
    }
    return 'overview'
  }

  const [subView, setSubView] = useState<'overview' | 'members'>(getSubViewFromHash)

  useEffect(() => {
    function handleHashChange() {
      setSubView(getSubViewFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (initialActiveClubId !== undefined) {
      setSelectedClubId(initialActiveClubId)
    }
  }, [initialActiveClubId])

  const {
    data: clubs = initialClubs ?? [],
    isLoading: isLoadingClubs,
  } = useQuery({
    queryKey: ['memberClubs', member.token],
    queryFn: () => getMemberClubs(member.token),
    initialData: initialClubs,
    enabled: !!member.token,
  })

  const { activeClubId, activeClub, setActiveClubId } = useActiveClub({
    clubs,
    memberId: member.memberId,
    initialActiveClubId,
  })

  const targetClubId = selectedClubId ?? activeClubId

  const {
    data: clubDetails,
    isLoading: isLoadingDetails,
    error: detailsError,
  } = useQuery({
    queryKey: ['clubDetails', targetClubId, member.token],
    queryFn: () => getClubDetails(targetClubId!, member.token),
    enabled: !!targetClubId && !!member.token,
    retry: false,
  })

  useEffect(() => {
    if (detailsError) {
      const status = (detailsError as { status?: number }).status
      const msg = detailsError instanceof Error ? detailsError.message : ''
      if (status === 401 || msg.includes('401')) {
        onSessionExpired?.()
      }
    }
  }, [detailsError, onSessionExpired])

  const currentClub = clubDetails ?? clubs.find((c) => c.id === targetClubId) ?? activeClub
  const isClubAdmin = currentClub?.role === 'Club Admin'

  const {
    data: clubMembers = [],
    isLoading: isLoadingMembers,
    isError: isMembersError,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['clubMembers', targetClubId, member.token],
    queryFn: () => getClubMembers(targetClubId!, member.token),
    enabled: !!targetClubId && !!member.token && subView === 'members' && isClubAdmin,
    retry: false,
  })

  useEffect(() => {
    if (membersError) {
      const status = (membersError as { status?: number }).status
      const msg = membersError instanceof Error ? membersError.message : ''
      if (status === 401 || msg.includes('401')) {
        onSessionExpired?.()
      }
    }
  }, [membersError, onSessionExpired])

  const navigateToSubView = (nextView: 'overview' | 'members') => {
    setSubView(nextView)
    if (typeof window !== 'undefined' && targetClubId) {
      window.location.hash = nextView === 'members'
        ? `#dashboard/${targetClubId}/members`
        : `#dashboard/${targetClubId}`
    }
  }

  const handleSelectClub = (clubId: string) => {
    setSelectedClubId(clubId)
    setActiveClubId(clubId)
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#dashboard')) {
      window.location.hash = subView === 'members'
        ? `#dashboard/${clubId}/members`
        : `#dashboard/${clubId}`
    }
  }

  useEffect(() => {
    if (targetClubId && typeof window !== 'undefined' && window.location.hash.startsWith('#dashboard')) {
      const expectedHash = subView === 'members'
        ? `#dashboard/${targetClubId}/members`
        : `#dashboard/${targetClubId}`
      if (window.location.hash !== expectedHash) {
        window.location.hash = expectedHash
      }
    }
  }, [targetClubId, subView])

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === 'en' ? 'nl-BE' : 'en'
    void i18n.changeLanguage(next)
  }

  const isGeneralAccessDenied = Boolean(
    (detailsError && ((detailsError as { status?: number }).status === 403 || (detailsError as { status?: number }).status === 404 || (detailsError instanceof Error && (detailsError.message.includes('403') || detailsError.message.includes('404'))))) ||
    (!isLoadingClubs && clubs.length > 0 && targetClubId && !clubs.some((c) => c.id === targetClubId)) ||
    (!isLoadingClubs && clubs.length === 0)
  )

  const isMembersAccessDenied = Boolean(
    subView === 'members' && !isLoadingClubs && currentClub && currentClub.role !== 'Club Admin'
  )

  if (isGeneralAccessDenied || isMembersAccessDenied) {
    return (
      <main className="flex min-h-screen flex-col bg-aurora-bg text-aurora-text" data-testid="dashboard-access-denied">
        <header className="flex items-center justify-between border-b border-aurora-border bg-aurora-surface px-6 py-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold tracking-tight text-aurora-primary">
              {t('app.name')}
            </span>
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">
              {t('dashboard.accessDenied')}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {isMembersAccessDenied && (
              <button
                type="button"
                data-testid="access-denied-dashboard-header-btn"
                onClick={() => navigateToSubView('overview')}
                className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-primary ring-1 ring-aurora-primary/30 hover:bg-aurora-primary/10 cursor-pointer transition-colors"
              >
                {t('members.backToDashboard')}
              </button>
            )}
            <button
              type="button"
              data-testid="back-to-lobby-btn"
              onClick={onNavigateToLobby}
              className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors"
            >
              {t('dashboard.backToLobby')}
            </button>
            <button
              type="button"
              data-testid="dashboard-logout-btn"
              onClick={onLogout}
              className="btn-tactile rounded-xl bg-aurora-elevated px-3 py-1.5 text-xs font-medium text-aurora-text hover:bg-aurora-border cursor-pointer transition-colors"
            >
              {t('lobby.logout')}
            </button>
          </div>
        </header>

        <div className="mx-auto flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.5a9.75 9.75 0 110 19.5 9.75 9.75 0 010-19.5zm.008 14.25h-.016a.75.75 0 01-.742-.75.75.75 0 01.75-.75h.008a.75.75 0 01.75.75.75.75 0 01-.75.75z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-aurora-text">
            {t('dashboard.accessDenied')}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-aurora-text-secondary">
            {isMembersAccessDenied
              ? t('members.accessDeniedMessage')
              : t('dashboard.accessDeniedMessage')}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {isMembersAccessDenied && (
              <button
                type="button"
                data-testid="access-denied-dashboard-btn"
                onClick={() => navigateToSubView('overview')}
                className="btn-tactile inline-flex items-center justify-center rounded-xl bg-aurora-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-aurora-primary-hover cursor-pointer"
              >
                {t('members.backToDashboard')}
              </button>
            )}
            <button
              type="button"
              data-testid="access-denied-back-btn"
              onClick={onNavigateToLobby}
              className="btn-tactile inline-flex items-center justify-center rounded-xl bg-aurora-surface px-4 py-2.5 text-sm font-semibold text-aurora-text ring-1 ring-aurora-border hover:bg-aurora-elevated cursor-pointer"
            >
              {t('dashboard.backToLobby')}
            </button>
          </div>
        </div>
      </main>
    )
  }

  if ((isLoadingClubs || isLoadingDetails) && !currentClub) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-aurora-bg text-aurora-text" data-testid="dashboard-loading-state">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-aurora-primary border-r-transparent" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-aurora-bg text-aurora-text" data-testid="club-dashboard-page">
      {/* Top Navigation Header */}
      <header className="flex items-center justify-between border-b border-aurora-border bg-aurora-surface px-6 py-4 shadow-xs">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <span className="text-xl font-bold tracking-tight text-aurora-primary">
            {t('app.name')}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-aurora-primary/10 px-2.5 py-0.5 text-xs font-medium text-aurora-muted ring-1 ring-aurora-primary/20">
            {t('dashboard.badge')}
          </span>
          <ClubSwitcherDropdown
            clubs={clubs}
            activeClubId={targetClubId}
            onSelectClub={handleSelectClub}
          />
        </div>
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          {subView === 'members' ? (
            <button
              type="button"
              data-testid="members-back-to-dashboard-btn"
              onClick={() => navigateToSubView('overview')}
              className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-primary ring-1 ring-aurora-primary/30 hover:bg-aurora-primary/10 cursor-pointer transition-colors"
            >
              {t('members.backToDashboard')}
            </button>
          ) : isClubAdmin ? (
            <button
              type="button"
              data-testid="dashboard-members-nav-btn"
              onClick={() => navigateToSubView('members')}
              className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors"
            >
              {t('members.navButton')}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="dashboard-language-toggle"
            onClick={toggleLanguage}
            className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors"
          >
            {t('header.languageToggle')}
          </button>
          <button
            type="button"
            data-testid="back-to-lobby-btn"
            onClick={onNavigateToLobby}
            className="btn-tactile rounded-xl px-3 py-1.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border hover:bg-aurora-elevated hover:text-aurora-text cursor-pointer transition-colors"
          >
            {t('dashboard.backToLobby')}
          </button>
          <button
            type="button"
            data-testid="dashboard-logout-btn"
            onClick={onLogout}
            className="btn-tactile rounded-xl bg-aurora-elevated px-3 py-1.5 text-xs font-medium text-aurora-text hover:bg-aurora-border cursor-pointer transition-colors"
          >
            {t('lobby.logout')}
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      {subView === 'members' ? (
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6" data-testid="members-page">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  data-testid="back-to-dashboard-link"
                  onClick={() => navigateToSubView('overview')}
                  className="inline-flex items-center text-xs font-semibold text-aurora-primary hover:text-aurora-muted cursor-pointer transition-colors"
                >
                  ← {t('members.backToDashboard')}
                </button>
              </div>
              <div className="mt-2 flex items-center space-x-3">
                <h1
                  data-testid="members-page-heading"
                  className="text-2xl font-bold tracking-tight text-aurora-text sm:text-3xl"
                >
                  {t('members.title')}
                </h1>
                {!isLoadingMembers && (
                  <span
                    data-testid="members-count-badge"
                    className="inline-flex items-center rounded-full bg-aurora-elevated px-2.5 py-0.5 text-xs font-medium text-aurora-text-secondary ring-1 ring-aurora-border"
                  >
                    {t('members.memberCount', { count: clubMembers.length })}
                  </span>
                )}
              </div>
              {currentClub && (
                <p
                  data-testid="members-page-subtitle"
                  className="mt-1 text-xs text-aurora-text-secondary"
                >
                  {t('members.subtitle', { clubName: currentClub.name })}
                </p>
              )}
            </div>
          </div>

          {currentClub && isClubAdmin && currentClub.inviteCode && (
            <div className="mb-6">
              <InviteCodeCard
                code={currentClub.inviteCode}
                clubName={currentClub.name}
                role={currentClub.role}
                variant="members"
              />
            </div>
          )}

          <ClubMembersTable
            members={clubMembers}
            isLoading={isLoadingMembers}
            isError={isMembersError}
            errorMessage={membersError instanceof Error ? membersError.message : undefined}
            onRetry={() => void refetchMembers()}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {currentClub && (
            <section
              className="mb-8 rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border text-aurora-text"
              aria-label="Club Overview"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <h1
                      data-testid="dashboard-club-name"
                      className="text-2xl font-bold tracking-tight text-aurora-text sm:text-3xl"
                    >
                      {currentClub.name}
                    </h1>
                    {currentClub.role && (
                      <span
                        data-testid="dashboard-role-badge"
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          currentClub.role === 'Club Admin'
                            ? 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                            : 'bg-aurora-primary/10 text-aurora-muted ring-aurora-primary/20'
                        }`}
                      >
                        {currentClub.role === 'Club Admin'
                          ? t('dashboard.roleAdmin')
                          : t('dashboard.roleMember')}
                      </span>
                    )}
                  </div>
                  {currentClub.description && (
                    <p
                      data-testid="dashboard-club-description"
                      className="mt-2 max-w-2xl text-sm text-aurora-text-secondary leading-relaxed"
                    >
                      {currentClub.description}
                    </p>
                  )}
                </div>

                {isClubAdmin && (
                  <div className="flex items-center space-x-3 sm:self-start">
                    <button
                      type="button"
                      data-testid="dashboard-members-btn"
                      onClick={() => navigateToSubView('members')}
                      className="btn-tactile inline-flex items-center space-x-2 rounded-xl bg-aurora-primary/10 px-3.5 py-2 text-xs font-semibold text-aurora-primary ring-1 ring-aurora-primary/25 hover:bg-aurora-primary/20 transition-colors cursor-pointer"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{t('members.title')}</span>
                    </button>
                  </div>
                )}
              </div>

              {currentClub.role === 'Club Admin' && currentClub.inviteCode && (
                <InviteCodeCard
                  code={currentClub.inviteCode}
                  clubName={currentClub.name}
                  role={currentClub.role}
                  variant="overview"
                />
              )}
            </section>
          )}

          {/* Modules Section */}
          <section aria-label="Club Modules" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-aurora-text">
                {t('dashboard.modules.title')}
              </h2>
              <p className="text-xs text-aurora-text-secondary">
                {t('dashboard.modules.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Calendar & Events */}
              <article className="rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:ring-aurora-primary/30">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aurora-primary/10 text-aurora-primary ring-1 ring-aurora-primary/20">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </div>
                    <span className="rounded-full bg-aurora-elevated px-2 py-0.5 text-[10px] font-semibold text-aurora-text-muted ring-1 ring-aurora-border">
                      {t('dashboard.modules.comingSoon')}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-aurora-text">
                    {t('dashboard.modules.calendarTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-aurora-text-secondary leading-relaxed">
                    {t('dashboard.modules.calendarDesc')}
                  </p>
                </div>
              </article>

              {/* Kanban Task Board */}
              <article className="rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:ring-aurora-secondary/30">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aurora-secondary/10 text-aurora-secondary ring-1 ring-aurora-secondary/20">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.5-15h15a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 013 17.25V6.75A2.25 2.25 0 015.25 4.5z" />
                      </svg>
                    </div>
                    <span className="rounded-full bg-aurora-elevated px-2 py-0.5 text-[10px] font-semibold text-aurora-text-muted ring-1 ring-aurora-border">
                      {t('dashboard.modules.comingSoon')}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-aurora-text">
                    {t('dashboard.modules.tasksTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-aurora-text-secondary leading-relaxed">
                    {t('dashboard.modules.tasksDesc')}
                  </p>
                </div>
              </article>

              {/* Logistics & Inventory */}
              <article className="rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:ring-emerald-500/30">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <span className="rounded-full bg-aurora-elevated px-2 py-0.5 text-[10px] font-semibold text-aurora-text-muted ring-1 ring-aurora-border">
                      {t('dashboard.modules.comingSoon')}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-aurora-text">
                    {t('dashboard.modules.logisticsTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-aurora-text-secondary leading-relaxed">
                    {t('dashboard.modules.logisticsDesc')}
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
