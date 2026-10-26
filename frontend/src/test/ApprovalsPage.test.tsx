import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalsPage } from '../pages/ApprovalsPage'
import { expense, manager } from './fixtures'

const {
  getPendingApprovals,
  getCategories,
  getExpense,
  approveExpense,
  rejectExpense,
} = vi.hoisted(() => ({
  getPendingApprovals: vi.fn(),
  getCategories: vi.fn(),
  getExpense: vi.fn(),
  approveExpense: vi.fn(),
  rejectExpense: vi.fn(),
}))

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: manager }) }))
vi.mock('../api/expenses', () => ({
  getPendingApprovals,
  getCategories,
  getExpense,
  getExpenseReceipt: vi.fn(),
  approveExpense,
  rejectExpense,
}))

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a rejection reason and does not fabricate success', async () => {
    getCategories.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] })
    getPendingApprovals.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [expense] })
    getExpense.mockResolvedValueOnce(expense)
    render(<ApprovalsPage path="/approvals/10" onNavigate={vi.fn()} />)
    expect(await screen.findByText('Taxi fare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject expense' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(await screen.findByText('Enter a rejection reason before continuing.')).toBeInTheDocument()
    expect(rejectExpense).not.toHaveBeenCalled()
    expect(screen.queryByText('Expense rejected successfully.')).not.toBeInTheDocument()
  })

  it('uses the authoritative approval response before showing success', async () => {
    getCategories.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] })
    getPendingApprovals.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [expense] })
    getExpense.mockResolvedValueOnce(expense)
    approveExpense.mockResolvedValueOnce({ ...expense, status: 'APPROVED' })
    render(<ApprovalsPage path="/approvals/10" onNavigate={vi.fn()} />)
    await screen.findByText('Taxi fare')
    fireEvent.click(screen.getByRole('button', { name: 'Approve expense' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    expect(await screen.findByText('Expense approved successfully.')).toBeInTheDocument()
    expect(screen.getAllByText('APPROVED')).toHaveLength(2)
  })
})
