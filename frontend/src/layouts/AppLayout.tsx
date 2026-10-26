import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import type { UserRole } from '../types/auth'

interface AppLayoutProps {
  activePath: string
  onNavigate: (path: string) => void
  children: ReactNode
}

interface NavEntry {
  label: string
  path: string
  icon: 'grid' | 'receipt' | 'plus' | 'check' | 'chart'
  roles: UserRole[]
}

const navigation: NavEntry[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { label: 'My expenses', path: '/expenses', icon: 'receipt', roles: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
  { label: 'Submit expense', path: '/expenses/new', icon: 'plus', roles: ['EMPLOYEE'] },
  { label: 'Approvals', path: '/approvals', icon: 'check', roles: ['MANAGER', 'ADMIN'] },
  { label: 'Team dashboard', path: '/team-dashboard', icon: 'chart', roles: ['MANAGER', 'ADMIN'] },
]

export function AppLayout({ activePath, onNavigate, children }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!user) return null

  const entries = navigation.filter((entry) => entry.roles.includes(user.role))
  const navigate = (path: string) => {
    onNavigate(path)
    setMobileOpen(false)
  }
  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div className="workspace">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
        <BrandMark />
        <nav className="sidebar__nav" aria-label="Primary navigation">
          <p className="nav-section-label">Workspace</p>
          {entries.map((entry) => (
            <button
              className={`nav-item ${activePath === entry.path || (entry.path === '/expenses' && activePath.startsWith('/expenses/')) || (entry.path === '/approvals' && activePath.startsWith('/approvals/')) ? 'nav-item--active' : ''}`}
              key={entry.path}
              type="button"
              onClick={() => navigate(entry.path)}
            >
              <span className="nav-item__icon"><Icon name={entry.icon} /></span>
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <p>Internal finance workspace</p>
          <p>Secure session access</p>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar__context">Expense operations / Workspace</span>
          </div>
          <div className="profile">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="profile__details">
              <span className="profile__name">{user.username}</span>
              <span className="profile__role">{user.role.toLowerCase()}</span>
            </span>
            <button className="icon-button" type="button" onClick={() => void signOut()}>
              <Icon name="logout" /> <span className="sr-only">Log out</span>
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  )
}
