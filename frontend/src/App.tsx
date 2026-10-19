import { useState, useEffect } from 'react'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import LobbyPage, { type AuthenticatedMember } from './pages/LobbyPage'
import {
  getTokenRemainingTimeMs,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  parseJwt,
  isTokenExpired,
} from './lib/jwt'

export type AppView = 'register' | 'login' | 'lobby'

export interface AppProps {
  initialView?: AppView
  initialMember?: AuthenticatedMember | null
  initialSessionExpired?: boolean
}

interface InitialAuthState {
  member: AuthenticatedMember | null
  sessionExpired: boolean
  view: AppView
}

function resolveInitialState(
  initialView?: AppView,
  initialMember?: AuthenticatedMember | null,
  initialSessionExpired = false
): InitialAuthState {
  if (initialMember !== undefined) {
    let resolvedView: AppView =
      initialView ?? (initialMember ? 'lobby' : initialSessionExpired ? 'login' : 'register')
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#login') resolvedView = 'login'
      else if (window.location.hash === '#lobby') resolvedView = 'lobby'
      else if (window.location.hash === '#register') resolvedView = 'register'
    }
    return {
      member: initialMember,
      sessionExpired: initialSessionExpired,
      view: resolvedView,
    }
  }

  const token = getStoredToken()
  let member: AuthenticatedMember | null = null
  let sessionExpired = initialSessionExpired

  if (token) {
    if (isTokenExpired(token)) {
      removeStoredToken()
      sessionExpired = true
    } else {
      const claims = parseJwt(token)
      if (claims?.sub && claims?.email) {
        member = {
          memberId: claims.sub,
          email: claims.email,
          displayName: claims.name || null,
          token,
        }
      } else {
        removeStoredToken()
      }
    }
  }

  let view: AppView = initialView ?? 'register'
  if (!initialView) {
    if (typeof window !== 'undefined' && window.location.hash === '#login') {
      view = 'login'
    } else if (typeof window !== 'undefined' && window.location.hash === '#lobby') {
      view = 'lobby'
    } else if (typeof window !== 'undefined' && window.location.hash === '#register') {
      view = 'register'
    } else if (member) {
      view = 'lobby'
    } else if (sessionExpired) {
      view = 'login'
    } else {
      view = 'register'
    }
  }

  return { member, sessionExpired, view }
}

export default function App({
  initialView,
  initialMember,
  initialSessionExpired = false,
}: AppProps = {}) {
  const [initial] = useState(() =>
    resolveInitialState(initialView, initialMember, initialSessionExpired)
  )

  const [member, setMember] = useState<AuthenticatedMember | null>(initial.member)
  const [sessionExpired, setSessionExpired] = useState(initial.sessionExpired)
  const [view, setView] = useState<AppView>(initial.view)

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
    removeStoredToken()
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

  if (view === 'lobby' && member) {
    return (
      <LobbyPage
        member={member}
        onLogout={() => {
          removeStoredToken()
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
          if (authMember.token) {
            setStoredToken(authMember.token)
          }
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
