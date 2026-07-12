import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FolderOpen, Plus, Edit3, Trash2, Brain, FileText,
  BookOpen, Briefcase, Heart, X, Save, Loader2, ChevronRight
} from 'lucide-react'
import { collectionsApi, memoryApi, notesApi } from '../services/api'
import { cn } from '../utils/helpers'

interface Collection {
  id: string; name: string; description: string; icon: string
  color: string; memory_count: number; note_count: number; created_at: string
}

const ICONS = ['folder', 'book-open', 'briefcase', 'heart', 'star', 'code', 'globe', 'music']
const COLORS = [
  { name: 'blue', class: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', hex: '#6366f1' },
  { name: 'purple', class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', hex: '#a855f7' },
  { name: 'amber', class: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', hex: '#f59e0b' },
  { name: 'rose', class: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400', hex: '#f43f5e' },
  { name: 'green', class: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400', hex: '#10b981' },
  { name: 'gray', class: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400', hex: '#6b7280' },
]

function IconComp({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    'folder': FolderOpen, 'book-open': BookOpen,
    'briefcase': Briefcase, 'heart': Heart,
    'star': FolderOpen, 'code': FolderOpen, 'globe': FolderOpen, 'music': FolderOpen,
  }
  const Comp = icons[name] || FolderOpen
  return <Comp className={className} />
}

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedColl, setSelectedColl] = useState<Collection | null>(null)
  const [collContent, setCollContent] = useState<{ memories: any[]; notes: any[] }>({ memories: [], notes: [] })
  const [loadingContent, setLoadingContent] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', icon: 'folder', color: 'blue' })

  useEffect(() => { fetchCollections() }, [])
  useEffect(() => {
    if (selectedColl) loadCollectionContent(selectedColl.id)
  }, [selectedColl])

  async function fetchCollections() {
    setLoading(true)
    try {
      const res = await collectionsApi.list()
      setCollections(res.data)
    } catch { toast.error('Failed to load collections') }
    finally { setLoading(false) }
  }

  async function loadCollectionContent(id: string) {
    setLoadingContent(true)
    try {
      const [memRes, noteRes] = await Promise.all([
        memoryApi.list({ collection_id: id }),
        notesApi.list({ collection_id: id }),
      ])
      setCollContent({ memories: memRes.data, notes: noteRes.data })
    } catch { /* ignore */ }
    finally { setLoadingContent(false) }
  }

  async function createCollection() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await collectionsApi.create(form)
      setCollections(prev => [...prev, res.data])
      setForm({ name: '', description: '', icon: 'folder', color: 'blue' })
      setCreating(false)
      toast.success('Collection created!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function updateCollection() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await collectionsApi.update(editing.id, form)
      setCollections(prev => prev.map(c => c.id === editing.id ? res.data : c))
      if (selectedColl?.id === editing.id) setSelectedColl(res.data)
      setEditing(null)
      toast.success('Collection updated!')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteCollection(id: string) {
    if (!confirm('Delete this collection? Items will not be deleted.')) return
    try {
      await collectionsApi.delete(id)
      setCollections(prev => prev.filter(c => c.id !== id))
      if (selectedColl?.id === id) setSelectedColl(null)
      toast.success('Collection deleted')
    } catch (e: any) { toast.error(e.message) }
  }

  const colorConfig = (name: string) => COLORS.find(c => c.name === name) || COLORS[0]

  function CollectionForm({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
    return (
      <div className="p-5 space-y-4">
        <input className="input" placeholder="Collection name" autoFocus
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input className="input" placeholder="Description (optional)"
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Color</p>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c.name} onClick={() => setForm(p => ({ ...p, color: c.name }))}
                className={cn('w-8 h-8 rounded-full border-2 transition-all', form.color === c.name ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent')}
                style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onSubmit} disabled={!form.name.trim() || saving}
            className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-[#0a0a14]">
      {/* Collections list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-[#1a1a2e] bg-white dark:bg-[#0d0d1a] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1a1a2e] flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-aether-500" /> Collections
          </h2>
          <button onClick={() => { setCreating(true); setEditing(null); setForm({ name: '', description: '', icon: 'folder', color: 'blue' }) }}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        <AnimatePresence>
          {creating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-gray-200 dark:border-[#1a1a2e]">
              <CollectionForm onSubmit={createCollection} onCancel={() => setCreating(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-gray-200 dark:bg-[#1a1a2e] rounded-xl h-16" />)}
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600 px-4">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No collections yet</p>
            </div>
          ) : (
            collections.map(coll => {
              const color = colorConfig(coll.color)
              return (
                <div key={coll.id}
                  onClick={() => { setSelectedColl(coll); setCreating(false); setEditing(null) }}
                  className={cn('group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer mb-1 transition-all',
                    selectedColl?.id === coll.id
                      ? 'bg-aether-50 dark:bg-aether-950/40 border border-aether-200 dark:border-aether-800'
                      : 'hover:bg-gray-50 dark:hover:bg-[#1a1a2e] border border-transparent')}>
                  <div className={cn('p-2 rounded-xl flex-shrink-0', color.class)}>
                    <IconComp name={coll.icon} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{coll.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {coll.memory_count} memories · {coll.note_count} notes
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditing(coll); setCreating(false); setForm({ name: coll.name, description: coll.description, icon: coll.icon, color: coll.color }) }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#26263a] text-gray-400">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCollection(coll.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Collection detail */}
      {editing ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Edit Collection</h3>
            <CollectionForm onSubmit={updateCollection} onCancel={() => setEditing(null)} />
          </div>
        </div>
      ) : selectedColl ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className={cn('p-3 rounded-2xl', colorConfig(selectedColl.color).class)}>
                <IconComp name={selectedColl.icon} className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedColl.name}</h2>
                {selectedColl.description && <p className="text-gray-500 dark:text-gray-400 mt-0.5">{selectedColl.description}</p>}
                <div className="flex gap-4 mt-1">
                  <span className="text-sm text-gray-500">{selectedColl.memory_count} memories</span>
                  <span className="text-sm text-gray-500">{selectedColl.note_count} notes</span>
                </div>
              </div>
            </div>

            {loadingContent ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-aether-500" /></div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Memories */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" /> Memories ({collContent.memories.length})
                  </h3>
                  {collContent.memories.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4">No memories in this collection</p>
                  ) : (
                    <div className="space-y-2">
                      {collContent.memories.map(m => (
                        <div key={m.id} className="card p-3">
                          <p className="text-sm text-gray-800 dark:text-gray-200">{m.content}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs capitalize">{m.category}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" /> Notes ({collContent.notes.length})
                  </h3>
                  {collContent.notes.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4">No notes in this collection</p>
                  ) : (
                    <div className="space-y-2">
                      {collContent.notes.map(n => (
                        <div key={n.id} className="card p-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{n.content || 'Empty note'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
          <div className="text-center">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a collection</p>
            <p className="text-sm mt-1">or create a new one to organize your content</p>
          </div>
        </div>
      )}
    </div>
  )
}
