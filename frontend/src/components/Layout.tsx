import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

const NAV_ITEMS = [
  { path: '/dashboard',    icon: '🏠', label: 'Dashboard' },
  { path: '/chat',         icon: '💬', label: 'Chat' },
  { path: '/symptoms',     icon: '🩺', label: 'Symptoms' },
  { path: '/medications',  icon: '💊', label: 'Medications' },
  { path: '/appointments', icon: '📅', label: 'Appointments' },
  { path: '/summaries',    icon: '📊', label: 'Summaries' },
  { path: '/profile',      icon: '👤', label: 'Profile' },
]

function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const { sessions, activeSessionId, createNewSession, switchSession, deleteSession, renameSession } = useChat()
  const location = useLocation()
  const navigate = useNavigate()
  const isChat = location.pathname === '/chat'

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const currentPage = NAV_ITEMS.find(n => n.path === location.pathname)

  function handleNewChat() {
    createNewSession()
    navigate('/chat')
  }

  function handleSwitchSession(id: string) {
    switchSession(id)
    navigate('/chat')
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id)
    setRenameValue(currentTitle)
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed) renameSession(id, trimmed)
    setRenamingId(null)
  }

  function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    deleteSession(id)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{
        width: isChat ? 210 : 232,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 16px',
        boxShadow: '2px 0 8px rgba(10,37,64,0.04)',
        transition: 'width 0.2s ease',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '20px 16px 18px',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--navy)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🏥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 14, fontWeight: 700,
              color: 'var(--navy)', letterSpacing: '-0.2px', lineHeight: 1.1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>CareCompanion</div>
            {!isChat && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Healthcare Assistant</div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '4px 10px' }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: isChat ? '8px 10px' : '10px 12px',
                  borderRadius: 10, border: 'none',
                  background: active ? 'var(--blue-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginBottom: 2,
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--surface-2)'
                    e.currentTarget.style.color = 'var(--navy)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Chat history panel — only shown on /chat */}
        {isChat && (
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            borderTop: '1px solid var(--border-light)',
            minHeight: 0,
            marginTop: 6,
          }}>
            {/* Header + New Chat button */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px 6px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                History
              </span>
              <button
                onClick={handleNewChat}
                title="New chat"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--navy)', border: 'none',
                  borderRadius: 7, padding: '4px 9px',
                  color: '#fff', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New
              </button>
            </div>

            {/* Sessions list */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '2px 8px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border) transparent',
            }}>
              {sessions.length === 0 ? (
                <div style={{
                  padding: '20px 8px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-light)',
                  lineHeight: 1.6,
                }}>
                  No chats yet.<br />Start a new conversation!
                </div>
              ) : (
                sessions.map(session => {
                  const isActive = session.id === activeSessionId
                  const isHovered = hoveredSessionId === session.id
                  const isRenaming = renamingId === session.id
                  return (
                    <div
                      key={session.id}
                      onClick={() => !isRenaming && handleSwitchSession(session.id)}
                      onMouseEnter={() => setHoveredSessionId(session.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        padding: '8px 10px',
                        marginBottom: 2,
                        borderRadius: 9,
                        background: isActive ? 'var(--blue-light)' : isHovered ? 'var(--surface-2)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                        cursor: isRenaming ? 'default' : 'pointer',
                        transition: 'background 0.12s',
                        position: 'relative',
                      }}
                    >
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(session.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(session.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            width: '100%',
                            fontSize: 12, fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            background: 'var(--surface)',
                            border: '1.5px solid var(--accent)',
                            borderRadius: 5,
                            padding: '2px 5px',
                            color: 'var(--navy)',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 4,
                        }}>
                          <span style={{
                            fontSize: 12, fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--accent)' : 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1, lineHeight: 1.35,
                          }}>
                            {session.title}
                          </span>

                          {/* Action buttons on hover */}
                          {(isHovered || isActive) && (
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button
                                title="Rename"
                                onClick={() => startRename(session.id, session.title)}
                                style={{
                                  width: 20, height: 20, borderRadius: 4,
                                  background: 'transparent', border: 'none',
                                  cursor: 'pointer', fontSize: 10,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--text-muted)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--navy)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                              >✏️</button>
                              <button
                                title="Delete"
                                onClick={e => handleDeleteSession(e, session.id)}
                                style={{
                                  width: 20, height: 20, borderRadius: 4,
                                  background: 'transparent', border: 'none',
                                  cursor: 'pointer', fontSize: 10,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--text-muted)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                              >🗑️</button>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{
                        fontSize: 10, color: 'var(--text-light)',
                        marginTop: 2, lineHeight: 1.2,
                      }}>
                        {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''} · {formatRelativeTime(session.updatedAt)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* If not on chat, fill space so user section stays at bottom */}
        {!isChat && <div style={{ flex: 1 }} />}

        {/* User section at bottom of sidebar */}
        {user && (
          <div style={{
            margin: '8px 10px 0',
            padding: '12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <img
                src={user.picture}
                alt={user.name}
                onClick={() => navigate('/profile')}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: '2px solid var(--border)',
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => { signOut(); navigate('/') }}
              style={{
                width: '100%', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px', fontSize: 12, fontWeight: 500,
                color: 'var(--text-muted)', cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top header */}
        <header style={{
          height: 60,
          flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 28px',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
          zIndex: 10,
        }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 18, fontWeight: 700,
            color: 'var(--navy)', letterSpacing: '-0.3px',
            flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentPage?.label || 'CareCompanion'}
          </h1>

          {user && (
            <img
              src={user.picture}
              alt={user.name}
              onClick={() => navigate('/profile')}
              title="View Profile"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                border: '2px solid var(--border)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          )}
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 32px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
