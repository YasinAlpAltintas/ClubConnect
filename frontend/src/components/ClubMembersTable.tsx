import { useTranslation } from 'react-i18next'
import { type ClubMemberDto } from '../lib/api'

export interface ClubMembersTableProps {
  members: ClubMemberDto[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

export default function ClubMembersTable({
  members,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
}: ClubMembersTableProps) {
  const { t, i18n } = useTranslation()

  function formatDate(isoString: string): string {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const locale = i18n.language === 'nl-BE' ? 'nl-BE' : 'en-US'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
    } catch {
      return isoString
    }
  }

  if (isLoading) {
    return (
      <div
        data-testid="members-loading"
        className="w-full overflow-hidden rounded-2xl bg-aurora-surface p-6 shadow-xs ring-1 ring-aurora-border"
      >
        <div className="space-y-4">
          <div className="h-6 w-1/4 animate-pulse rounded-md bg-aurora-elevated" />
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex items-center justify-between border-b border-aurora-border/50 py-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-aurora-elevated" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded-sm bg-aurora-elevated" />
                    <div className="h-3 w-44 animate-pulse rounded-sm bg-aurora-elevated" />
                  </div>
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-aurora-elevated" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        data-testid="members-error"
        className="flex flex-col items-center justify-center rounded-2xl bg-aurora-surface p-8 text-center shadow-xs ring-1 ring-red-500/20"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold text-aurora-text">
          {t('members.errorTitle', 'Unable to load members')}
        </h3>
        <p className="mt-1 text-sm text-aurora-text-secondary">
          {errorMessage || t('members.errorMessage', 'Failed to retrieve member list for this club.')}
        </p>
        {onRetry && (
          <button
            type="button"
            data-testid="members-retry-btn"
            onClick={onRetry}
            className="btn-tactile mt-5 rounded-xl bg-aurora-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-aurora-primary-hover cursor-pointer"
          >
            {t('common.retry', 'Retry')}
          </button>
        )}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div
        data-testid="members-empty"
        className="flex flex-col items-center justify-center rounded-2xl bg-aurora-surface p-10 text-center shadow-xs ring-1 ring-aurora-border"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aurora-elevated text-aurora-text-muted">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold text-aurora-text">
          {t('members.emptyTitle', 'No members yet')}
        </h3>
        <p className="mt-1 text-sm text-aurora-text-secondary">
          {t('members.emptyDesc', 'No active members were found in this club workspace.')}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-aurora-surface shadow-xs ring-1 ring-aurora-border">
      <div className="overflow-x-auto">
        <table data-testid="club-members-table" className="min-w-full divide-y divide-aurora-border">
          <caption className="sr-only">{t('members.tableCaption', 'Club members list')}</caption>
          <thead className="bg-aurora-elevated/70">
            <tr>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-aurora-text-muted"
              >
                {t('members.columns.name', 'Name')}
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-aurora-text-muted"
              >
                {t('members.columns.email', 'Email')}
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-aurora-text-muted"
              >
                {t('members.columns.role', 'Role')}
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-aurora-text-muted"
              >
                {t('members.columns.joined', 'Joined')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aurora-border/60 bg-aurora-surface">
            {members.map((member) => {
              const displayName = member.displayName?.trim() || member.email
              const initial = displayName[0]?.toUpperCase() || 'M'

              return (
                <tr
                  key={member.memberId}
                  data-testid={`member-row-${member.memberId}`}
                  className="hover:bg-aurora-elevated/40 transition-colors"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aurora-primary/10 font-semibold text-aurora-muted ring-1 ring-aurora-primary/20"
                        aria-hidden="true"
                      >
                        {initial}
                      </div>
                      <div className="font-medium text-aurora-text" data-testid={`member-name-${member.memberId}`}>
                        {member.displayName || member.email}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className="text-xs text-aurora-text-secondary font-mono"
                      data-testid={`member-email-${member.memberId}`}
                    >
                      {member.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      data-testid={`member-role-${member.memberId}`}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        member.role === 'Club Admin'
                          ? 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                          : 'bg-aurora-primary/10 text-aurora-muted ring-aurora-primary/20'
                      }`}
                    >
                      {member.role === 'Club Admin' ? t('dashboard.roleAdmin') : t('dashboard.roleMember')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs text-aurora-text-muted">
                    <span data-testid={`member-joined-${member.memberId}`}>
                      {formatDate(member.joinedAtUtc)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
