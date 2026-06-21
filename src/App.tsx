import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthPage } from '@/components/AuthPage'
import { DashboardPage } from '@/components/DashboardPage'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PlaygroundPage } from '@/components/PlaygroundPage'
import { AuthProvider } from '@/lib/auth-context'
import { getCurrentUser, TOKEN_STORAGE_KEY } from '@/lib/api'
import type { User } from '@/lib/api'

type AppStatus = 'checking' | 'authenticated' | 'unauthenticated'

function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [status, setStatus] = useState<AppStatus>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? 'checking' : 'unauthenticated',
  )
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!token || status !== 'checking') return

    getCurrentUser(token)
      .then((profile) => {
        setUser(profile)
        setStatus('authenticated')
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setStatus('unauthenticated')
      })
  }, [status, token])

  function completeAuth(nextToken: string, profile: User) {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setUser(profile)
    setStatus('authenticated')
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setStatus('unauthenticated')
  }

  if (status === 'checking') {
    return <LoadingScreen />
  }

  if (status === 'unauthenticated' || !token || !user) {
    return <AuthPage onAuthenticated={completeAuth} />
  }

  return (
    <BrowserRouter>
      <AuthProvider value={{ token, user, onLogout: handleLogout }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/playground/:id" element={<PlaygroundPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
