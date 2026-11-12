import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface InviteCodeCardProps {
  code: string
  clubName?: string
  role?: string
  variant?: 'overview' | 'members'
  className?: string
}

/**
 * Reusable, accessible 6-digit invite code card.
 * Enforces admin visibility gating and provides one-click copy with feedback.
 */
export default function InviteCodeCard({
  code,
  clubName,
  role = 'Club Admin',
  variant = 'overview',
  className = '',
}: InviteCodeCardProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  // Auto-reset copied state after 2.5 seconds
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => {
      setCopied(false)
    }, 2500)
    return () => clearTimeout(timeout)
  }, [copied])

  // Strict role check: only Club Admin can see the invite code
  if (role !== 'Club Admin' || !code) {
    return null
  }

  async function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code)
        setCopied(true)
      } else {
        // Fallback for environments where Clipboard API is not available
        const textarea = document.createElement('textarea')
        textarea.value = code
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopied(true)
      }
    } catch {
      // In case copy fails (e.g. permission denied)
      setCopied(false)
    }
  }

  if (variant === 'members') {
    return (
      <div
        data-testid="members-invite-code-card"
        className={`rounded-2xl bg-aurora-surface p-5 ring-1 ring-aurora-border shadow-xs ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aurora-accent/15 text-aurora-accent text-xs">
                ✉️
              </span>
              <h2 className="text-sm font-semibold text-aurora-text">
                {t('members.invite.cardTitle')}
              </h2>
              <span className="rounded-full bg-aurora-elevated px-2 py-0.5 text-[10px] font-semibold text-aurora-accent ring-1 ring-aurora-border">
                {t('members.invite.adminOnlyBadge')}
              </span>
            </div>
            <p className="mt-1 text-xs text-aurora-text-secondary max-w-xl">
              {t('members.invite.cardDescription', { clubName: clubName || '' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              data-testid="invite-code-display"
              className="flex items-center gap-1.5 rounded-xl bg-aurora-elevated px-3.5 py-2 ring-1 ring-aurora-border"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-aurora-text-muted">
                {t('members.invite.codeLabel')}
              </span>
              <span
                data-testid="invite-code-value"
                className="font-mono text-base font-bold tracking-widest text-aurora-accent"
              >
                {code}
              </span>
            </div>

            <button
              type="button"
              data-testid="members-copy-invite-code"
              onClick={() => void handleCopy()}
              className="btn-tactile inline-flex items-center gap-1.5 rounded-xl bg-aurora-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 cursor-pointer transition-all"
              aria-label={t('members.invite.copyButton')}
            >
              {copied ? (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span data-testid="copy-feedback-message">{t('members.invite.copied')}</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{t('members.invite.copyButton')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default: Overview banner variant (backwards compatible with existing test IDs)
  return (
    <div
      data-testid="dashboard-invite-code-section"
      className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-aurora-elevated p-3 text-xs ring-1 ring-aurora-border ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-aurora-text-secondary">
          {t('lobby.inviteCodeBadge', { code })}
        </span>
      </div>
      <button
        type="button"
        data-testid="dashboard-copy-invite-code"
        onClick={() => void handleCopy()}
        className="btn-tactile inline-flex items-center gap-1.5 rounded-lg bg-aurora-surface px-3 py-1.5 font-semibold text-aurora-text shadow-xs ring-1 ring-aurora-border hover:bg-aurora-elevated cursor-pointer transition-colors"
      >
        {copied ? (
          <>
            <svg
              className="h-3.5 w-3.5 text-aurora-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{t('lobby.inviteCodeCopied')}</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5 text-aurora-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>{t('lobby.copyInviteCode')}</span>
          </>
        )}
      </button>
    </div>
  )
}
