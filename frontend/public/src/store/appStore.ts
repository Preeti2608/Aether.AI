import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppStore {
  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (t: 'light' | 'dark') => void

  // AI Model
  selectedModel: string
  setSelectedModel: (m: string) => void
  availableModels: string[]
  setAvailableModels: (models: string[]) => void
  aiOnline: boolean
  setAiOnline: (v: boolean) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void

  // Active chat session
  activeChatSession: string | null
  setActiveChatSession: (id: string | null) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        if (next === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },
      setTheme: (t) => {
        set({ theme: t })
        if (t === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },

      selectedModel: 'phi3',
      setSelectedModel: (m) => set({ selectedModel: m }),
      availableModels: [],
      setAvailableModels: (models) => set({ availableModels: models }),
      aiOnline: false,
      setAiOnline: (v) => set({ aiOnline: v }),

      sidebarOpen: true,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      activeChatSession: null,
      setActiveChatSession: (id) => set({ activeChatSession: id }),
    }),
    {
      name: 'aether-app-store',
      partialize: (s) => ({
        theme: s.theme,
        selectedModel: s.selectedModel,
        sidebarOpen: s.sidebarOpen,
      }),
    }
  )
)
