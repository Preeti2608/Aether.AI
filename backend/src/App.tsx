import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { dashboardApi } from './services/api'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Memory from './pages/Memory'
import Notes from './pages/Notes'
import PDFChat from './pages/PDFChat'
import SearchPage from './pages/Search'
import Collections from './pages/Collections'
import Settings from './pages/Settings'

export default function App() {
  const { theme, setTheme, setAiOnline, setAvailableModels, setSelectedModel, selectedModel } = useAppStore()

  useEffect(() => {
    // Apply saved theme
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    // Check AI status on mount
    const checkAI = async () => {
      try {
        const res = await dashboardApi.getModels()
        setAiOnline(res.data.online)
        if (res.data.models?.length) {
          const modelNames = res.data.models.map((m: { name: string }) => m.name)
          setAvailableModels(modelNames)
          if (!modelNames.includes(selectedModel) && modelNames.length > 0) {
            setSelectedModel(modelNames[0])
          }
        }
      } catch {
        setAiOnline(false)
      }
    }
    checkAI()
    const interval = setInterval(checkAI, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
            color: theme === 'dark' ? '#e5e7eb' : '#111827',
            border: theme === 'dark' ? '1px solid #26263a' : '1px solid #e5e7eb',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:sessionId" element={<Chat />} />
          <Route path="memory" element={<Memory />} />
          <Route path="notes" element={<Notes />} />
          <Route path="pdf" element={<PDFChat />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="collections" element={<Collections />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
