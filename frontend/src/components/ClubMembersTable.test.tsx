import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ClubMembersTable from './ClubMembersTable'
import { type ClubMemberDto } from '../lib/api'

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal ?? key,
    i18n: { language: 'en' },
  }),
}))

describe('ClubMembersTable', () => {
  const sampleMembers: ClubMemberDto[] = [
    {
      memberId: 'm-1',
      displayName: 'Alice Admin',
      email: 'alice@example.com',
      role: 'Club Admin',
      joinedAtUtc: '2026-01-15T10:00:00Z',
    },
    {
      memberId: 'm-2',
      displayName: '',
      email: 'bob@example.com',
      role: 'Club Member',
      joinedAtUtc: '2026-02-20T14:30:00Z',
    },
  ]

  it('renders loading skeleton when isLoading is true', () => {
    render(<ClubMembersTable members={[]} isLoading={true} />)
    expect(screen.getByTestId('members-loading')).toBeInTheDocument()
  })

  it('renders error state and triggers onRetry callback', () => {
    const handleRetry = vi.fn()
    render(
      <ClubMembersTable
        members={[]}
        isError={true}
        errorMessage="Failed to fetch members"
        onRetry={handleRetry}
      />
    )

    expect(screen.getByTestId('members-error')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch members')).toBeInTheDocument()

    const retryBtn = screen.getByTestId('members-retry-btn')
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledOnce()
  })

  it('renders empty state when members list is empty', () => {
    render(<ClubMembersTable members={[]} />)
    expect(screen.getByTestId('members-empty')).toBeInTheDocument()
    expect(screen.getByText('No members yet')).toBeInTheDocument()
  })

  it('renders members table with headers and rows for all members', () => {
    render(<ClubMembersTable members={sampleMembers} />)

    expect(screen.getByTestId('club-members-table')).toBeInTheDocument()

    // Headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Joined')).toBeInTheDocument()

    // Member 1 (Admin)
    expect(screen.getByTestId('member-row-m-1')).toBeInTheDocument()
    expect(screen.getByTestId('member-name-m-1')).toHaveTextContent('Alice Admin')
    expect(screen.getByTestId('member-email-m-1')).toHaveTextContent('alice@example.com')
    expect(screen.getByTestId('member-role-m-1')).toHaveTextContent('dashboard.roleAdmin')

    // Member 2 (Bob with empty displayName falls back to email)
    expect(screen.getByTestId('member-row-m-2')).toBeInTheDocument()
    expect(screen.getByTestId('member-name-m-2')).toHaveTextContent('bob@example.com')
    expect(screen.getByTestId('member-email-m-2')).toHaveTextContent('bob@example.com')
    expect(screen.getByTestId('member-role-m-2')).toHaveTextContent('dashboard.roleMember')
  })

  it('renders Make Admin button for Club Member when isClubAdmin is true', () => {
    const handlePromote = vi.fn()
    render(
      <ClubMembersTable
        members={sampleMembers}
        isClubAdmin={true}
        onPromoteMember={handlePromote}
      />
    )

    // Actions header is present
    expect(screen.getByText('Actions')).toBeInTheDocument()

    // Promote button exists for Bob (Club Member)
    const promoteBobBtn = screen.getByTestId('promote-member-m-2')
    expect(promoteBobBtn).toBeInTheDocument()
    expect(promoteBobBtn).toHaveTextContent('Make Admin')

    // Promote button does NOT exist for Alice (already Club Admin)
    expect(screen.queryByTestId('promote-member-m-1')).not.toBeInTheDocument()

    // Clicking promote button calls handler
    fireEvent.click(promoteBobBtn)
    expect(handlePromote).toHaveBeenCalledWith('m-2')
  })

  it('does not render Actions column when isClubAdmin is false', () => {
    render(<ClubMembersTable members={sampleMembers} isClubAdmin={false} />)
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('promote-member-m-2')).not.toBeInTheDocument()
  })

  it('shows loading state on promote button when promotion is in flight', () => {
    render(
      <ClubMembersTable
        members={sampleMembers}
        isClubAdmin={true}
        onPromoteMember={vi.fn()}
        isPromotingMemberId="m-2"
      />
    )

    const promoteBobBtn = screen.getByTestId('promote-member-m-2')
    expect(promoteBobBtn).toBeDisabled()
    expect(promoteBobBtn).toHaveTextContent('Promoting…')
  })
})
