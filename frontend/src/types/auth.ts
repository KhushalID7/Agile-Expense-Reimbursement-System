export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  is_active: boolean
}
