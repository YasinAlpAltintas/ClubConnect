import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageToggle from './LanguageToggle'

const changeLanguageMock = vi.fn()
let currentLanguage = 'nl-BE'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'header.languageToggle' ? (currentLanguage === 'nl-BE' ? 'English' : 'Nederlands') : key),
    i18n: {
      get language() {
        return currentLanguage
      },
      changeLanguage: changeLanguageMock,
    },
  }),
}))

describe('LanguageToggle', () => {
  it('renders target language label and switches language when clicked', async () => {
    const user = userEvent.setup()
    currentLanguage = 'nl-BE'

    render(<LanguageToggle />)

    const toggleBtn = screen.getByRole('button', { name: /English/i })
    expect(toggleBtn).toBeInTheDocument()

    await user.click(toggleBtn)
    expect(changeLanguageMock).toHaveBeenCalledWith('en')
  })
})
