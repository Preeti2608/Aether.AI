import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Search as SearchIcon, Brain, FileText, FileSearch, SlidersHorizontal,
  Loader2, ArrowRight, Hash
} from 'lucide-react'
import { searchApi } from '../services/api'
import { cn } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  id: string; type: string; title: string; excerpt: string
  score: number; metadata: Record<string, string>
}

type IconFC = React.FC<{ className?: string }>

const TYPE_CONFIG: Record<string, { icon: IconFC, color: string, label: string, path: string }> = {
  memory: { icon: Brain as IconFC, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', label: 'Memory', path: '/memory' },
  note: { icon: FileText as IconFC, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', label: 'Note', path: '/notes' },
  document: { icon: FileSearch as IconFC, color: 'text-green-500 bg-green-50 dark:bg-green-900/20', label: 'Document', path: '/pdf' },
}

const FILTER_TYPES = ['all', 'memory', 'note', 'document']

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [limit, setLimit] = useState(10)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const types = typeFilter === 'all' ? undefined : typeFilter
      const res = await searchApi.search(query, types, limit)
      setResults(res.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      toast.error(msg)
    }
    finally { setLoading(false) }
  }

  const filteredResults = typeFilter === 'all'
    ? results
    : results.filter(r => r.type === typeFilter)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SearchIcon className="w-6 h-6 text-aether-500" /> Semantic Search
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Search across memories, notes, and documents using AI similarity matching
        </p>
      </div>

      {/* Search bar */}
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              className="input pl-11 pr-4 text-base h-12"
              placeholder="Search anything… (semantic, not keyword)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              autoFocus
            />
          </div>
          <button onClick={handleSearch} disabled={!query.trim() || loading}
            className="btn-primary px-6 h-12 flex items-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-[#1a1a2e]">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Filter:</span>
          {FILTER_TYPES.map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors',
                typeFilter === type
                  ? 'bg-aether-600 text-white'
                  : 'bg-gray-100 dark:bg-[#1a1a2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#26263a]')}>
              {type}
            </button>
          ))}
          <select
            className="ml-auto text-xs border border-gray-200 dark:border-[#26263a] rounded-lg px-2 py-1 bg-white dark:bg-[#1a1a2e] text-gray-600 dark:text-gray-400"
            value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-24">
              <div className="flex gap-3">
                <div className="bg-gray-200 dark:bg-[#26263a] rounded-lg w-10 h-10 flex-shrink-0" />
                <div className="flex-1">
                  <div className="bg-gray-200 dark:bg-[#26263a] rounded h-4 w-1/3 mb-2" />
                  <div className="bg-gray-200 dark:bg-[#26263a] rounded h-3 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : searched ? (
        filteredResults.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <SearchIcon className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No relevant memories or notes found</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">
              Try rephrasing your query, or add more content to your memories and notes first.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Found <span className="font-semibold text-gray-900 dark:text-white">{filteredResults.length}</span> results for "{query}"
              </p>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {filteredResults.map((result, i) => {
                  const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.memory
                  const Icon = config.icon
                  const relevancePct = Math.round(result.score * 100)
                  return (
                    <motion.div key={`${result.id}-${i}`}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card p-4 hover:border-aether-200 dark:hover:border-aether-800 transition-colors cursor-pointer group"
                      onClick={() => navigate(config.path)}>
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2.5 rounded-xl flex-shrink-0', config.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{config.label}</span>
                              {result.metadata.tags && (
                                <span className="text-xs text-gray-400">
                                  <Hash className="w-3 h-3 inline" />{result.metadata.tags.split(',').slice(0, 2).join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-16 bg-gray-200 dark:bg-[#26263a] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-aether-500 rounded-full"
                                    style={{ width: `${relevancePct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">{relevancePct}%</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          {result.title && result.title !== 'Memory' && (
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{result.title}</p>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">{result.excerpt}</p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#1a1a2e] flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">Semantic Search</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            Search finds content by meaning, not just keywords.
            Try "things about machine learning" or "my project goals".
          </p>
        </div>
      )}
    </div>
  )
}
