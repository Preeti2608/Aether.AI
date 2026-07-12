import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import TextareaAutosize from 'react-textarea-autosize'
import toast from 'react-hot-toast'
import {
  Send, Plus, Trash2, Copy, RefreshCw, Bot, User, MessageSquare,
  Brain, Loader2, CheckCheck, Pencil, X, Zap
} from 'lucide-react'
import { chatApi } from '../services/api'
import { useAppStore } from '../store/appStore'
import { cn, timeAgo, copyToClipboard } from '../utils/helpers'

interface Message { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
interface Session { id: string; title: string; model: string; message_count: number; created_at: string; updated_at: string }

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

function friendlyError(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('timeout') || r.includes('timed out'))
    return 'The model is taking longer than expected. Try asking a shorter question or wait a moment.'
  if (r.includes('503') || r.includes('service unavailable') || r.includes('ollama'))
    return 'Ollama is not responding. Make sure it is running with `ollama serve`.'
  if (r.includes('404'))
    return 'Session not found. Please start a new chat.'
  if (r.includes('network') || r.includes('failed to fetch') || r.includes('econnrefused'))
    return 'Cannot reach the backend. Is it running on port 8000?'
  return 'Something went wrong. Please try again.'
}

export default function Chat() {
  const { sessionId: paramSessionId } = useParams()
  const navigate = useNavigate()
  const { selectedModel, theme, activeChatSession, setActiveChatSession } = useAppStore()

  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Thinking…')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const currentSessionId = paramSessionId || activeChatSession

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => {
    if (currentSessionId) fetchMessages(currentSessionId)
    else setMessages([])
  }, [currentSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingContent])

  async function fetchSessions() {
    try {
      const res = await chatApi.getSessions()
      setSessions(res.data)
    } catch { /* ignore */ }
  }

  async function fetchMessages(sid: string) {
    setLoadingMessages(true)
    try {
      const res = await chatApi.getMessages(sid)
      setMessages(res.data)
    } catch { setMessages([]) }
    finally { setLoadingMessages(false) }
  }

  async function createNewSession() {
    try {
      const res = await chatApi.createSession({ title: 'New Chat', model: selectedModel })
      const session = res.data
      setSessions(prev => [session, ...prev])
      setActiveChatSession(session.id)
      navigate(`/chat/${session.id}`)
      setMessages([])
    } catch (e: any) { toast.error(friendlyError(e.message)) }
  }

  async function deleteSession(id: string) {
    try {
      await chatApi.deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (currentSessionId === id) {
        setActiveChatSession(null)
        navigate('/chat')
        setMessages([])
      }
      toast.success('Chat deleted')
    } catch (e: any) { toast.error(friendlyError(e.message)) }
  }

  // ── Streaming send ────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || loading) return
    const content = input.trim()
    setInput('')
    setLoading(true)
    setStreamingContent('')
    setIsStreaming(false)

    // Optimistic user message
    const tempId = `temp-${Date.now()}`
    const tempUserMsg: Message = { id: tempId, role: 'user', content, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, tempUserMsg])

    if (useMemory) {
      setLoadingStatus('Searching memories…')
      await new Promise(r => setTimeout(r, 400)) // let user see the status
    }
    setLoadingStatus('Thinking…')

    abortRef.current = new AbortController()

    try {
      const body = {
        content,
        session_id: currentSessionId || undefined,
        model: selectedModel,
        use_memory: useMemory,
      }

      const response = await fetch(`${BASE_URL}/chat/send/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let sessionId = currentSessionId

      setIsStreaming(true)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) throw new Error(data.error)
            if (data.token) {
              accumulated += data.token
              setStreamingContent(accumulated)
            }
            if (data.session_id) sessionId = data.session_id
            if (data.done) break
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr
          }
        }
      }

      // Finalise: replace temp message, add AI response
      const now = new Date().toISOString()
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: `user-${Date.now()}`, role: 'user', content, created_at: tempUserMsg.created_at },
        { id: `ai-${Date.now()}`, role: 'assistant', content: accumulated, created_at: now },
      ])
      setStreamingContent('')
      setIsStreaming(false)

      if (sessionId && (!currentSessionId || currentSessionId !== sessionId)) {
        setActiveChatSession(sessionId)
        navigate(`/chat/${sessionId}`, { replace: true })
      }
      fetchSessions()
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // User cancelled
        setMessages(prev => prev.filter(m => m.id !== tempId))
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        toast.error(friendlyError(e.message || ''))
      }
      setStreamingContent('')
      setIsStreaming(false)
    } finally {
      setLoading(false)
      abortRef.current = null
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function cancelStream() {
    abortRef.current?.abort()
  }

  async function regenerateLastMessage() {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUser) return
    setMessages(prev => prev.filter(m => m.id !== messages[messages.length - 1]?.id))
    setInput(lastUser.content)
  }

  async function copyMessage(id: string, content: string) {
    await copyToClipboard(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function updateTitle(id: string) {
    if (!newTitle.trim()) return
    try {
      await chatApi.updateTitle(id, newTitle.trim())
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle.trim() } : s))
      setEditingTitle(null)
    } catch (e: any) { toast.error(friendlyError(e.message)) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-[#0a0a14]">
      {/* Sessions sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1a1a2e]">
          <button onClick={createNewSession} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => { setActiveChatSession(session.id); navigate(`/chat/${session.id}`) }}
                className={cn(
                  'group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-colors',
                  currentSessionId === session.id
                    ? 'bg-aether-50 dark:bg-aether-950/40 text-aether-700 dark:text-aether-300'
                    : 'hover:bg-gray-50 dark:hover:bg-[#1a1a2e] text-gray-700 dark:text-gray-400'
                )}
              >
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingTitle === session.id ? (
                    <input
                      className="input text-sm py-0.5 px-1 h-6 w-full"
                      value={newTitle}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') updateTitle(session.id); if (e.key === 'Escape') setEditingTitle(null) }}
                      onBlur={() => updateTitle(session.id)}
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm font-medium truncate">{session.title}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{timeAgo(session.updated_at)}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingTitle(session.id); setNewTitle(session.title) }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#26263a] text-gray-400">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteSession(session.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!currentSessionId && messages.length === 0 ? (
          // Welcome screen
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-lg animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                Hello, I'm <span className="gradient-text">Aether</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg">
                Your privacy-first AI second brain. Running fully offline on your device.
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: '💡', label: 'Explain quantum computing', desc: 'Science & concepts' },
                  { icon: '✍️', label: 'Write a cover letter', desc: 'Writing & editing' },
                  { icon: '🔧', label: 'Debug my Python code', desc: 'Programming help' },
                  { icon: '📚', label: 'Summarize this topic', desc: 'Research & learning' },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => setInput(s.label)}
                    className="card p-3 text-left hover:border-aether-300 dark:hover:border-aether-700 transition-colors group"
                  >
                    <span className="text-xl mb-1 block">{s.icon}</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Messages
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-aether-500" />
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1',
                        msg.role === 'user'
                          ? 'bg-aether-100 dark:bg-aether-900/40'
                          : 'bg-gradient-to-br from-aether-500 to-purple-600 shadow-glow-sm'
                      )}>
                        {msg.role === 'user'
                          ? <User className="w-4 h-4 text-aether-600 dark:text-aether-400" />
                          : <Bot className="w-4 h-4 text-white" />}
                      </div>

                      {/* Bubble */}
                      <div className={cn('group max-w-[75%] flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                        <div className={cn(
                          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-aether-600 text-white rounded-tr-sm'
                            : 'bg-white dark:bg-[#11111e] border border-gray-200 dark:border-[#26263a] text-gray-800 dark:text-gray-200 rounded-tl-sm'
                        )}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ node, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const isBlock = !props.inline
                                    return isBlock && match ? (
                                      <SyntaxHighlighter
                                        style={theme === 'dark' ? oneDark : oneLight}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-xl text-xs !mt-2 !mb-2"
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    ) : (
                                      <code className={className} {...props}>{children}</code>
                                    )
                                  },
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyMessage(msg.id, msg.content)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            {copiedId === msg.id ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {msg.role === 'assistant' && (
                            <button onClick={regenerateLastMessage}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-xs text-gray-400 px-1">{timeAgo(msg.created_at)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Streaming response bubble */}
                {isStreaming && streamingContent && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="max-w-[75%] bg-white dark:bg-[#11111e] border border-gray-200 dark:border-[#26263a] rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Typing / status indicator */}
                {loading && !streamingContent && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white dark:bg-[#11111e] border border-gray-200 dark:border-[#26263a] rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                        <span className="text-xs text-gray-400 ml-1">{loadingStatus}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] p-4">
          <div className="max-w-4xl mx-auto">
            <div className="card p-2 flex items-end gap-3">
              <TextareaAutosize
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Aether… (Shift+Enter for new line)"
                className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 px-2 py-1.5 max-h-40"
                minRows={1}
                maxRows={6}
                disabled={loading}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setUseMemory(!useMemory)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                    useMemory
                      ? 'bg-aether-100 dark:bg-aether-950/40 text-aether-700 dark:text-aether-400'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a2e]'
                  )}
                  title={useMemory ? 'Memory enabled — auto-saving facts' : 'Memory disabled'}
                  disabled={loading}
                >
                  <Brain className="w-3.5 h-3.5" />
                  {useMemory ? 'Memory On' : 'Memory Off'}
                </button>

                {loading ? (
                  <button
                    onClick={cancelStream}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all"
                    title="Stop generating"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                      input.trim()
                        ? 'bg-aether-600 hover:bg-aether-700 text-white shadow-glow-sm'
                        : 'bg-gray-200 dark:bg-[#1a1a2e] text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-gray-400 dark:text-gray-600">
                Running locally via Ollama — your conversations never leave your device
              </p>
              {useMemory && (
                <p className="text-xs text-aether-500 dark:text-aether-600 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Auto-saving memories
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
