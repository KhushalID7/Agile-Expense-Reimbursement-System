import { api } from './client'
import type {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  PaginatedResponse,
} from '../types/expenses'

export interface CreateExpenseData {
  category: number
  title: string
  amount: string
  currency: string
  expense_date: string
  description: string
  receipt?: File
}

function queryString(filters: ExpenseFilters, page: number): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function getExpenses(
  filters: ExpenseFilters,
  page: number,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Expense>> {
  return api.get<PaginatedResponse<Expense>>(
    `/api/v1/expenses/${queryString(filters, page)}`,
    { signal },
  )
}

export function getCategories(
  signal?: AbortSignal,
): Promise<PaginatedResponse<ExpenseCategory>> {
  return api.get<PaginatedResponse<ExpenseCategory>>('/api/v1/categories/', { signal })
}

export function getExpense(id: number, signal?: AbortSignal): Promise<Expense> {
  return api.get<Expense>(`/api/v1/expenses/${id}/`, { signal })
}

export function getExpenseReceipt(id: number, signal?: AbortSignal): Promise<Blob> {
  return api.getBlob(`/api/v1/expenses/${id}/receipt/`, { signal })
}

export function createExpense(data: CreateExpenseData): Promise<Expense> {
  if (data.receipt) {
    const formData = new FormData()
    formData.append('category', String(data.category))
    formData.append('title', data.title)
    formData.append('amount', data.amount)
    formData.append('currency', data.currency)
    formData.append('expense_date', data.expense_date)
    formData.append('description', data.description)
    formData.append('receipt', data.receipt)
    return api.post<Expense>('/api/v1/expenses/', formData)
  }

  return api.post<Expense>('/api/v1/expenses/', {
    category: data.category,
    title: data.title,
    amount: data.amount,
    currency: data.currency,
    expense_date: data.expense_date,
    description: data.description,
  })
}

export function getPendingApprovals(
  page: number,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Expense>> {
  const query = page > 1 ? `?page=${page}` : ''
  return api.get<PaginatedResponse<Expense>>(`/api/v1/approvals/pending/${query}`, { signal })
}

export function approveExpense(id: number, comment: string): Promise<Expense> {
  return api.post<Expense>(`/api/v1/expenses/${id}/approve/`, { comment })
}

export function rejectExpense(id: number, comment: string): Promise<Expense> {
  return api.post<Expense>(`/api/v1/expenses/${id}/reject/`, { comment })
}
