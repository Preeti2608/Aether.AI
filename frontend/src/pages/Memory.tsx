import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Brain, Plus, Search, Tag, Pin, Trash2, Edit3, Save, X,
  Filter, RefreshCw, Loader2, BookOpen
} from 'lucide-react'
import { memoryApi } from '../services/api'
import { cn, timeAgo, CATEGORY_COLORS } from '../utils/helpers'

interface Memory {
  id: string; content: string; category: string
  tags: string; is_pinned: boolean; source: string
  created_at: string; updated_at: string; collection_id?: string
}

const CATEGORIES = ['all', 'fact', 'preference', 'project', 'learning', 'personal', 'general']

export default function Memory() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [filtered, setFiltered] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [form, setForm] = useState({ content: '', category: 'general', tags: '' })
  const [editForm, setEditForm] = useState({ content: '', category: 'general', tags: '' })
  const [stats, setStats] = useState<{ total: number; pinned: number; by_category: Record<string, number> }>({
    total: 0, pinned: 0, by_category: {}
  })

  useEffect(() => { fetchMemories(); fetchStats() }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch()
    } else {
      applyFilter(memories, categoryFilter)
    }
  }, [searchQuery, categoryFilter, memories])

  async function fetchMemories() {
    setLoading(true)
    try {
      const res = await memoryApi.list()
      setMemories(res.data)
      applyFilter(res.data, categoryFilter)
    } catch (e: any) { toast.error('Failed to load memories') }
    finally { setLoading(false) }
  }

  async function fetchStats() {
    try {
      const res = await memoryApi.stats()
      setStats(res.data)
    } catch { /* ignore */ }
  }

  function applyFilter(mems: Memory[], cat: string) {
    if (cat === 'all') setFiltered(mems)
    else setFiltered(mems.filter(m => m.category === cat))
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await memoryApi.search(searchQuery, 20)
      setFiltered(res.data)
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  async function createMemory() {
    if (!form.content.trim()) return
    setSaving(true)
    try {
      const res = await memoryApi.create({ ...form, source: 'manual' })
      const newMem = res.data
      setMemories(prev => [newMem, ...prev])
      setStats(prev => ({ ...prev, total: prev.total + 1 }))
      setForm({ content: '', category: 'general', tags: '' })
      setCreating(false)
      toast.success('Memory saved!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function updateMemory(id: string) {
    setSaving(true)
    try {
      const res = await memoryApi.update(id, editForm)
      setMemories(prev => prev.map(m => m.id === id ? { ...m, ...res.data } : m))
      setEditingId(null)
      toast.success('Memory updated!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteMemory(id: string) {
    if (!confirm('Delete this memory?')) return
    try {
      await memoryApi.delete(id)
      setMemories(prev => prev.filter(m => m.id !== id))
      setStats(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      toast.success('Memory deleted')
    } catch (e: any) { toast.error(e.message) }
  }

  async function togglePin(m: Memory) {
    try {
      await memoryApi.update(m.id, { is_pinned: !m.is_pinned })
      setMemories(prev => prev.map(x => x.id === m.id ? { ...x, is_pinned: !x.is_pinned } : x))
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-500" /> Long-Term Memory
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {stats.total} memories stored · {stats.pinned} pinned
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Memory
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 pr-4"
            placeholder="Semantic search memories…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setSearchQuery('') }}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors',
                categoryFilter === cat && !searchQuery
                  ? 'bg-aether-600 text-white'
                  : 'bg-gray-100 dark:bg-[#1a1a2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#26263a]'
              )}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* Create memory form */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="card p-5 border-aether-200 dark:border-aether-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">New Memory</h3>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="input resize-none mb-3"
              rows={3}
              placeholder="What should I remember? (facts, preferences, projects, learnings…)"
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-3 mb-4">
              <select
                className="input"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Tags (comma-separated)"
                value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={createMemory} disabled={!form.content.trim() || saving} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Memory
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memories list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-24">
              <div className="bg-gray-200 dark:bg-[#26263a] rounded h-4 w-3/4 mb-3" />
              <div className="bg-gray-200 dark:bg-[#26263a] rounded h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Brain className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No memories found</p>
          <p className="text-sm mt-1">
            {searchQuery ? 'Try a different search term' : 'Start adding memories to build your second brain'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((mem, i) => (
              <motion.div
                key={mem.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: i * 0.03 }}
                className="card p-4 group hover:border-aether-200 dark:hover:border-aether-800 transition-colors"
              >
                {editingId === mem.id ? (
                  <div>
                    <textarea
                      className="input resize-none mb-3 w-full"
                      rows={3}
                      value={editForm.content}
                      onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
                      autoFocus
                    />
                    <div className="flex gap-3 mb-3">
                      <select className="input" value={editForm.category}
                        onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                        {CATEGORIES.filter(c => c !== 'all').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input className="input" placeholder="Tags" value={editForm.tags}
                        onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
                      <button onClick={() => updateMemory(mem.id)} disabled={saving} className="btn-primary flex items-center gap-2 text-xs">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{mem.content}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn('badge text-xs capitalize', CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.general)}>
                          {mem.category}
                        </span>
                        {mem.tags && mem.tags.split(',').filter(Boolean).map(tag => (
                          <span key={tag} className="badge bg-gray-100 dark:bg-[#1a1a2e] text-gray-500 dark:text-gray-400 text-xs">
                            #{tag.trim()}
                          </span>
                        ))}
                        <span className="text-xs text-gray-400 ml-auto">{timeAgo(mem.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => togglePin(mem)}
                        className={cn('p-1.5 rounded-lg transition-colors',
                          mem.is_pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-400')}>
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingId(mem.id); setEditForm({ content: mem.content, category: mem.category, tags: mem.tags }) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-400">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMemory(mem.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
