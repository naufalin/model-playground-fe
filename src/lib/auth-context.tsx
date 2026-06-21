import { createContext } from 'react'
import type { User } from '@/lib/api'

export type AuthContextValue = {
  token: string
  user: User
  onLogout: () => void
}

// eslint-disable-next-line react-refresh/only-export-components -- context + provider belong together
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue
  children: React.ReactNode
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
