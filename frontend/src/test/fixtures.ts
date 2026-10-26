import type { DashboardSummary } from '../types/dashboard'
import type { Expense, ExpenseCategory } from '../types/expenses'
import type { User } from '../types/auth'

export const manager: User = {
  id: 2,
  username: 'manager',
  email: 'manager@example.com',
  role: 'MANAGER',
  is_active: true,
}

export const dashboardSummary: DashboardSummary = {
  total_expenses: 2,
  pending_count: 1,
  approved_count: 1,
  rejected_count: 0,
  total_amount_submitted: '1500.00',
  total_amount_approved: '1000.00',
}

export const category: ExpenseCategory = {
  id: 4,
  name: 'Travel',
  description: 'Travel expenses',
}

export const expense: Expense = {
  id: 10,
  employee: 'employee-a',
  category: category.id,
  title: 'Taxi fare',
  amount: '125.50',
  currency: 'INR',
  expense_date: '2026-10-20',
  description: 'Client visit',
  status: 'PENDING',
  receipt: null,
  decisions: [],
  created_at: '2026-10-20T10:30:00Z',
  updated_at: '2026-10-20T10:30:00Z',
}
