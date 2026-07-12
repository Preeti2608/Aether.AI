import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileSearch, Upload, Trash2, Send, Bot, Loader2, X,
  FileText, BookOpen, CheckCircle2, AlertCircle,
  Sparkles, CheckCheck
} from 'lucide-react'
import { documentsApi } from '../services/api'
import { useAppStore } from '../store/appStore'
import { cn, formatBytes, timeAgo, copyToClipboard } from '../utils/helpers'

interface Document {
  id: string; filename: string; original_name: string
  file_size: number; page_count: number; status: string
  chunk_count: number; summary?: string; created_at: string
}
interface Message { role: 'user' | 'assistant'; content: string; sources?: Array<{ chunk: string; relevance: number }> }

type UploadStage = 'idle' | 'uploading' | 'processing' | 'embedding' | 'ready'

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  uploading: 'Uploading…',
  processing: 'Processing PDF…',
  embedding: 'Generating embeddings…',
  ready: 'Ready!',
}

const CHAT_STORAGE_KEY = 'aether_pdf_chats'

function loadChats(): Record<string, Message[]> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}')
  } catch { return {} }
}

function saveChats(chats: Record<string, Message[]>) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
  } catch { /* storage full — ignore */ }
}

function friendlyError(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('timeout') || r.includes('timed out'))
    return 'The model is taking longer than expected. Please try a shorter question.'
  if (r.includes('503') || r.includes('ollama'))
    return 'Ollama is not responding. Make sure it is running.'
  if (r.includes('no relevant content'))
    return 'No relevant content found in this document for your question.'
  return 'Something went wrong. Please try again.'
}

export default function PDFChat() {
  const { selectedModel } = useAppStore()
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
  const [summarizing, setSummarizing] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatsRef = useRef<Record<string, Message[]>>(loadChats())

  useEffect(() => { fetchDocuments() }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDrop: handleUpload,
    disabled: uploadStage !== 'idle',
  })

  async function fetchDocuments() {
    try {
      const res = await documentsApi.list()
      setDocuments(res.data)
    } catch { /* ignore */ }
  }

  function selectDoc(doc: Document) {
    setSelectedDoc(doc)
    // Restore persisted conversation
    const saved = chatsRef.current[doc.id] || []
    setMessages(saved)
  }

  function clearConversation() {
    if (!selectedDoc) return
    chatsRef.current[selectedDoc.id] = []
    saveChats(chatsRef.current)
    setMessages([])
    toast.success('Conversation cleared')
  }

  async function handleUpload(files: File[]) {
    const file = files[0]
    if (!file) return

    setUploadStage('uploading')
    try {
      // Simulate staged progress for better UX
      // Real upload starts immediately; we advance stages based on timing
      const stageTimer1 = setTimeout(() => setUploadStage('processing'), 800)
      const stageTimer2 = setTimeout(() => setUploadStage('embedding'), 2500)

      const res = await documentsApi.upload(file)

      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      setUploadStage('ready')

      const newDoc = res.data
      setDocuments(prev => [newDoc, ...prev])
      selectDoc(newDoc)

      setTimeout(() => setUploadStage('idle'), 1500)
      toast.success(`"${file.name}" uploaded and ready!`)
    } catch (e: any) {
      setUploadStage('idle')
      toast.error(friendlyError(e.message))
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm('Delete this document and its embeddings?')) return
    try {
      await documentsApi.delete(id)
      setDocuments(prev => prev.filter(d => d.id !== id))
      // Clean up stored conversation
      delete chatsRef.current[id]
      saveChats(chatsRef.current)
      if (selectedDoc?.id === id) { setSelectedDoc(null); setMessages([]) }
      toast.success('Document deleted')
    } catch (e: any) { toast.error(friendlyError(e.message)) }
  }

  async function sendMessage() {
    if (!input.trim() || !selectedDoc || loading) return
    const question = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: question }
    const updated = [...messages, userMsg]
    setMessages(updated)

    try {
      const res = await documentsApi.chat(selectedDoc.id, question, selectedModel)
      const aiMsg: Message = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
      }
      const finalMessages = [...updated, aiMsg]
      setMessages(finalMessages)

      // Persist
      chatsRef.current[selectedDoc.id] = finalMessages
      saveChats(chatsRef.current)
    } catch (e: any) {
      const errMsg: Message = { role: 'assistant', content: `⚠️ ${friendlyError(e.message)}` }
      const finalMessages = [...updated, errMsg]
      setMessages(finalMessages)
      chatsRef.current[selectedDoc.id] = finalMessages
      saveChats(chatsRef.current)
    } finally { setLoading(false) }
  }

  async function summarizeDocument() {
    if (!selectedDoc) return
    setSummarizing(true)
    try {
      const res = await documentsApi.summarize(selectedDoc.id, selectedModel)
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, summary: res.data.summary } : d))
      setSelectedDoc(prev => prev ? { ...prev, summary: res.data.summary } : prev)
      const summaryMsg: Message = {
        role: 'assistant',
        content: `## Document Summary\n\n${res.data.summary}`,
      }
      const finalMessages = [...messages, summaryMsg]
      setMessages(finalMessages)
      chatsRef.current[selectedDoc.id] = finalMessages
      saveChats(chatsRef.current)
      toast.success('Document summarized!')
    } catch (e: any) { toast.error(friendlyError(e.message)) }
    finally { setSummarizing(false) }
  }

  async function copyMessage(idx: number, content: string) {
    await copyToClipboard(content)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const isUploading = uploadStage !== 'idle'

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-[#0a0a14]">
      {/* Documents panel */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1a1a2e]">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-green-500" /> PDF Documents
          </h2>
          {/* Upload zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors',
              isUploading ? 'border-green-400 bg-green-50 dark:bg-green-950/20 cursor-default' :
              isDragActive
                ? 'border-aether-500 bg-aether-50 dark:bg-aether-950/30'
                : 'border-gray-300 dark:border-[#26263a] hover:border-aether-400 dark:hover:border-aether-700'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {STAGE_LABELS[uploadStage]}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDragActive ? 'Drop PDF here' : 'Drop PDF or click to upload'}
                </p>
                <p className="text-xs text-gray-400">Max 50 MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2">
          {documents.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-600 px-4">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id}
                onClick={() => selectDoc(doc)}
                className={cn(
                  'group flex items-start gap-2 px-3 py-3 rounded-xl cursor-pointer mb-1 border transition-all',
                  selectedDoc?.id === doc.id
                    ? 'bg-aether-50 dark:bg-aether-950/40 border-aether-200 dark:border-aether-800'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#1a1a2e]'
                )}>
                <div className={cn('mt-0.5 flex-shrink-0', doc.status === 'ready' ? 'text-green-500' : doc.status === 'error' ? 'text-red-500' : 'text-amber-500')}>
                  {doc.status === 'ready' ? <CheckCircle2 className="w-4 h-4" /> :
                    doc.status === 'error' ? <AlertCircle className="w-4 h-4" /> :
                      <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.original_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatBytes(doc.file_size)} · {doc.page_count}p · {doc.chunk_count} chunks
                  </p>
                  {/* Show saved conversation count */}
                  {(chatsRef.current[doc.id]?.length ?? 0) > 0 && (
                    <p className="text-xs text-aether-500 mt-0.5">
                      {Math.floor((chatsRef.current[doc.id]?.length ?? 0) / 2)} Q&A saved
                    </p>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id) }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 flex-shrink-0 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            {/* Doc header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a]">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{selectedDoc.original_name}</p>
                  <p className="text-xs text-gray-400">{selectedDoc.page_count} pages · {selectedDoc.chunk_count} chunks indexed</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {messages.length > 0 && (
                  <button onClick={clearConversation}
                    className="btn-ghost flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" /> Clear chat
                  </button>
                )}
                <button onClick={summarizeDocument} disabled={summarizing || selectedDoc.status !== 'ready'}
                  className="btn-secondary flex items-center gap-2 text-sm">
                  {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-aether-500" />}
                  Summarize
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Ask questions about this document</p>
                  <p className="text-sm mt-1">I'll use semantic search to find relevant answers</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {['Summarize this document', 'What are the main topics?', 'What conclusions are drawn?'].map(q => (
                      <button key={q} onClick={() => setInput(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-[#26263a] hover:border-aether-300 dark:hover:border-aether-700 text-gray-600 dark:text-gray-400 hover:text-aether-600 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1',
                    msg.role === 'user' ? 'bg-aether-100 dark:bg-aether-900/40' : 'bg-gradient-to-br from-green-500 to-teal-600')}>
                    {msg.role === 'user'
                      ? <span className="text-xs font-bold text-aether-600">U</span>
                      : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  <div className={cn('group max-w-[80%] flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={cn('rounded-2xl px-4 py-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-aether-600 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-[#11111e] border border-gray-200 dark:border-[#26263a] text-gray-800 dark:text-gray-200 rounded-tl-sm')}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : <p>{msg.content}</p>}
                    </div>

                    {/* Copy button for assistant messages */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copyMessage(i, msg.content)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-400 transition-colors">
                          {copiedIdx === i ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="w-full space-y-1">
                        <p className="text-xs text-gray-400 font-medium">Sources:</p>
                        {msg.sources.slice(0, 2).map((src, j) => (
                          <div key={j} className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-green-600 dark:text-green-400">Relevance {(src.relevance * 100).toFixed(0)}%:</span> {src.chunk.slice(0, 120)}…
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-[#11111e] border border-gray-200 dark:border-[#26263a] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      </div>
                      <span className="text-xs text-gray-400">Searching document…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] p-4">
              <div className="flex gap-3 items-center">
                <input
                  className="input flex-1"
                  placeholder="Ask a question about this document…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  disabled={loading || selectedDoc.status !== 'ready'}
                />
                <button onClick={sendMessage} disabled={!input.trim() || loading || selectedDoc.status !== 'ready'}
                  className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                    input.trim() && !loading ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 dark:bg-[#1a1a2e] text-gray-400 cursor-not-allowed')}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileSearch className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a document</p>
              <p className="text-sm mt-1">or upload a new PDF to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
