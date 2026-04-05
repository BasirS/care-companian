import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'

type Tab = 'password' | 'google'
type Mode = 'login' | 'register'

export default function Login() {
  const { user, signInWithPassword, registerWithPassword } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('password')
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
      } else {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return }
        await registerWithPassword(name.trim(), email, password)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    color: 'var(--text)',
    background: 'var(--bg)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #e8f4fd 0%, #f0f6fb 50%, #e6eef8 100%)',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '48px 40px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56,
          background: 'var(--navy)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
          margin: '0 auto 20px',
          boxShadow: '0 4px 16px rgba(10,37,64,0.2)',
        }}>🏥</div>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--navy)',
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 6,
        }}>
          {mode === 'login' ? 'Welcome back' : 'Create an account'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
          {mode === 'login' ? 'Sign in to access your care dashboard' : 'Get started with CareCompanion'}
        </p>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 28,
          gap: 4,
        }}>
          {([['password', '✉️ Email & Password'], ['google', '🔵 Google']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 9,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: tab === t ? 'var(--surface)' : 'transparent',
                color: tab === t ? 'var(--navy)' : 'var(--text-muted)',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              }}
            >{label}</button>
          ))}
        </div>

        {tab === 'password' ? (
          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            {mode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Full name
                </label>
                <input
                  style={inputStyle}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Email address
              </label>
              <input
                style={inputStyle}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)',
                  }}
                >{showPassword ? '🙈' : '👁️'}</button>
              </div>
              {mode === 'register' && (
                <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>Minimum 8 characters</p>
              )}
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 13, color: 'var(--danger)', textAlign: 'center',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 0',
                background: loading ? 'var(--text-light)' : 'var(--navy)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    Create one →
                  </button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    Sign in →
                  </button>
                </>
              )}
            </p>
          </form>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Continue with your Google account
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleSignInButton />
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-light)', lineHeight: 1.7, marginTop: 24, padding: '0 8px' }}>
          🔒 Your health data is private and encrypted. We never share your information.
        </p>
      </div>

      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute', top: 24, left: 24,
          background: 'rgba(255,255,255,0.8)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: 'var(--shadow-sm)',
        }}
      >← Back</button>
    </div>
  )
}
