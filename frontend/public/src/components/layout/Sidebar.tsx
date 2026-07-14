import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Brain, FileText,
  FileSearch, Search, FolderOpen, Settings, ChevronLeft,
  ChevronRight, Zap,
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { cn } from '../../utils/helpers'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'AI Chat', icon: MessageSquare, path: '/chat' },
  { label: 'Memory', icon: Brain, path: '/memory' },
  { label: 'Smart Notes', icon: FileText, path: '/notes' },
  { label: 'PDF Chat', icon: FileSearch, path: '/pdf' },
  { label: 'Search', icon: Search, path: '/search' },
  { label: 'Collections', icon: FolderOpen, path: '/collections' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, aiOnline } = useAppStore()
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300',
        'bg-white dark:bg-[#0d0d1a] border-r border-gray-200 dark:border-[#1a1a2e]',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-gray-200 dark:border-[#1a1a2e] flex-shrink-0',
        sidebarOpen ? 'justify-between' : 'justify-center'
      )}>
        {sidebarOpen && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
              Aether <span className="gradient-text">AI</span>
            </span>
          </div>
        )}
        {!sidebarOpen && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center shadow-glow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path) ||
            (item.path === '/chat' && location.pathname.startsWith('/chat'))
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'sidebar-item mb-1',
                isActive && 'active',
                !sidebarOpen && 'justify-center px-2'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className={cn('flex-shrink-0', sidebarOpen ? 'w-5 h-5' : 'w-5 h-5')} />
              {sidebarOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom: AI Status + Toggle */}
      <div className="p-3 border-t border-gray-200 dark:border-[#1a1a2e]">
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a2e]">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full flex-shrink-0',
              aiOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-500'
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {aiOnline ? 'AI Online' : 'AI Offline'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 truncate">
                {aiOnline ? 'Ollama connected' : 'Start Ollama'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className={cn(
              'w-3 h-3 rounded-full',
              aiOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-500'
            )} title={aiOnline ? 'AI Online' : 'AI Offline'} />
          </div>
        )}

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-full flex justify-center mt-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
