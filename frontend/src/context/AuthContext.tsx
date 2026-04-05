import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface GoogleUser {
  name: string
  email: string
  picture: string
  token: string
  userId: number
  onboarded: boolean
}

interface AuthContextType {
  user: GoogleUser | null
  signOut: () => void
  setOnboarded: (val: boolean) => void
  signInWithPassword: (email: string, password: string) => Promise<void>
  registerWithPassword: (name: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  signOut: () => {},
  setOnboarded: () => {},
  signInWithPassword: async () => {},
  registerWithPassword: async () => {},
})

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, config: object) => void
          prompt: () => void
          disableAutoSelect: () => void
          revoke: (email: string, done: () => void) => void
        }
      }
    }
  }
}

function decodeJwt(token: string) {
  const payload = JSON.parse(atob(token.split('.')[1]))
  return { name: payload.name as string, email: payload.email as string, picture: payload.picture as string }
}

const STORAGE_KEY = 'cc_user'

function makePasswordUser(data: { user_id: number; name: string; email: string; onboarded: boolean }): GoogleUser {
  return {
    name: data.name,
    email: data.email,
    picture: '',
    token: '',
    userId: data.user_id,
    onboarded: data.onboarded,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => { fetch('/health').catch(() => {}) }, [])

  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    async function handleCredential(response: { credential: string }) {
      try {
        const { name, email, picture } = decodeJwt(response.credential)
        const res = await fetch(`/user-by-email/${encodeURIComponent(email)}`)
        if (!res.ok) throw new Error(`Backend error: ${res.status}`)
        const data = await res.json()
        const fullUser: GoogleUser = {
          name, email, picture,
          token: response.credential,
          userId: data.user_id,
          onboarded: data.onboarded,
        }
        setUser(fullUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
      } catch (err) {
        console.error('Sign-in failed:', err)
      }
    }

    function initGsi() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      })
    }

    if (window.google?.accounts?.id) {
      initGsi()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initGsi()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [])

  async function parseErrorResponse(res: Response, fallback: string): Promise<never> {
    try {
      const body = await res.text()
      const json = body ? JSON.parse(body) : null
      throw new Error(json?.detail || fallback)
    } catch (e) {
      if (e instanceof Error && e.message !== fallback) throw e
      throw new Error(`${fallback} (HTTP ${res.status})`)
    }
  }

  async function signInWithPassword(email: string, password: string) {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) await parseErrorResponse(res, 'Login failed')
    const data = await res.json()
    const fullUser = makePasswordUser(data)
    setUser(fullUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
  }

  async function registerWithPassword(name: string, email: string, password: string) {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) await parseErrorResponse(res, 'Registration failed')
    const data = await res.json()
    const fullUser = makePasswordUser(data)
    setUser(fullUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullUser))
  }

  function signOut() {
    if (user && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
      window.google.accounts.id.revoke(user.email, () => {})
    }
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  function setOnboarded(val: boolean) {
    if (!user) return
    const updated = { ...user, onboarded: val }
    setUser(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, signOut, setOnboarded, signInWithPassword, registerWithPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
