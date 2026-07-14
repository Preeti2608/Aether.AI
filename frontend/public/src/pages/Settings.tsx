import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Settings as SettingsIcon, Moon, Sun, Cpu, Download, Upload,
  Trash2, RotateCcw, Zap, CheckCircle2, AlertCircle, ChevronDown,
  Loader2, Shield, Save, RefreshCw, Info
} from 'lucide-react'
import { dashboardApi } from '../services/api'
import { useAppStore } from '../store/appStore'
import { cn } from '../utils/helpers'

export default function Settings() {
  const { theme, setTheme, selectedModel, setSelectedModel, availableModels, setAvailableModels, aiOnline, setAiOnline } = useAppStore()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await dashboardApi.getSettings()
      setSettings(res.data)
      setAiOnline(res.data.ai_online)
      if (res.data.available_models?.length) {
        setAvailableModels(res.data.available_models)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function exportData() {
    setExporting(true)
    try {
      const res = await dashboardApi.exportData()
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aether-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully!')
    } catch (e: any) { toast.error(e.message) }
    finally { setExporting(false) }
  }

  async function clearMemory() {
    if (!confirm('This will permanently delete all memories. Continue?')) return
    setClearing(true)
    try {
      await dashboardApi.clearMemory()
      toast.success('All memories cleared')
    } catch (e: any) { toast.error(e.message) }
    finally { setClearing(false) }
  }

  async function resetApp() {
    const confirmed = confirm(
      'This will DELETE ALL data including chats, memories, notes, and documents. This cannot be undone. Type "RESET" to confirm.'
    )
    if (!confirmed) return
    setResetting(true)
    try {
      await dashboardApi.reset()
      toast.success('Application reset. Reloading...')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) { toast.error(e.message) }
    finally { setResetting(false) }
  }

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.FC<{ className?: string }>; children: React.ReactNode }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-[#1a1a2e]">
        <Icon className="w-5 h-5 text-aether-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-aether-500" /> Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Configure Aether AI to match your preferences
        </p>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={Moon}>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Theme</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred color scheme</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme('light')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                theme === 'light'
                  ? 'bg-white border-aether-300 text-aether-700 shadow-sm'
                  : 'border-gray-200 dark:border-[#26263a] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a2e]')}>
              <Sun className="w-4 h-4" /> Light
            </button>
            <button onClick={() => setTheme('dark')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                theme === 'dark'
                  ? 'bg-[#1a1a2e] border-aether-700 text-aether-400'
                  : 'border-gray-200 dark:border-[#26263a] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a2e]')}>
              <Moon className="w-4 h-4" /> Dark
            </button>
          </div>
        </div>
      </Section>

      {/* AI Model */}
      <Section title="AI Model" icon={Cpu}>
        <div className={cn('flex items-center gap-3 p-3 rounded-xl mb-4',
          aiOnline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
          {aiOnline ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <div>
            <p className={cn('font-medium text-sm', aiOnline ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
              {aiOnline ? 'Ollama Connected' : 'Ollama Not Running'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {aiOnline ? `${availableModels.length} model(s) available` : 'Run "ollama serve" to connect'}
            </p>
          </div>
          <button onClick={fetchSettings} className="ml-auto p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 text-gray-400">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active Model</label>
          {availableModels.length > 0 ? (
            <div className="relative">
              <select
                className="input appearance-none pr-10"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <div className="input text-gray-400 cursor-not-allowed">
              {aiOnline ? 'No models found — run: ollama pull phi3' : 'Connect Ollama to see models'}
            </div>
          )}
        </div>

        {availableModels.length === 0 && aiOnline && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>No models found.</strong> Install a model with:<br />
              <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-xs">ollama pull phi3</code>
              {' or '}
              <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded font-mono text-xs">ollama pull qwen</code>
            </p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1a1a2e]">
          <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Shield className="w-4 h-4 mt-0.5 text-aether-500 flex-shrink-0" />
            <p>All AI processing happens locally on your device via Ollama. Your data never leaves your machine.</p>
          </div>
        </div>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" icon={Download}>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a2e]">
            <div>
              <p className="font-medium text-gray-900 dark:text-white text-sm">Export Data</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Download all memories, notes, and collections as JSON</p>
            </div>
            <button onClick={exportData} disabled={exporting} className="btn-secondary flex items-center gap-2 text-sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">Clear Memory</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">Permanently delete all saved memories</p>
            </div>
            <button onClick={clearMemory} disabled={clearing} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-sm font-medium transition-colors">
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
            <div>
              <p className="font-medium text-red-700 dark:text-red-400 text-sm">Reset Application</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-0.5">Delete ALL data — chats, memories, notes, documents</p>
            </div>
            <button onClick={resetApp} disabled={resetting} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-medium transition-colors">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reset
            </button>
          </div>
        </div>
      </Section>

      {/* About */}
      <Section title="About Aether AI" icon={Info}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aether-500 to-purple-600 flex items-center justify-center shadow-glow-sm">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-lg">Aether AI</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Version 1.0.0 · Privacy-First AI Second Brain</p>
            <p className="text-xs text-gray-400 mt-1">Built with FastAPI · React · Ollama · ChromaDB</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#1a1a2e] grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Local LLM', value: '100%', desc: 'On-Device' },
            { label: 'Private', value: '100%', desc: 'No tracking' },
            { label: 'Offline', value: '100%', desc: 'No cloud' },
          ].map(stat => (
            <div key={stat.label} className="p-3 bg-gray-50 dark:bg-[#1a1a2e] rounded-xl">
              <p className="text-xl font-bold gradient-text">{stat.value}</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{stat.label}</p>
              <p className="text-xs text-gray-400">{stat.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
