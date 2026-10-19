import { useState, useEffect } from 'react'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import LobbyPage, { type AuthenticatedMember } from './pages/LobbyPage'
import { getTokenRemainingTimeMs } from './lib/jwt'
import { logoutMember } from './lib/api'

export type AppView = 'register' | 'login' | 'lobby'

export interface AppProps {
  initialView?: AppView
  initialMember?: AuthenticatedMember | null
  initialSessionExpired?: boolean
}

export default function App({
  initialView,
  initialMember = null,
  initialSessionExpired = false,
}: AppProps = {}) {
  const [member, setMember] = useState<AuthenticatedMember | null>(initialMember)
  const [sessionExpired, setSessionExpired] = useState(initialSessionExpired)
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
      } else if (hash === '#lobby') {
        setView('lobby')
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

  function handleExpireSession() {
    setMember(null)
    setSessionExpired(true)
    navigateTo('login')
  }

  useEffect(() => {
    if (!member?.token || view !== 'lobby') {
      return
    }

    const remainingMs = getTokenRemainingTimeMs(member.token)
    const timer = setTimeout(() => {
      handleExpireSession()
    }, remainingMs)

    return () => clearTimeout(timer)
  }, [member, view])

  if (view === 'lobby') {
    if (!member) {
      return (
        <LoginPage
          sessionExpired={sessionExpired}
          onLoginSuccess={(authMember) => {
            setSessionExpired(false)
            setMember(authMember)
            navigateTo('lobby')
          }}
          onNavigateToRegister={() => {
            setSessionExpired(false)
            navigateTo('register')
          }}
        />
      )
    }

    return (
      <LobbyPage
        member={member}
        onLogout={() => {
          if (member?.token) {
            void logoutMember(member.token)
          }
          setMember(null)
          setSessionExpired(false)
          navigateTo('login')
        }}
        onSessionExpired={handleExpireSession}
      />
    )
  }

  if (view === 'login') {
    return (
      <LoginPage
        sessionExpired={sessionExpired}
        onLoginSuccess={(authMember) => {
          setSessionExpired(false)
          setMember(authMember)
          navigateTo('lobby')
        }}
        onNavigateToRegister={() => {
          setSessionExpired(false)
          navigateTo('register')
        }}
      />
    )
  }

  return (
    <RegisterPage
      onNavigateToLogin={() => {
        setSessionExpired(false)
        navigateTo('login')
      }}
    />
  )
}
