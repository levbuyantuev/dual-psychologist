import React, { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

const Logo = () => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="36" y2="36">
        <stop offset="0%" stopColor="#6366f1"/>
        <stop offset="100%" stopColor="#a78bfa"/>
      </linearGradient>
    </defs>
    <circle cx="18" cy="18" r="17" fill="url(#logoGrad)"/>
    <path d="M12 18C12 13 18 10 18 18C18 10 24 13 24 18C24 23 18 27 18 27C18 27 12 23 12 18Z" fill="white" fillOpacity="0.9"/>
  </svg>
)

const EmptyIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <path d="M20 32C20 25 32 20 32 32C32 20 44 25 44 32C44 39 32 48 32 48C32 48 20 39 20 32Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
  </svg>
)

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem('dual-psy-sessions')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem('dual-psy-sessions', JSON.stringify(sessions))
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(loadSessions)
  const [currentId, setCurrentId] = useState<string | null>(sessions[0]?.id ?? null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentSession = sessions.find(s => s.id === currentId) ?? null

  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [currentSession?.messages])

  const createSession = useCallback(() => {
    const session: Session = {
      id: generateId(),
      title: 'Новая сессия',
      messages: [],
      createdAt: new Date().toISOString(),
    }
    setSessions(prev => [session, ...prev])
    setCurrentId(session.id)
    setSidebarOpen(false)
  }, [])

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) => {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s))
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    let sessionId = currentId
    if (!sessionId) {
      const session: Session = {
        id: generateId(),
        title: text.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
      }
      setSessions(prev => [session, ...prev])
      sessionId = session.id
      setCurrentId(session.id)
    }

    const userMsg: Message = { role: 'user', content: text }
    setInput('')

    updateSession(sessionId, s => {
      const updated = { ...s, messages: [...s.messages, userMsg] }
      if (s.messages.length === 0) updated.title = text.slice(0, 50)
      return updated
    })

    setIsLoading(true)

    try {
      const allMessages = [...(sessions.find(s => s.id === sessionId)?.messages ?? []), userMsg]
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const assistantMsg: Message = { role: 'assistant', content: data.content }

      updateSession(sessionId, s => ({ ...s, messages: [...s.messages, assistantMsg] }))
    } catch (err: any) {
      const errorMsg: Message = { role: 'assistant', content: `Ошибка: ${err.message}. Попробуйте ещё раз.` }
      updateSession(sessionId, s => ({ ...s, messages: [...s.messages, errorMsg] }))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, currentId, sessions, updateSession])

  const runAnalysis = useCallback(async () => {
    if (!currentSession || currentSession.messages.length < 3 || isAnalyzing) return
    setIsAnalyzing(true)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentSession.messages }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAnalysisResult(data.content)
    } catch (err: any) {
      setAnalysisResult(`Ошибка анализа: ${err.message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [currentSession, isAnalyzing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 150) + 'px'
    }
  }

  const canAnalyze = currentSession && currentSession.messages.filter(m => m.role === 'user').length >= 3

  return (
    <div className="app">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Logo />
            <h1>Дуальный Психолог<span>AI-ассистент</span></h1>
          </div>
          <button className="btn-new-session" onClick={createSession}>+ Новая сессия</button>
        </div>

        <div className="sidebar-sessions">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${s.id === currentId ? 'active' : ''}`}
              onClick={() => { setCurrentId(s.id); setSidebarOpen(false) }}
            >
              <div className="session-item-title">{s.title}</div>
              <div className="session-item-date">{formatDate(s.createdAt)} · {s.messages.length} сообщ.</div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Нет сессий. Начните новую.
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          Не заменяет профессиональную психотерапию.<br/>
          Телефон доверия: 8-800-2000-122
        </div>
      </aside>

      <main className="main">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="chat-header-title">
              {currentSession ? currentSession.title : 'Дуальный Психолог'}
            </span>
          </div>
          {canAnalyze && (
            <button className="btn-analyze" onClick={runAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? 'Анализирую...' : '✦ Анализ дуальности'}
            </button>
          )}
        </div>

        <div className="messages">
          {(!currentSession || currentSession.messages.length === 0) ? (
            <div className="messages-empty">
              <EmptyIcon />
              <h2>Добро пожаловать</h2>
              <p>
                Я помогу вам разобраться с внутренними противоречиями и дуальностями.
                Расскажите, что вас беспокоит, и мы вместе найдём путь к гармонии.
              </p>
            </div>
          ) : (
            currentSession.messages.map((msg, i) => (
              <div key={i} className="message">
                <div className={`message-avatar ${msg.role}`}>
                  {msg.role === 'user' ? 'Я' : 'Ψ'}
                </div>
                <div className="message-body">
                  <div className="message-role">{msg.role === 'user' ? 'Вы' : 'Психолог'}</div>
                  <div className="message-content">{msg.content}</div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message">
              <div className="message-avatar assistant">Ψ</div>
              <div className="message-body">
                <div className="message-role">Психолог</div>
                <div className="typing"><span/><span/><span/></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-wrapper">
          <div className="chat-input">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize() }}
              onKeyDown={handleKeyDown}
              placeholder="Расскажите, что вас беспокоит..."
              rows={1}
              disabled={isLoading}
            />
            <button className="btn-send" onClick={sendMessage} disabled={!input.trim() || isLoading}>
              Отправить
            </button>
          </div>
          <div className="disclaimer">
            AI-ассистент не заменяет профессиональную психотерапию. В экстренных случаях звоните: 8-800-2000-122
          </div>
        </div>
      </main>

      {analysisResult && (
        <div className="modal-overlay" onClick={() => setAnalysisResult(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✦ Анализ дуальности</h2>
              <button className="btn-close" onClick={() => setAnalysisResult(null)}>×</button>
            </div>
            <div className="modal-body">{analysisResult}</div>
          </div>
        </div>
      )}
    </div>
  )
}
