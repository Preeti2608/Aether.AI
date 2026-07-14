import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  MessageSquare, Brain, FileText, FileSearch, FolderOpen,
  TrendingUp, Activity, Zap, RefreshCw, Clock, ChevronRight,
  Cpu, Wifi, WifiOff, ArrowUpRight
} from 'lucide-react'
import { dashboardApi } from '../services/api'
import { useAppStore } from '../store/appStore'
import { cn, timeAgo } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'

interface Stats {
  chats: number; memories: number; notes: number
  documents: number; collections: number
}
interface Activity { type: string; title: string; time: string }

const STAT_CARDS = [
  { key: 'chats', label: 'Total Chats', icon: MessageSquare, color: 'blue', path: '/chat' },
  { key: 'memories', label: 'Memories', icon: Brain, color: 'purple', path: '/memory' },
  { key: 'notes', label: 'Smart Notes', icon: FileText, color: 'amber', path: '/notes' },
  { key: 'documents', label: 'PDFs Ready', icon: FileSearch, color: 'green', path: '/pdf' },
]

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
}

const ACTIVITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  chat: MessageSquare, note: FileText, memory: Brain, document: FileSearch,
}
const ACTIVITY_COLORS: Record<string, string> = {
  chat: 'text-blue-500', note: 'text-amber-500', memory: 'text-purple-500', document: 'text-green-500',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { aiOnline, selectedModel, availableModels } = useAppStore()
  const [stats, setStats] = useState<Stats>({ chats: 0, memories: 0, notes: 0, documents: 0, collections: 0 })
  const [activity, setActivity] = useState<Activity[]>([])
  const [aiModels, setAiModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await dashboardApi.getStats()
      setStats(res.data.stats)
      setActivity(res.data.recent_activity || [])
      setAiModels(res.data.ai?.models || [])
    } catch (e: any) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good to see you! 👋
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
            Your AI Second Brain is{' '}
            <span className={aiOnline ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
              {aiOnline ? 'ready and running' : 'offline — start Ollama'}
            </span>
          </p>
        </div>
        <button onClick={() => fetchData(true)} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-32 animate-pulse">
              <div className="bg-gray-200 dark:bg-[#26263a] rounded-xl w-10 h-10 mb-3" />
              <div className="bg-gray-200 dark:bg-[#26263a] rounded h-6 w-16 mb-2" />
              <div className="bg-gray-200 dark:bg-[#26263a] rounded h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((card, i) => {
            const Icon = card.icon
            const value = stats[card.key as keyof Stats]
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => navigate(card.path)}
                className="card p-5 cursor-pointer hover:border-aether-300 dark:hover:border-aether-700 transition-all group"
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', COLOR_MAP[card.color])}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <ArrowUpRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Model Status */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-aether-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">AI Status</h3>
          </div>
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl mb-4',
            aiOnline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
          )}>
            {aiOnline
              ? <Wifi className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0" />}
            <div>
              <p className={cn('font-medium text-sm', aiOnline ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                {aiOnline ? 'Ollama Connected' : 'Ollama Offline'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {aiOnline ? 'All AI features available' : 'Run: ollama serve'}
              </p>
            </div>
          </div>
          {aiOnline && (
            <>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2 uppercase tracking-wider">Active Model</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-aether-50 dark:bg-aether-950/40 border border-aether-200 dark:border-aether-800">
                <Zap className="w-4 h-4 text-aether-500" />
                <span className="text-sm font-medium text-aether-700 dark:text-aether-300">{selectedModel}</span>
              </div>
              {aiModels.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2 uppercase tracking-wider">Available</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiModels.slice(0, 4).map(m => (
                      <span key={m} className="badge bg-gray-100 dark:bg-[#1a1a2e] text-gray-600 dark:text-gray-400 text-xs">
                        {m}
                      </span>
                    ))}
                    {aiModels.length > 4 && (
                      <span className="badge bg-gray-100 dark:bg-[#1a1a2e] text-gray-500 text-xs">+{aiModels.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-aether-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            </div>
            <span className="text-xs text-gray-400">{activity.length} events</span>
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-600">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Start chatting or creating notes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 8).map((item, i) => {
                const Icon = ACTIVITY_ICONS[item.type] || Activity
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a2e] transition-colors"
                  >
                    <div className={cn('p-1.5 rounded-lg bg-gray-100 dark:bg-[#1a1a2e]', ACTIVITY_COLORS[item.type])}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">{item.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{item.type}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-600 flex-shrink-0 tabular-nums">{timeAgo(item.time)}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Chat', icon: MessageSquare, path: '/chat', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Add Memory', icon: Brain, path: '/memory', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Create Note', icon: FileText, path: '/notes', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Upload PDF', icon: FileSearch, path: '/pdf', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
          ].map(action => {
            const Icon = action.icon
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a2e] border border-transparent hover:border-gray-200 dark:hover:border-[#26263a] transition-all group"
              >
                <div className={cn('p-3 rounded-xl', action.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
