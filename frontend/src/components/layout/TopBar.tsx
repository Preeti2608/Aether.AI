import { Sun, Moon, Bell } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chat': 'AI Chat',
  '/memory': 'Long-Term Memory',
  '/notes': 'Smart Notes',
  '/pdf': 'PDF Chat',
  '/search': 'Semantic Search',
  '/collections': 'Collections',
  '/settings': 'Settings',
}

export default function TopBar() {
  const { theme, toggleTheme, selectedModel, aiOnline } = useAppStore()
  const location = useLocation()

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? 'Aether AI'

  return (
    <header className="h-16 bg-white dark:bg-[#0d0d1a] border-b border-gray-200 dark:border-[#1a1a2e] flex items-center justify-between px-6 flex-shrink-0 z-30 sticky top-0">
      <div>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Powered by <span className="text-aether-500 font-medium">{selectedModel || 'Local LLM'}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* AI Status badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          aiOnline
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${aiOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {aiOnline ? 'AI Ready' : 'AI Offline'}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#1a1a2e] text-gray-600 dark:text-gray-400 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  )
}
