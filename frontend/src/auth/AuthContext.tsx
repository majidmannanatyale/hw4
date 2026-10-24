import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  fetchMe,
  loginAccount,
  registerAccount,
  type AccountUser,
  type AuthResult,
  type RegisterInput,
} from '../api'

interface AuthContextValue {
  user: AccountUser | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (input: RegisterInput) => Promise<AuthResult>
  logout: () => void
}

const STORAGE_KEY = 'campus-customs-auth'

interface Stored {
  user: AccountUser
  token: string
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Stored | null>(load)
  const [ready, setReady] = useState(false)

  // On load, re-validate the stored token with the backend so a stale/expired one logs out cleanly.
  useEffect(() => {
    const stored = load()
    if (!stored) {
      setReady(true)
      return
    }
    let alive = true
    fetchMe(stored.token).then((user) => {
      if (!alive) return
      if (user) setSession({ user, token: stored.token })
      else {
        localStorage.removeItem(STORAGE_KEY)
        setSession(null)
      }
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const persist = (result: AuthResult) => {
    const stored: Stored = { user: result.user, token: result.token }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setSession(stored)
    return result
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    ready,
    login: (email, password) => loginAccount(email, password).then(persist),
    register: (input) => registerAccount(input).then(persist),
    logout: () => {
      localStorage.removeItem(STORAGE_KEY)
      setSession(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
