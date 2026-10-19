import { useState, useEffect } from 'react'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import LobbyPage, { type AuthenticatedMember } from './pages/LobbyPage'

export type AppView = 'register' | 'login' | 'lobby'

export interface AppProps {
  initialView?: AppView
  initialMember?: AuthenticatedMember | null
}

export default function App({ initialView, initialMember = null }: AppProps = {}) {
  const [member, setMember] = useState<AuthenticatedMember | null>(initialMember)
  const [view, setView] = useState<AppView>(() => {
    if (initialView) return initialView
    if (typeof window !== 'undefined' && window.location.hash === '#login') {
      return 'login'
    }
    return 'register'
  })

  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash
      if (hash === '#login') {
        setView('login')
      } else if (hash === '#register') {
        setView('register')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function navigateTo(target: AppView) {
    setView(target)
    if (typeof window !== 'undefined') {
      window.location.hash = `#${target}`
    }
  }

  if (view === 'lobby' && member) {
    return (
      <LobbyPage
        member={member}
        onLogout={() => {
          setMember(null)
          navigateTo('login')
        }}
      />
    )
  }

  if (view === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(authMember) => {
          setMember(authMember)
          navigateTo('lobby')
        }}
        onNavigateToRegister={() => navigateTo('register')}
      />
    )
  }

  return (
    <RegisterPage
      onNavigateToLogin={() => navigateTo('login')}
    />
  )
}
