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
})
