import { useCallback, useEffect, useState } from 'react'

import { AuthPage } from '@/components/AuthPage'
import { HomePage } from '@/components/HomePage'
import { LoadingScreen } from '@/components/LoadingScreen'
import {
  TOKEN_STORAGE_KEY,
  getCurrentUser,
  getModels,
  getPlaygroundSessions,
} from '@/lib/api'
import type { DashboardData, User } from '@/lib/api'

type AppStatus = 'checking' | 'authenticated' | 'unauthenticated'

function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [status, setStatus] = useState<AppStatus>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? 'checking' : 'unauthenticated',
  )
  const [user, setUser] = useState<User | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    models: [],
    sessions: [],
    totalSessions: 0,
  })
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [isDashboardLoading, setIsDashboardLoading] = useState(false)

  const loadDashboard = useCallback((activeToken: string) => {
    setIsDashboardLoading(true)
    setDashboardError(null)

    Promise.all([getModels(activeToken), getPlaygroundSessions(activeToken)])
      .then(([modelsResponse, sessionsResponse]) => {
        setDashboardData({
          models: modelsResponse.models,
          sessions: sessionsResponse.sessions,
          totalSessions: sessionsResponse.total,
        })
      })
      .catch((error: unknown) => {
        setDashboardError(
          error instanceof Error
            ? error.message
            : 'Could not load dashboard data.',
        )
      })
      .finally(() => {
        setIsDashboardLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!token || status !== 'checking') {
      return
    }

    getCurrentUser(token)
      .then((profile) => {
        setUser(profile)
        setStatus('authenticated')
        loadDashboard(token)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setStatus('unauthenticated')
      })
  }, [loadDashboard, status, token])

  function completeAuth(nextToken: string, profile: User) {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setUser(profile)
    setStatus('authenticated')
    loadDashboard(nextToken)
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setDashboardData({ models: [], sessions: [], totalSessions: 0 })
    setDashboardError(null)
    setStatus('unauthenticated')
  }

  if (status === 'checking') {
    return <LoadingScreen />
  }

  if (status === 'authenticated' && user && token) {
    return (
      <HomePage
        dashboardData={dashboardData}
        dashboardError={dashboardError}
        isDashboardLoading={isDashboardLoading}
        onRefresh={() => loadDashboard(token)}
        onLogout={handleLogout}
        token={token}
        user={user}
      />
    )
  }

  return <AuthPage onAuthenticated={completeAuth} />
}

export default App
