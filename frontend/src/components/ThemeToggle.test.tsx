import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from './ThemeToggle'
import { THEME_STORAGE_KEY } from '../lib/useTheme'

describe('ThemeToggle component', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders theme toggle button with light action when in dark mode', () => {
    render(<ThemeToggle />)
    const button = screen.getByTestId('theme-toggle')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label')
  })

  it('switches to light mode on click and updates localStorage and document class', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = screen.getByTestId('theme-toggle')

    await user.click(button)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)

    await user.click(button)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
