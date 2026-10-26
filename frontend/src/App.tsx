import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.css'

function AppContent() {
  const { user, isLoading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (isLoading) {
    return (
      <div className="app-loading" role="status">
        <span className="spinner" />
        <span>Checking your session</span>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <ProtectedRoute>
      <AppLayout activePath={path} onNavigate={navigate}>
        <PlaceholderPage path={path} onNavigate={navigate} />
      </AppLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
