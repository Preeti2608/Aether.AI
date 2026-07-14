import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAppStore } from '../../store/appStore'
import { cn } from '../../utils/helpers'

export default function Layout() {
  const { sidebarOpen } = useAppStore()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0a14]">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
