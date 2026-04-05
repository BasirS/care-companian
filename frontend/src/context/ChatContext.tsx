import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { sendChatMessage } from '../api/chat'
import { useAuth } from './AuthContext'

export interface Message {
  id: string
  role: 'user' | 'agent'
  text: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface ChatContextType {
  sessions: ChatSession[]
  activeSessionId: string | null
  activeSession: ChatSession | null
  messages: Message[]
  isLoading: boolean
  isEmergency: boolean
  sendMessage: (text: string) => Promise<void>
  sendSilentMessage: (text: string) => Promise<void>
  dismissEmergency: () => void
  clearMessages: () => void
  createNewSession: () => string
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
}

const ChatContext = createContext<ChatContextType>({
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  messages: [],
  isLoading: false,
  isEmergency: false,
  sendMessage: async () => {},
  sendSilentMessage: async () => {},
  dismissEmergency: () => {},
  clearMessages: () => {},
  createNewSession: () => '',
  switchSession: () => {},
  deleteSession: () => {},
  renameSession: () => {},
})

const EMERGENCY_TRIGGERS = [
  'call 911',
  'EMERGENCY WARNING',
  'go to the nearest ER',
  'call 911 or go',
]

function isEmergencyResponse(text: string): boolean {
  return EMERGENCY_TRIGGERS.some(trigger =>
    text.toLowerCase().includes(trigger.toLowerCase())
  )
}

let idCounter = 0
function newId(prefix = 'msg') {
  return `${prefix}_${++idCounter}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim()
  if (trimmed.length <= 42) return trimmed
  return trimmed.slice(0, 39) + '\u2026'
}

const SESSIONS_KEY = (userId?: string | number) =>
  userId ? `care_companion_chats_${userId}` : 'care_companion_chats'
const ACTIVE_KEY = (userId?: string | number) =>
  userId ? `care_companion_active_${userId}` : 'care_companion_active'

function loadSessions(userId?: string | number): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY(userId))
    if (!raw) return []
    return JSON.parse(raw) as ChatSession[]
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[], userId?: string | number) {
  try {
    localStorage.setItem(SESSIONS_KEY(userId), JSON.stringify(sessions))
  } catch {
    // Storage quota exceeded or unavailable
  }
}

function loadActiveId(userId?: string | number): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY(userId))
  } catch {
    return null
  }
}

function saveActiveId(id: string | null, userId?: string | number) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY(userId), id)
    } else {
      localStorage.removeItem(ACTIVE_KEY(userId))
    }
  } catch {
    // ignore
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.userId

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions(userId))
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(() => {
    const stored = loadSessions(userId)
    const savedActive = loadActiveId(userId)
    if (savedActive && stored.find(s => s.id === savedActive)) return savedActive
    return stored.length > 0 ? stored[0].id : null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)

  // Re-hydrate when user changes (login/logout)
  useEffect(() => {
    const stored = loadSessions(userId)
    setSessions(stored)
    const savedActive = loadActiveId(userId)
    if (savedActive && stored.find(s => s.id === savedActive)) {
      setActiveSessionIdState(savedActive)
    } else {
      setActiveSessionIdState(stored.length > 0 ? stored[0].id : null)
    }
  }, [userId])

  // Persist sessions whenever they change
  useEffect(() => {
    saveSessions(sessions, userId)
  }, [sessions, userId])

  // Persist active session id whenever it changes
  function setActiveSessionId(id: string | null) {
    setActiveSessionIdState(id)
    saveActiveId(id, userId)
  }

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  const messages = activeSession?.messages ?? []

  const createNewSession = useCallback((): string => {
    const id = newId('session')
    const session: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSessions(prev => [session, ...prev])
    setActiveSessionId(id)
    return id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setIsEmergency(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveSessions(next, userId)
      return next
    })
    setActiveSessionIdState(prev => {
      if (prev !== id) return prev
      const remaining = loadSessions(userId).filter(s => s.id !== id)
      const nextId = remaining.length > 0 ? remaining[0].id : null
      saveActiveId(nextId, userId)
      return nextId
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const renameSession = useCallback((id: string, title: string) => {
    setSessions(prev =>
      prev.map(s => s.id === id ? { ...s, title } : s)
    )
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = newId('session')
      const session: ChatSession = {
        id: sessionId,
        title: generateTitle(text),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setSessions(prev => [session, ...prev])
      setActiveSessionId(sessionId)
    }

    const userMsg: Message = { id: newId(), role: 'user', text, timestamp: Date.now() }
    const capturedId = sessionId

    setSessions(prev =>
      prev.map(s => {
        if (s.id !== capturedId) return s
        const isFirst = s.messages.length === 0
        return {
          ...s,
          title: isFirst ? generateTitle(text) : s.title,
          messages: [...s.messages, userMsg],
          updatedAt: Date.now(),
        }
      })
    )

    setIsLoading(true)

    try {
      const response = await sendChatMessage(text, user?.email, user?.name)
      const agentMsg: Message = { id: newId(), role: 'agent', text: response, timestamp: Date.now() }
      setSessions(prev =>
        prev.map(s =>
          s.id === capturedId
            ? { ...s, messages: [...s.messages, agentMsg], updatedAt: Date.now() }
            : s
        )
      )
      if (isEmergencyResponse(response)) {
        setIsEmergency(true)
      }
    } catch (err) {
      const errorMsg: Message = {
        id: newId(),
        role: 'agent',
        text: err instanceof Error ? `\u26a0\ufe0f ${err.message}` : '\u26a0\ufe0f Something went wrong. Please try again.',
        timestamp: Date.now(),
      }
      setSessions(prev =>
        prev.map(s =>
          s.id === capturedId
            ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
            : s
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function sendSilentMessage(text: string) {
    // Sends text to the agent but adds NO user bubble — only the agent reply appears
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = newId('session')
      const session: ChatSession = {
        id: sessionId,
        title: 'Discharge Summary',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setSessions(prev => [session, ...prev])
      setActiveSessionId(sessionId)
    }
    const capturedId = sessionId
    setIsLoading(true)
    try {
      const response = await sendChatMessage(text, user?.email, user?.name)
      const agentMsg: Message = { id: newId(), role: 'agent', text: response, timestamp: Date.now() }
      setSessions(prev =>
        prev.map(s =>
          s.id === capturedId
            ? { ...s, messages: [...s.messages, agentMsg], updatedAt: Date.now() }
            : s
        )
      )
      if (isEmergencyResponse(response)) setIsEmergency(true)
    } catch (err) {
      const errorMsg: Message = {
        id: newId(), role: 'agent',
        text: err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Something went wrong.',
        timestamp: Date.now(),
      }
      setSessions(prev =>
        prev.map(s =>
          s.id === capturedId
            ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
            : s
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  function dismissEmergency() { setIsEmergency(false) }
  function clearMessages() {
    if (!activeSessionId) return
    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
      )
    )
  }

  return (
    <ChatContext.Provider value={{
      sessions, activeSessionId, activeSession, messages,
      isLoading, isEmergency, sendMessage, sendSilentMessage, dismissEmergency,
      clearMessages, createNewSession, switchSession, deleteSession, renameSession,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  return useContext(ChatContext)
}
