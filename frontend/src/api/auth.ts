import { api, getCsrfToken } from './client'
import type { User } from '../types/auth'

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/api/v1/auth/me/')
}

export async function login(username: string, password: string): Promise<User> {
  await getCsrfToken()
  return api.post<User>('/api/v1/auth/login/', { username, password })
}

export async function logout(): Promise<void> {
  await api.post<{ detail: string }>('/api/v1/auth/logout/')
}
