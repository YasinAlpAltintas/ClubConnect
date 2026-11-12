import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type ClubMemberDto } from '../lib/api'

export interface ClubMembersTableProps {
  members: ClubMemberDto[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  isClubAdmin?: boolean
  currentMemberId?: string
  onPromoteMember?: (memberId: string) => Promise<void> | void
  isPromotingMemberId?: string | null
  onRemoveMember?: (memberId: string) => Promise<void> | void
  isRemovingMemberId?: string | null
}

export default function ClubMembersTable({
  members,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  isClubAdmin = false,
  currentMemberId,
  onPromoteMember,
  isPromotingMemberId = null,
  onRemoveMember,
  isRemovingMemberId = null,
}: ClubMembersTableProps) {
  const { t, i18n } = useTranslation()
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<ClubMemberDto | null>(null)

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
              {isClubAdmin && (onPromoteMember || onRemoveMember) && (
                <th
                  scope="col"
                  className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-aurora-text-muted"
                >
                  {t('members.columns.actions', 'Actions')}
                </th>
              )}
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
                  {isClubAdmin && (onPromoteMember || onRemoveMember) && (
                    <td className="whitespace-nowrap px-6 py-4 text-right text-xs">
                      <div className="flex items-center justify-end space-x-2">
                        {currentMemberId && member.memberId === currentMemberId ? (
                          <span
                            data-testid={`current-user-tag-${member.memberId}`}
                            className="text-xs text-aurora-text-muted italic"
                          >
                            {t('members.actions.you', 'You')}
                          </span>
                        ) : (
                          <>
                            {onPromoteMember && member.role === 'Club Member' && (
                              <button
                                type="button"
                                data-testid={`promote-member-${member.memberId}`}
                                disabled={isPromotingMemberId === member.memberId || isRemovingMemberId === member.memberId}
                                onClick={() => void onPromoteMember(member.memberId)}
                                className="btn-tactile inline-flex items-center gap-1.5 rounded-lg bg-aurora-primary/10 px-3 py-1.5 font-semibold text-aurora-primary ring-1 ring-aurora-primary/20 hover:bg-aurora-primary/20 disabled:opacity-50 cursor-pointer transition-colors"
                                aria-label={t('members.actions.promoteAria', { name: displayName })}
                              >
                                {isPromotingMemberId === member.memberId ? (
                                  <>
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span>{t('members.actions.promoting', 'Promoting…')}</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    <span>{t('members.actions.promote', 'Make Admin')}</span>
                                  </>
                                )}
                              </button>
                            )}
                            {onRemoveMember && (
                              <button
                                type="button"
                                data-testid={`remove-member-${member.memberId}`}
                                disabled={isPromotingMemberId === member.memberId || isRemovingMemberId === member.memberId}
                                onClick={() => setMemberPendingRemoval(member)}
                                className="btn-tactile inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 font-semibold text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 disabled:opacity-50 cursor-pointer transition-colors"
                                aria-label={t('members.actions.removeAria', { name: displayName })}
                              >
                                {isRemovingMemberId === member.memberId ? (
                                  <>
                                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span>{t('members.actions.removing', 'Removing…')}</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>{t('members.actions.remove', 'Remove')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {memberPendingRemoval && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-modal-title"
          data-testid="remove-member-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-aurora-surface p-6 shadow-xl ring-1 ring-aurora-border">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 id="remove-modal-title" className="text-lg font-bold text-aurora-text">
                {t('members.removeModal.title', 'Remove Member')}
              </h3>
            </div>
            <p className="mt-3 text-sm text-aurora-text-secondary leading-relaxed">
              {t(
                'members.removeModal.description',
                'Are you sure you want to remove this member from the club? They will immediately lose access to all club data and dashboards.',
                {
                  name: memberPendingRemoval.displayName?.trim() || memberPendingRemoval.email,
                }
              )}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                data-testid="cancel-remove-member-btn"
                onClick={() => setMemberPendingRemoval(null)}
                className="btn-tactile rounded-xl bg-aurora-elevated px-4 py-2 text-xs font-semibold text-aurora-text ring-1 ring-aurora-border hover:bg-aurora-border cursor-pointer transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                data-testid="confirm-remove-member-btn"
                disabled={isRemovingMemberId === memberPendingRemoval.memberId}
                onClick={async () => {
                  const idToRemove = memberPendingRemoval.memberId
                  setMemberPendingRemoval(null)
                  if (onRemoveMember) {
                    await onRemoveMember(idToRemove)
                  }
                }}
                className="btn-tactile rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-600 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {t('members.actions.confirmRemove', 'Remove Member')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
