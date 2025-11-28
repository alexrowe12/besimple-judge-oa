import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Scale,
  ListTodo,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/submissions', icon: FileText, label: 'Submissions' },
  { to: '/judges', icon: Scale, label: 'Judges' },
  { to: '/queues', icon: ListTodo, label: 'Queues' },
  { to: '/results', icon: BarChart3, label: 'Results' },
]

export function AppLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="p-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">AI Judge</h1>
            <p className="text-sm text-muted-foreground">Evaluation Platform</p>
          </div>
          <ThemeToggle />
        </div>
        <nav className="px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
