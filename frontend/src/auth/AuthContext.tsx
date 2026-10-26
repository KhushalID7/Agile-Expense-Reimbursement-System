import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'
import type { User } from '../types/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch((reason: unknown) => {
        if (!(reason instanceof ApiError && [401, 403].includes(reason.status))) {
          setError('We could not verify your session. Please refresh and try again.')
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    error,
    signIn: async (username, password) => {
      setError(null)
      const authenticatedUser = await authApi.login(username, password)
      setUser(authenticatedUser)
    },
    signOut: async () => {
      await authApi.logout()
      setUser(null)
    },
  }), [error, isLoading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
