import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, Plus, Search, Tag, Pin, Trash2, Edit3, Save,
  X, Wand2, AlignLeft, Loader2, Clock, Hash
} from 'lucide-react'
import { notesApi } from '../services/api'
import { cn, timeAgo, wordCount } from '../utils/helpers'
import TextareaAutosize from 'react-textarea-autosize'

interface Note {
  id: string; title: string; content: string; summary?: string
  tags: string; collection_id?: string; is_pinned: boolean
  color: string; word_count: string; created_at: string; updated_at: string
}

const NOTE_COLORS = ['default', 'blue', 'purple', 'green', 'amber', 'rose']
const NOTE_COLOR_STYLES: Record<string, string> = {
  default: 'border-gray-200 dark:border-[#26263a]',
  blue: 'border-blue-300 dark:border-blue-800',
  purple: 'border-purple-300 dark:border-purple-800',
  green: 'border-green-300 dark:border-green-800',
  amber: 'border-amber-300 dark:border-amber-800',
  rose: 'border-rose-300 dark:border-rose-800',
}

const AI_ACTIONS = [
  { action: 'summarize', label: 'Summarize', icon: AlignLeft },
  { action: 'improve', label: 'Improve Writing', icon: Wand2 },
  { action: 'expand', label: 'Expand', icon: FileText },
  { action: 'fix_grammar', label: 'Fix Grammar', icon: Edit3 },
]

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({ title: '', content: '', tags: '', color: 'default' })

  useEffect(() => { fetchNotes() }, [])
  useEffect(() => {
    if (searchQuery.trim()) searchNotes()
    else fetchNotes()
  }, [searchQuery])

  async function fetchNotes() {
    if (!searchQuery.trim()) setLoading(true)
    try {
      const res = await notesApi.list()
      setNotes(res.data)
    } catch { toast.error('Failed to load notes') }
    finally { setLoading(false) }
  }

  async function searchNotes() {
    try {
      const res = await notesApi.search(searchQuery)
      setNotes(res.data)
    } catch { /* ignore */ }
  }

  async function createNote() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await notesApi.create(form)
      setNotes(prev => [res.data, ...prev])
      setForm({ title: '', content: '', tags: '', color: 'default' })
      setCreating(false)
      setActiveNote(res.data)
      toast.success('Note created!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function saveNote(note: Note) {
    setSaving(true)
    try {
      const res = await notesApi.update(note.id, {
        title: note.title, content: note.content,
        tags: note.tags, color: note.color, is_pinned: note.is_pinned,
      })
      setNotes(prev => prev.map(n => n.id === note.id ? res.data : n))
      setActiveNote(res.data)
      setEditMode(false)
      toast.success('Note saved!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    try {
      await notesApi.delete(id)
      setNotes(prev => prev.filter(n => n.id !== id))
      if (activeNote?.id === id) setActiveNote(null)
      toast.success('Note deleted')
    } catch (e: any) { toast.error(e.message) }
  }

  async function applyAiAction(action: string) {
    if (!activeNote) return
    setAiLoading(action)
    setAiResult(null)
    try {
      const res = await notesApi.aiAction(activeNote.id, action)
      setAiResult(res.data.result)
      if (action === 'improve' || action === 'fix_grammar' || action === 'expand') {
        setActiveNote(prev => prev ? { ...prev, content: res.data.result } : prev)
        setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: res.data.result } : n))
      }
      toast.success(`AI ${action} complete!`)
    } catch (e: any) { toast.error(e.message) }
    finally { setAiLoading(null) }
  }

  async function togglePin(n: Note) {
    try {
      await notesApi.update(n.id, { is_pinned: !n.is_pinned })
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, is_pinned: !x.is_pinned } : x))
      if (activeNote?.id === n.id) setActiveNote(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : prev)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-[#0a0a14]">
      {/* Notes list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1a1a2e] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Smart Notes</h2>
            <button onClick={() => setCreating(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9 text-sm py-2" placeholder="Search notes…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* New note form */}
        <AnimatePresence>
          {creating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-gray-200 dark:border-[#1a1a2e]">
              <div className="p-4 space-y-3">
                <input className="input text-sm" placeholder="Note title" autoFocus
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                <textarea className="input text-sm resize-none" rows={3} placeholder="Content (optional)"
                  value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
                <input className="input text-sm" placeholder="Tags (comma-separated)"
                  value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => setCreating(false)} className="btn-secondary text-xs flex-1">Cancel</button>
                  <button onClick={createNote} disabled={!form.title.trim() || saving}
                    className="btn-primary text-xs flex-1 flex items-center justify-center gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Create
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse bg-gray-200 dark:bg-[#1a1a2e] rounded-xl h-20" />)}
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600 px-4">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No notes yet</p>
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} onClick={() => { setActiveNote(note); setEditMode(false); setAiResult(null) }}
                className={cn(
                  'group flex flex-col gap-1 px-3 py-3 rounded-xl cursor-pointer mb-1 border transition-all',
                  activeNote?.id === note.id
                    ? 'bg-aether-50 dark:bg-aether-950/40 border-aether-200 dark:border-aether-800'
                    : `bg-transparent hover:bg-gray-50 dark:hover:bg-[#1a1a2e] ${NOTE_COLOR_STYLES[note.color]}`
                )}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{note.title}</p>
                  {note.is_pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0 ml-1" />}
                </div>
                <p className="text-xs text-gray-400 truncate">{note.content || 'Empty note'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{timeAgo(note.updated_at)}</span>
                  <span className="text-xs text-gray-300 dark:text-gray-600 ml-1">·</span>
                  <span className="text-xs text-gray-400">{note.word_count}w</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Note editor */}
      {activeNote ? (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0d0d1a]">
          {/* Note toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-[#1a1a2e]">
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <button onClick={() => saveNote(activeNote)} disabled={saving}
                    className="btn-primary flex items-center gap-1.5 text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                  <button onClick={() => { setEditMode(false); setActiveNote(notes.find(n => n.id === activeNote.id) || null) }}
                    className="btn-secondary text-sm">Cancel</button>
                </>
              ) : (
                <button onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}
              <button onClick={() => togglePin(activeNote)}
                className={cn('btn-ghost text-sm flex items-center gap-1.5',
                  activeNote.is_pinned ? 'text-amber-500' : '')}>
                <Pin className="w-4 h-4" /> {activeNote.is_pinned ? 'Unpin' : 'Pin'}
              </button>
              <button onClick={() => deleteNote(activeNote.id)}
                className="btn-ghost text-sm flex items-center gap-1.5 text-red-500">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{activeNote.word_count} words</span>
              <span className="text-xs text-gray-400">Updated {timeAgo(activeNote.updated_at)}</span>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Editor area */}
            <div className="flex-1 overflow-y-auto p-6">
              {editMode ? (
                <div className="max-w-3xl space-y-4">
                  <input
                    className="input text-xl font-bold bg-transparent border-0 border-b border-gray-200 dark:border-[#26263a] rounded-none px-0 focus:ring-0 focus:border-aether-500"
                    value={activeNote.title}
                    onChange={e => setActiveNote(p => p ? { ...p, title: e.target.value } : p)}
                  />
                  <input
                    className="input text-sm"
                    placeholder="Tags (comma-separated)"
                    value={activeNote.tags}
                    onChange={e => setActiveNote(p => p ? { ...p, tags: e.target.value } : p)}
                  />
                  <TextareaAutosize
                    className="input resize-none text-sm font-mono leading-relaxed"
                    minRows={15}
                    value={activeNote.content}
                    onChange={e => setActiveNote(p => p ? { ...p, content: e.target.value } : p)}
                    placeholder="Start writing... (Markdown supported)"
                  />
                </div>
              ) : (
                <div className="max-w-3xl">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{activeNote.title}</h1>
                  {activeNote.tags && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {activeNote.tags.split(',').filter(Boolean).map(tag => (
                        <span key={tag} className="badge bg-gray-100 dark:bg-[#1a1a2e] text-gray-500 dark:text-gray-400 text-xs">
                          <Hash className="w-3 h-3" />{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {activeNote.content ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNote.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">Empty note — click Edit to start writing</p>
                  )}

                  {/* AI Result */}
                  {aiResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-4 bg-aether-50 dark:bg-aether-950/30 border border-aether-200 dark:border-aether-800 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-aether-700 dark:text-aether-400 uppercase tracking-wider">AI Result</p>
                        <button onClick={() => setAiResult(null)} className="btn-ghost p-1"><X className="w-3 h-3" /></button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* AI sidebar */}
            <div className="w-56 border-l border-gray-200 dark:border-[#1a1a2e] p-4 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-3">AI Actions</p>
              <div className="space-y-2">
                {AI_ACTIONS.map(({ action, label, icon: Icon }) => (
                  <button key={action} onClick={() => applyAiAction(action)} disabled={!!aiLoading}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-aether-50 dark:hover:bg-aether-950/30 hover:text-aether-700 dark:hover:text-aether-400 transition-colors disabled:opacity-50">
                    {aiLoading === action ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a note</p>
            <p className="text-sm mt-1">or create a new one to get started</p>
          </div>
        </div>
      )}
    </div>
  )
}
