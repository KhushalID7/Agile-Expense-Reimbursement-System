import { createContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  error: string | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
