export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ExpenseDecision {
  id: number
  manager: string
  decision: ExpenseStatus
  comment: string
  decided_at: string
}

export interface Expense {
  id: number
  employee: string
  category: number
  title: string
  amount: string
  currency: string
  expense_date: string
  description: string
  status: ExpenseStatus
  receipt: string | null
  decisions: ExpenseDecision[]
  created_at: string
  updated_at: string
}

export interface ExpenseCategory {
  id: number
  name: string
  description: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ExpenseFilters {
  status: '' | ExpenseStatus
  category: string
  date_from: string
  date_to: string
  min_amount: string
  max_amount: string
}
